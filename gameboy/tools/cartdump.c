// DYLD_INSERT_LIBRARIES shim that logs USB traffic of an nusb-based process on
// macOS: wraps IOKit's USB interface/device vtables returned via QueryInterface.
#include <IOKit/IOKitLib.h>
#include <IOKit/IOCFPlugIn.h>
#include <IOKit/usb/IOUSBLib.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <stdarg.h>

static FILE *logf_;
static pthread_mutex_t mu = PTHREAD_MUTEX_INITIALIZER;
static int maxdump = 4096;

static void lg_open(void) {
    if (!logf_) {
        const char *p = getenv("USBHOOK_LOG");
        logf_ = fopen(p ? p : "/tmp/usbhook.log", "a");
        setvbuf(logf_, NULL, _IOLBF, 0);
        const char *m = getenv("USBHOOK_MAX");
        if (m) maxdump = atoi(m);
    }
}

static void dump(const char *tag, int ifn, int ep, const void *buf, uint32_t len) {
    pthread_mutex_lock(&mu);
    lg_open();
    fprintf(logf_, "%s if%d ep%02x len=%u :", tag, ifn, ep, len);
    uint32_t n = len < (uint32_t)maxdump ? len : (uint32_t)maxdump;
    for (uint32_t i = 0; i < n; i++) fprintf(logf_, " %02x", ((const uint8_t *)buf)[i]);
    if (n < len) fprintf(logf_, " ...");
    fprintf(logf_, "\n");
    pthread_mutex_unlock(&mu);
}

typedef struct IOUSBInterfaceStruct700 IF;
typedef struct IOUSBDeviceStruct650 DEV;
static IF *orig_if;   // assume one vtable implementation shared by all interfaces
static DEV *orig_dev;
static IF hooked_if;
static DEV hooked_dev;

static void pipe_info(void *self, UInt8 pipe, int *ifn, int *ep) {
    UInt8 dir, num, type, interval; UInt16 mps; UInt8 n = 0;
    orig_if->GetInterfaceNumber(self, &n);
    *ifn = n;
    *ep = 0;
    if (orig_if->GetPipeProperties(self, pipe, &dir, &num, &type, &mps, &interval) == 0)
        *ep = num | (dir == kUSBIn ? 0x80 : 0);
}

typedef struct { IOAsyncCallback1 cb; void *refcon; void *buf; int ifn, ep, in; void *self; UInt8 pipe; UInt32 size; } Ctx;

// While the dump runs, IN data on if3 that arrives through the CLI's pending
// async read is diverted here (and the read resubmitted) instead of reaching the CLI.
static pthread_mutex_t rmu = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t rcv = PTHREAD_COND_INITIALIZER;
static uint8_t ring[1 << 16];
static int ring_n, pending_in, diverting;

static IOReturn my_ReadPipeAsync(void *self, UInt8 pipe, void *buf, UInt32 size, IOAsyncCallback1 cb, void *refcon);

static void my_cb(void *refcon, IOReturn result, void *arg0) {
    Ctx *c = refcon;
    uint32_t got = (uint32_t)(uintptr_t)arg0;
    if (c->in && c->ifn == 3) {
        pthread_mutex_lock(&rmu);
        if (diverting && !result) {
            if (ring_n + got <= sizeof ring) { memcpy(ring + ring_n, c->buf, got); ring_n += got; }
            pthread_cond_broadcast(&rcv);
            pthread_mutex_unlock(&rmu);
            orig_if->ReadPipeAsync(c->self, c->pipe, c->buf, c->size, my_cb, c);
            return;
        }
        pending_in--;
        pthread_mutex_unlock(&rmu);
    }
    if (c->in) dump(result ? "IN!" : "IN ", c->ifn, c->ep, c->buf, got);
    else if (result) dump("OUT-ERR", c->ifn, c->ep, c->buf, 0);
    IOAsyncCallback1 cb = c->cb; void *rc = c->refcon;
    free(c);
    if (cb) cb(rc, result, arg0);
}


// ---- Read-only cartridge dump (USBHOOK_DUMP=/path/prefix) ----
// Runs inside the CLI's own session on the player interface (if3), when the
// CLI sends its first command there: the Cart Clinic FPGA image is loaded and
// the device is idle. The CLI's IN transfers on if3 are held back meanwhile.
// Cartridge-bus writes are limited to MBC5 registers (RAM enable, ROM/RAM bank).

