# Chromatic DevDay cartridge backup

What was on the DevDay Edition cartridge before Hive was flashed over it (2026-10-21). The `.gbc`/`.sav` files are git-ignored: the ROM is OpenAI/ModRetro's, not ours to publish. Only this README is in the repo, so keep the files somewhere safe outside git too.

| File | What | SHA-256 |
|---|---|---|
| `openai.gbc` | 128 KiB ROM, title `OPENAI`, MBC5+RUMBLE+RAM+BATTERY, CGB-enhanced. Boots to the ModRetro and Codex logos, then a terminal ("SYSTEM INITIALIZING") | `f900afec81428ca50c12ea208e56d526f90a3e81bcd323943efeabdb27324d6d` |
| `openai.sav` | 32 KiB battery save RAM (4 banks). All zeros, i.e. no save data | `c35020473aed1b4642cd726cad727b63fff2824ad68cedd7ffb73c7cbd890479` |

## Verification
- Two independent dumps were byte-identical (ROM and save).
- Header checksum: computed 0xF4 = stored 0xF4.
- Global checksum (16-bit sum of all 131,072 bytes): computed 0x74C7 = stored 0x74C7 = what `chromatic-cli detect-cart` reports. This only matches if every bank was switched and read correctly.
- Banks 6–7 are 0xFF padding; the other six are distinct.
- Save RAM really is empty, not unreadable. With RAM disabled, 0xA000–0xBFFF reads back open-bus values (the last byte written: 00/01/02/03 per bank). With RAM enabled, it reads 0x00.
- The ROM boots in an emulator (PyBoy, CGB mode).

## How it was read
ModRetro's `chromatic-cli` (v1.2.1) can read cartridge bytes, but it only exposes a header view (`detect-cart`). `../tools/cartdump.c` is a `DYLD_INSERT_LIBRARIES` shim for that CLI. It logs USB traffic, and while `detect-cart` has its cartridge-access FPGA image loaded, it reads the whole cartridge through the same protocol on the player interface (USB interface 3, endpoints 0x03/0x83):

- **Packets:** lists of 4-byte records `[op, addr_lo, addr_hi, data]`, each ending with a sync `01 seq_lo seq_hi 00`. The device echoes every record.
- **`02`:** read a cartridge byte. The echo carries the value in `data`.
- **`03`:** write a cartridge-bus byte (MBC registers; the CLI also uses it for flash-chip ID/reset).
- **`05`:** detect the cartridge (`data` = 1 if present). `01 43 43 01` is a hello.

The dump writes only MBC5 registers: RAM enable at 0x0000, ROM bank at 0x2000/0x3000, RAM bank at 0x4000. It never sends a flash unlock (AA/55) sequence.

```bash
clang -dynamiclib -o cartdump.dylib ../tools/cartdump.c -framework IOKit -framework CoreFoundation
USBHOOK_LOG=usb.log USBHOOK_DUMP=./mycart DYLD_INSERT_LIBRARIES=./cartdump.dylib \
  node_modules/@modretro/chromatic-cli-darwin-arm64/bin/chromatic-cli detect-cart -y
# -> mycart.gbc, mycart.sav
```

## Restoring
```bash
chromatic-cli write-homebrew openai.gbc
```
Not tested yet: the CLI's homebrew writer has only been confirmed with small ROM-only images. The save is empty, so there is nothing to restore there.

Hive (`build/hive.gbc`, SHA-256 `a1003309…3283a`) was then written with `write-homebrew`. A full read-back with `cartdump` matched it byte for byte.
