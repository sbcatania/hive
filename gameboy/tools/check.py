#!/usr/bin/env python3
"""Runs tools/check_gb.c on the host (clang) and in PyBoy (SDCC build) and
compares the checksums: python tools/check.py [extra -D flags...]
e.g. python tools/check.py -DCHECK_AI=2 -DGAMES=4"""
import os, re, shutil, subprocess, sys, tempfile
from pyboy import PyBoy

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
flags = sys.argv[1:]
gbdk = os.environ.get("GBDK", os.path.expanduser("~/gbdk"))
os.makedirs("/tmp/hivegb", exist_ok=True)
tmp = tempfile.mkdtemp(dir="/tmp/hivegb")
try:
    for f in ("rules.c", "rules.h", "ai.c", "ai.h"):
        shutil.copy(os.path.join(root, "src", f), tmp)
    shutil.copy(os.path.join(root, "tools", "check_gb.c"), tmp)
    subprocess.run(["/usr/bin/cc", "-O2", "-DHOST", "-Dmain=hostmain"] + flags +
                   ["-o", "h", "check_gb.c", "rules.c", "ai.c", "-Wl,-e,_hostmain"], cwd=tmp, check=True,
                   stderr=subprocess.DEVNULL)
    host = subprocess.run(["./h"], cwd=tmp, capture_output=True, text=True).stdout.split()
    subprocess.run([gbdk + "/bin/lcc", "-Wl-m", "-Wm-yC", "-Wf--max-allocs-per-node50000"] + flags +
                   ["-o", "c.gbc", "check_gb.c", "rules.c", "ai.c"], cwd=tmp, check=True)
    syms = dict(re.findall(r"([0-9A-F]{8})\s+(_\w+)", open(tmp + "/c.map").read()))
    addr = {v: int(k, 16) for k, v in syms.items()}
    pb = PyBoy(tmp + "/c.gbc", window="null", cgb=True)
    pb.set_emulation_speed(0)
    frames = 0
    while not pb.memory[addr["_cdone"]] and frames < 60 * 3600 * 3:
        pb.tick(60)
        frames += 60
    gb = [str(pb.memory[addr["_csum"] + 2 * i] | pb.memory[addr["_csum"] + 2 * i + 1] << 8) for i in range(4)]
    nc = pb.memory[addr["_ncalls"]] if "_ncalls" in addr else 0
    if "_cstack" in addr:
        print("stack used below main: %d bytes" % (pb.memory[addr["_cstack"]] | pb.memory[addr["_cstack"] + 1] << 8))
    stats = [(pb.memory[addr["_cstat"] + 4 * i] | pb.memory[addr["_cstat"] + 4 * i + 1] << 8,
              pb.memory[addr["_cstat"] + 4 * i + 2] | pb.memory[addr["_cstat"] + 4 * i + 3] << 8) for i in range(nc)]
    pb.stop(save=False)
    if stats:
        print("AI calls (seconds, work):", " ".join("%.1f/%d" % (f / 59.73, w) for f, w in stats))
        print("seconds per 1000 work: %.2f; max call %.1f s" % (sum(f for f, _ in stats) / 59.73 / max(1, sum(w for _, w in stats)) * 1000,
              max(f for f, _ in stats) / 59.73))
    print("host", " ".join(host))
    print("gb  ", " ".join(gb), f"({frames / 60:.0f} s GB time)")
    print("MATCH" if host == gb else "MISMATCH")
finally:
    shutil.rmtree(tmp)