static int dump_state;  // 0 = not yet, 1 = running, 2 = done
static UInt8 p_out, p_in;
static uint16_t seq = 0x200;
static uint8_t rbuf[16384];

static void dlog(const char *fmt, ...) {
    va_list ap; va_start(ap, fmt); vfprintf(stderr, fmt, ap); va_end(ap);
}

static int find_pipes(void *self) {
    UInt8 n = 0, dir, num, type, interval; UInt16 mps;
    orig_if->GetNumEndpoints(self, &n);
    for (UInt8 i = 1; i <= n; i++) {
        if (orig_if->GetPipeProperties(self, i, &dir, &num, &type, &mps, &interval)) continue;
        if (num == 3 && dir == kUSBOut) p_out = i;
        if (num == 3 && dir == kUSBIn) p_in = i;
    }
    return p_out && p_in;
}

// Sends `n` 4-byte commands plus a sync, and collects the echoed records.
// Returns 0 on success; read values are written into vals[i] for op 02 records.
static int batch(void *self, const uint8_t *cmds, int n, uint8_t *vals) {
    uint8_t out[1100];
    memcpy(out, cmds, n * 4);
    uint16_t s = seq++;
    out[n * 4] = 1; out[n * 4 + 1] = s & 0xff; out[n * 4 + 2] = s >> 8; out[n * 4 + 3] = 0;
    IOReturn r = orig_if->WritePipeTO(self, p_out, out, (n + 1) * 4, 1000, 2000);
    if (r) { dlog("write failed %x\n", r); return -1; }
    int got = 0, want = (n + 1) * 4;
    uint8_t acc[1100];
    if (diverting) {
        struct timespec ts;
        clock_gettime(CLOCK_REALTIME, &ts);
        ts.tv_sec += 3;
        pthread_mutex_lock(&rmu);
        while (ring_n < want)
            if (pthread_cond_timedwait(&rcv, &rmu, &ts)) break;
        got = ring_n < want ? ring_n : want;
        memcpy(acc, ring, got);
        memmove(ring, ring + got, ring_n - got);
        ring_n -= got;
        pthread_mutex_unlock(&rmu);
        if (got < want) { dlog("timeout: %d/%d bytes\n", got, want); return -1; }
    } else while (got < want) {
        UInt32 sz = sizeof rbuf;
        r = orig_if->ReadPipeTO(self, p_in, rbuf, &sz, 1000, 2000);
        if (r) { dlog("read failed %x after %d/%d\n", r, got, want); return -1; }
        if (got + (int)sz > (int)sizeof acc) { dlog("overflow\n"); return -1; }
        memcpy(acc + got, rbuf, sz);
        got += sz;
    }
    if (got != want || acc[want - 4] != 1 || acc[want - 3] != (s & 0xff) || acc[want - 2] != (s >> 8)) {
        dlog("bad response: got %d want %d tail %02x %02x %02x %02x\n", got, want, acc[got-4], acc[got-3], acc[got-2], acc[got-1]);
        return -1;
    }
    for (int i = 0; i < n; i++) {
        if (acc[i * 4] != cmds[i * 4] || acc[i * 4 + 1] != cmds[i * 4 + 1] || acc[i * 4 + 2] != cmds[i * 4 + 2]) {
            dlog("record %d mismatch\n", i); return -1;
        }
        if (vals) vals[i] = acc[i * 4 + 3];
    }
    return 0;
}

static int cart_write(void *self, uint16_t addr, uint8_t v) {
    uint8_t c[4] = {3, addr & 0xff, addr >> 8, v};
    return batch(self, c, 1, NULL);
}

static int read_range(void *self, uint16_t addr, uint32_t len, uint8_t *dst, int per) {
    uint8_t cmds[1024];
    for (uint32_t off = 0; off < len; off += per) {
        int n = (len - off) < (uint32_t)per ? (int)(len - off) : per;
        for (int i = 0; i < n; i++) {
            uint16_t a = addr + off + i;
            cmds[i * 4] = 2; cmds[i * 4 + 1] = a & 0xff; cmds[i * 4 + 2] = a >> 8; cmds[i * 4 + 3] = 0;
        }
        if (batch(self, cmds, n, dst + off)) return -1;
    }
    return 0;
}

