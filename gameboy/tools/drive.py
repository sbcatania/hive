#!/usr/bin/env python3
"""Drives build/hive.gbc in PyBoy (headless) with a script of button presses and
saves screenshots: python tools/drive.py "a a a shot:x wait:60 ..."."""
import sys
from pyboy import PyBoy

rom = sys.argv[2] if len(sys.argv) > 2 else "build/hive.gbc"
steps = sys.argv[1].split()
pb = PyBoy(rom, window="null", cgb=True)
pb.set_emulation_speed(0)
pb.tick(90)
for s in steps:
    if s.startswith("shot:"):
        pb.screen.image.save(f"build/shots/{s[5:]}.png")
    elif s.startswith("wait:"):
        pb.tick(int(s[5:]))
    elif s.startswith("until:"):
        # Wait until the HUD stops saying THINKING (CPU done); report frames.
        n = 0
        while n < 60 * 120:
            pb.tick(30)
            n += 30
            tiles = pb.tilemap_window[0:20, 1]
            if not any(t for t in tiles[:3]) or True:
                pass
            if pb.memory[0xFF00] is not None and n % 30 == 0:
                img = pb.screen.ndarray
                # HUD message row: pixels y 136..143; THINKING has text in col 13+.
                row = img[136:144, 100:120, :3]
                if row.std() < 1:
                    break
        print(f"{s}: {n} frames")
    else:
        for b in s.split("+"):
            pb.button(b, 3)
        pb.tick(8)
pb.stop(save=False)
