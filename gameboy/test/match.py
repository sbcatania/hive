#!/usr/bin/env python3
"""Runs the host arena in parallel and sums the results.
python3 test/match.py <A src> "<A flags>" <A level> <B src> "<B flags>" <B level> [games] [cap] [random_plies]
Seeds are split across processes; each opening is played with both colours."""
import os, re, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
a_src, a_fl, a_lv, b_src, b_fl, b_lv = sys.argv[1:7]
games = int(sys.argv[7]) if len(sys.argv) > 7 else 200
cap = sys.argv[8] if len(sys.argv) > 8 else "200"
nrand = sys.argv[9] if len(sys.argv) > 9 else "3"
os.makedirs("/tmp/hivegb", exist_ok=True)
exe = tempfile.mktemp(dir="/tmp/hivegb", prefix="arena")
subprocess.run([os.path.join(root, "test", "arena.sh"), exe, a_src, a_fl, b_src, b_fl], check=True)
jobs = 10
per = (games // jobs) & ~1
def run(i):
    return subprocess.run([exe, a_lv, b_lv, str(per), str(int(os.environ.get("SEED", "1000")) + i), cap, nrand], capture_output=True, text=True).stdout
with ThreadPoolExecutor(jobs) as ex:
    outs = list(ex.map(run, range(jobs)))
os.remove(exe)
W = D = L = C = 0
plies = 0.0
work = []
wmax = 0
for o in outs:
    m = re.search(r"A wins (\d+)\s+draws (\d+) \(capped (\d+)\)\s+A losses (\d+)\s+avg plies ([\d.]+)", o)
    w, d, c, l, p = int(m[1]), int(m[2]), int(m[3]), int(m[4]), float(m[5])
    W += w; D += d; C += c; L += l; plies += p * per
    m = re.search(r"work avg (\d+) max (\d+)", o)
    if m:
        work.append(int(m[1])); wmax = max(wmax, int(m[2]))
n = per * jobs
print(f"{n} games: A W {W} D {D} (capped {C}) L {L}  score {100.0 * (W + D / 2) / n:.1f}%  avg plies {plies / n:.0f}"
      + (f"  work avg {sum(work) / len(work):.0f} max {wmax}" if work else ""))