static void do_dump(void *self) {
    const char *prefix = getenv("USBHOOK_DUMP");
    int per = getenv("USBHOOK_BATCH") ? atoi(getenv("USBHOOK_BATCH")) : 32;
    if (!find_pipes(self)) { dlog("dump: pipes not found\n"); return; }
    static uint8_t rom[8 << 20], ram[128 << 10];
    if (read_range(self, 0x0000, 0x4000, rom, per)) { dlog("dump: bank 0 failed\n"); return; }
    int banks = 2 << rom[0x148];
    static const int ramk[] = {0, 2, 8, 32, 128, 64};
    int ram_bytes = rom[0x149] < 6 ? ramk[rom[0x149]] * 1024 : 0;
    dlog("dump: title '%.16s' type %02x, %d ROM banks, %d bytes RAM\n", rom + 0x134, rom[0x147], banks, ram_bytes);
    if (banks > 512) { dlog("dump: implausible size\n"); return; }
    for (int b = 1; b < banks; b++) {
        if (cart_write(self, 0x2000, b & 0xff) || cart_write(self, 0x3000, b >> 8)) return;
        if (read_range(self, 0x4000, 0x4000, rom + b * 0x4000, per)) { dlog("dump: bank %d failed\n", b); return; }
        dlog("dump: ROM bank %d/%d\n", b + 1, banks);
    }
    cart_write(self, 0x2000, 1);
    cart_write(self, 0x3000, 0);
    if (ram_bytes) {
        if (!getenv("USBHOOK_NORAMEN")) cart_write(self, 0x0000, 0x0A);
        for (int b = 0; b * 0x2000 < ram_bytes; b++) {
            cart_write(self, 0x4000, b);
            int n = ram_bytes - b * 0x2000 < 0x2000 ? ram_bytes - b * 0x2000 : 0x2000;
            if (read_range(self, 0xA000, n, ram + b * 0x2000, per)) { dlog("dump: RAM bank %d failed\n", b); break; }
            dlog("dump: RAM bank %d\n", b);
        }
        cart_write(self, 0x4000, 0);
        cart_write(self, 0x0000, 0x00);
    }
    char path[1024];
    snprintf(path, sizeof path, "%s.gbc", prefix);
    FILE *f = fopen(path, "wb"); fwrite(rom, 1, banks * 0x4000, f); fclose(f);
    if (ram_bytes) {
        snprintf(path, sizeof path, "%s.sav", prefix);
        f = fopen(path, "wb"); fwrite(ram, 1, ram_bytes, f); fclose(f);
    }
    dlog("dump: wrote %s.*\n", prefix);
}

static IOReturn my_WritePipeAsync(void *self, UInt8 pipe, void *buf, UInt32 size, IOAsyncCallback1 cb, void *refcon) {
    Ctx *c = malloc(sizeof *c);
    pipe_info(self, pipe, &c->ifn, &c->ep);
    c->cb = cb; c->refcon = refcon; c->buf = buf; c->in = 0;
    dump("OUT", c->ifn, c->ep, buf, size);
    // Trigger on the CLI's first cartridge read batch (after its hello/detect).
    if (c->ifn == 3 && dump_state == 0 && getenv("USBHOOK_DUMP") && size >= 4 && ((uint8_t *)buf)[0] == 2) {
        dump_state = 1;
        pthread_mutex_lock(&rmu);
        diverting = pending_in > 0;
        ring_n = 0;
        pthread_mutex_unlock(&rmu);
        dlog("dump: %s\n", diverting ? "diverting the CLI's pending read" : "using synchronous reads");
        do_dump(self);
        pthread_mutex_lock(&rmu);
        diverting = 0;
        pthread_mutex_unlock(&rmu);
        dump_state = 2;
    }
    return orig_if->WritePipeAsync(self, pipe, buf, size, my_cb, c);
}

static IOReturn my_ReadPipeAsync(void *self, UInt8 pipe, void *buf, UInt32 size, IOAsyncCallback1 cb, void *refcon) {
    Ctx *c = malloc(sizeof *c);
    pipe_info(self, pipe, &c->ifn, &c->ep);
    c->cb = cb; c->refcon = refcon; c->buf = buf; c->in = 1;
    c->self = self; c->pipe = pipe; c->size = size;
    if (c->ifn == 3) { pthread_mutex_lock(&rmu); pending_in++; pthread_mutex_unlock(&rmu); }
    return orig_if->ReadPipeAsync(self, pipe, buf, size, my_cb, c);
}

typedef struct { IOAsyncCallback1 cb; void *refcon; IOUSBDevRequestTO *req; } DCtx;

