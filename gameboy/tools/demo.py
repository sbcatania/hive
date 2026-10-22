#!/usr/bin/env python3
"""Runs the CPU-vs-CPU demo headless in PyBoy and reports how long each CPU
move takes on Game Boy Color hardware timing:
python tools/demo.py [level] [max_ply] [rom.gbc (its .map must sit next to it)]."""
import re
import sys
from pyboy import PyBoy

level = int(sys.argv[1]) if len(sys.argv) > 1 else 1  # 0 easy, 1 normal, 2 hard
max_ply = int(sys.argv[2]) if len(sys.argv) > 2 else 80
rom = sys.argv[3] if len(sys.argv) > 3 else "build/hive.gbc"  # e.g. a stable copy
syms = dict(re.findall(r"([0-9A-F]{8})\s+(_\w+)", open(rom[:-4] + ".map").read()))
addr = {v: int(k, 16) for k, v in syms.items()}

pb = PyBoy(rom, window="null", cgb=True)
pb.set_emulation_speed(0)
pb.tick(90)  # the title must be up before the first press
pb.button("up", 3); pb.tick(6)  # wraps to the CPU level row (the last one)
for _ in range((level - 1) % 3):
    pb.button("right", 3); pb.tick(6)
pb.button("select", 3)
frames = 0
last_ply, last_frame, times = 0, 0, []
while frames < 60 * 60 * 30:
    pb.tick(4)
    frames += 4
    ply = pb.memory[addr["_game_ply"]] | pb.memory[addr["_game_ply"] + 1] << 8
    state = pb.memory[addr["_game_ove"]]
    if ply != last_ply:
        times.append((frames - last_frame) / 60)
        last_ply, last_frame = ply, frames
        if ply in (10, 30, 50) or state:
            pb.screen.image.save(f"build/shots/demo{level}_{ply}.png")
    if state or ply >= max_ply:
        pb.tick(30)
        pb.screen.image.save(f"build/shots/demo{level}_end.png")
        break
pb.stop(save=False)
print(f"level {level}: {last_ply} plies, state {state}")
print("seconds per move: max %.1f, avg %.1f" % (max(times), sum(times) / len(times)))
print("by ply:", " ".join("%.1f" % t for t in times))
