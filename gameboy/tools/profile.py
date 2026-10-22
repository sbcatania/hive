#!/usr/bin/env python3
"""Statistical profile of tools/check_gb.c with the AI on GBC timing: samples
the program counter once per frame and maps it to functions.
python tools/profile.py [-DCHECK_AI=2 ...]"""
import bisect, collections, os, re, shutil, subprocess, sys, tempfile
from pyboy import PyBoy

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
flags = sys.argv[1:] or ["-DCHECK_AI=2", "-DGAMES=3", "-DPLIES=64"]
gbdk = os.environ.get("GBDK", os.path.expanduser("~/gbdk"))
os.makedirs("/tmp/hivegb", exist_ok=True)
tmp = tempfile.mkdtemp(dir="/tmp/hivegb")
try:
    for f in ("rules.c", "rules.h", "ai.c", "ai.h"):
        shutil.copy(os.path.join(root, "src", f), tmp)
    shutil.copy(os.path.join(root, "tools", "check_gb.c"), tmp)
    # -Dstatic= makes static functions global so they show up in the map.
    subprocess.run([gbdk + "/bin/lcc", "-Wl-m", "-Wm-yC", "-Wf--max-allocs-per-node50000", "-Dstatic="] + flags +
                   ["-o", "c.gbc", "check_gb.c", "rules.c", "ai.c"], cwd=tmp, check=True)
    text = open(tmp + "/c.map").read()
    syms = sorted((int(a, 16), n) for a, n in re.findall(r"([0-9A-F]{8})\s+(_\w+)", text) if int(a, 16) < 0x8000 and not re.match(r"_r[A-Z]", n))
    addrs = [a for a, _ in syms]
    ram = {n: int(a, 16) for a, n in re.findall(r"([0-9A-F]{8})\s+(_\w+)", text)}
    pb = PyBoy(tmp + "/c.gbc", window="null", cgb=True)
    pb.set_emulation_speed(0)
    hist = collections.Counter()
    frames = 0
    while not pb.memory[ram["_cdone"]] and frames < 60 * 3600:
        pb.tick(1, False)
        frames += 1
        pc = pb.register_file.PC
        i = bisect.bisect_right(addrs, pc) - 1
        hist[syms[i][1] if i >= 0 and pc < 0x8000 else "?%04x" % pc] += 1
    pb.stop(save=False)
    total = sum(hist.values())
    for name, n in hist.most_common(30):
        print("%6.1f%%  %s" % (100.0 * n / total, name))
finally:
    shutil.rmtree(tmp)