static void my_dcb(void *refcon, IOReturn result, void *arg0) {
    DCtx *c = refcon;
    IOUSBDevRequestTO *r = c->req;
    char tag[96];
    snprintf(tag, sizeof tag, "CTRL%s %02x req=%02x val=%04x idx=%04x", result ? "!" : "", r->bmRequestType, r->bRequest, r->wValue, r->wIndex);
    if (r->bmRequestType & 0x80) dump(tag, -1, 0, r->pData, (uint32_t)(uintptr_t)arg0);
    IOAsyncCallback1 cb = c->cb; void *rc = c->refcon;
    free(c);
    if (cb) cb(rc, result, arg0);
}

static IOReturn my_DeviceRequestAsyncTO(void *self, IOUSBDevRequestTO *req, IOAsyncCallback1 cb, void *refcon) {
    if (!(req->bmRequestType & 0x80)) {
        char tag[96];
        snprintf(tag, sizeof tag, "CTRLOUT %02x req=%02x val=%04x idx=%04x", req->bmRequestType, req->bRequest, req->wValue, req->wIndex);
        dump(tag, -1, 0, req->pData, req->wLength);
    }
    DCtx *c = malloc(sizeof *c);
    c->cb = cb; c->refcon = refcon; c->req = req;
    return orig_dev->DeviceRequestAsyncTO(self, req, my_dcb, c);
}

#define NP 4
static HRESULT (*orig_qi[NP])(void *, REFIID, LPVOID *);
static IOCFPlugInInterface *orig_plugin[NP];
static IOCFPlugInInterface hooked_plugin[NP];
static int nplug;

static HRESULT my_qi_common(int k, void *self, REFIID iid, LPVOID *ppv) {
    HRESULT h = orig_qi[k](self, iid, ppv);
    if (h || !*ppv) return h;
    CFUUIDRef u = CFUUIDCreateFromUUIDBytes(NULL, iid);
    if (CFEqual(u, kIOUSBInterfaceInterfaceID700)) {
        IF **obj = (IF **)*ppv;
        if (*obj != &hooked_if) {
            if (!orig_if) {
                orig_if = *obj;
                hooked_if = **obj;
                hooked_if.WritePipeAsync = my_WritePipeAsync;
                hooked_if.ReadPipeAsync = my_ReadPipeAsync;
            }
            *obj = &hooked_if;
        }
    } else if (CFEqual(u, kIOUSBDeviceInterfaceID650)) {
        DEV **obj = (DEV **)*ppv;
        if (*obj != &hooked_dev) {
            if (!orig_dev) {
                orig_dev = *obj;
                hooked_dev = **obj;
                hooked_dev.DeviceRequestAsyncTO = my_DeviceRequestAsyncTO;
            }
            *obj = &hooked_dev;
        }
    }
    CFRelease(u);
    return h;
}

static HRESULT my_qi0(void *s, REFIID i, LPVOID *p) { return my_qi_common(0, s, i, p); }
static HRESULT my_qi1(void *s, REFIID i, LPVOID *p) { return my_qi_common(1, s, i, p); }
static HRESULT my_qi2(void *s, REFIID i, LPVOID *p) { return my_qi_common(2, s, i, p); }
static HRESULT my_qi3(void *s, REFIID i, LPVOID *p) { return my_qi_common(3, s, i, p); }
static void *qis[NP] = {my_qi0, my_qi1, my_qi2, my_qi3};

static kern_return_t my_IOCreatePlugInInterfaceForService(io_service_t s, CFUUIDRef pt, CFUUIDRef it, IOCFPlugInInterface ***out, SInt32 *score) {
    kern_return_t k = IOCreatePlugInInterfaceForService(s, pt, it, out, score);
    if (k == 0 && out && *out) {
        IOCFPlugInInterface **p = *out;
        int i;
        for (i = 0; i < nplug; i++)
            if (*p == orig_plugin[i] || *p == &hooked_plugin[i]) break;
        if (i == nplug && nplug < NP) {
            orig_plugin[i] = *p;
            hooked_plugin[i] = **p;
            orig_qi[i] = (void *)(*p)->QueryInterface;
            hooked_plugin[i].QueryInterface = qis[i];
            nplug++;
        }
        if (i < nplug) *p = &hooked_plugin[i];
    }
    return k;
}

__attribute__((used)) static struct { const void *repl, *orig; } interposers[] __attribute__((section("__DATA,__interpose"))) = {
    {(const void *)my_IOCreatePlugInInterfaceForService, (const void *)IOCreatePlugInInterfaceForService},
};
