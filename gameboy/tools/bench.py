#!/usr/bin/env python3
"""Builds tools/bench_gb.c into a throwaway ROM and reports per-call costs on
GBC (double speed) timing: python tools/bench.py [plies] [eval-expr]."""
import os, re, shutil, subprocess, sys, tempfile
from pyboy import PyBoy

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
plies = sys.argv[1] if len(sys.argv) > 1 else "24"
ev = sys.argv[2] if len(sys.argv) > 2 else "evaluate(0)"
gbdk = os.environ.get("GBDK", os.path.expanduser("~/gbdk"))
os.makedirs("/tmp/hivegb", exist_ok=True)
tmp = tempfile.mkdtemp(dir="/tmp/hivegb")
for f in os.listdir(os.path.join(root, "src")):
    if f.endswith((".c", ".h")) and f not in ("main.c", "assets.c"):
        shutil.copy(os.path.join(root, "src", f), tmp)
shutil.copy(os.path.join(root, "tools", "bench_gb.c"), tmp)
if os.environ.get("RULES"):
    shutil.copy(os.environ["RULES"], tmp + "/rules.c")
subprocess.run([gbdk + "/bin/lcc", "-Wl-m", "-Wm-yC", "-Wf--max-allocs-per-node50000",
                "-DBENCH_PLIES=" + plies, "-DBENCH_EVAL=" + ev, "-o", "b.gbc", "bench_gb.c"],
               cwd=tmp, check=True)
syms = dict(re.findall(r"([0-9A-F]{8})\s+(_\w+)", open(tmp + "/b.map").read()))
addr = {v: int(k, 16) for k, v in syms.items()}
pb = PyBoy(tmp + "/b.gbc", window="null", cgb=True)
pb.set_emulation_speed(0)
for _ in range(60 * 600):
    pb.tick(10)
    if pb.memory[addr["_bdone"]]:
        break
r = [pb.memory[addr["_bres"] + 2 * i] | pb.memory[addr["_bres"] + 2 * i + 1] << 8 for i in range(8)]
tr = [pb.memory[addr['_btrace'] + 2 * i] | pb.memory[addr['_btrace'] + 2 * i + 1] << 8 for i in range(48)]
if os.environ.get('TRACE'): print(tr)
if os.environ.get('DUMP'):
    a = addr['_bmoves']
    print(sorted((pb.memory[a+3*i], pb.memory[a+3*i+1], pb.memory[a+3*i+2]) for i in range(r[4])))
pb.stop(save=False)
ms = lambda f: f * 1000 / 59.73 / 50
print(f"plies {plies}: {r[4]} moves; gen_moves {ms(r[0]):.2f} ms, compute_pinned {ms(r[1]):.2f} ms, "
      f"eval {ms(r[2]):.2f} ms, play+undo {ms(r[3]):.2f} ms; ai_choose(HARD) {r[5]/59.73:.2f} s")
shutil.rmtree(tmp)
