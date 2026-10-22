# Hive for Game Boy Color

A separate, from-scratch version of Hive for the Game Boy Color and the ModRetro Chromatic, written in C with [GBDK-2020](https://github.com/gbdk-2020/gbdk-2020). It plays the base game against the CPU or pass-and-play, and fits on a cartridge.

It shares no code with the web version (`../engine`, `../web`). The Rust engine is too big for an 8-bit Game Boy, so the rules were rewritten in C. The Rust engine is used as the reference: the tests check the C rules against it move by move.

## How it differs from the web version
| | Web (`engine/` + `web/`) | Game Boy (`gameboy/`) |
|---|---|---|
| Language | Rust → WebAssembly, Next.js UI | C (GBDK / SDCC), some SM83 assembly |
| Bugs | Base + Mosquito, Ladybug, Pillbug | Base game only (Queen, Spider, Beetle, Grasshopper, Ant) |
| Rules | Official, plus variants (Hive Lite, queen deadline, clocks...) | Official, tournament opening, Queen by turn 4. No variants |
| Board | 32x32 torus | 16x16 torus, so the hive can't stretch past 12 cells along one axis (real games never do) |
| CPU | Easy / Medium / Hard (alpha-beta) / Expert (NN + MCTS) | Easy / Normal / Hard (alpha-beta, depth ≤4, ~4 s a move on GBC) |
| Modes | vs CPU, pass-and-play, online, puzzles, replays, accounts | vs CPU, pass-and-play, CPU-vs-CPU demo |
| Extras | Hints, eval bar, notation, journal, themes | Undo (16 moves), in-game help |

When the web engine's rules change, regenerate the test data (`make test` does it when `../engine/src` changes) and make sure the C rules still match.

## Controls
| Button | Board | Hand picker |
|---|---|---|
| D-pad | Move the cursor (up/down zig-zag through the hex rows) | Left/right: choose a bug |
| A | Pick up your piece, or choose a green spot to place on / move to | Place it |
| B | Cancel | Back |
| START | Pause menu: Resume, Undo move, How to play, Main menu | |
| SELECT | Jump to the next green spot or movable piece | |

- **HUD:** shows whose turn it is, what that player has left in hand (Q S B G A), and which buttons work right now.
- **Undo:** goes back to your last turn, up to 16 moves.
- **How to play:** on the title screen and in the pause menu.
- **Demo:** on the title screen, SELECT starts a CPU-vs-CPU game; B leaves it.

## Build and test
Requirements:
- [GBDK-2020 4.5.0](https://github.com/gbdk-2020/gbdk-2020/releases), unpacked to `~/gbdk` or pointed to by `GBDK`.
- Python 3.
- Rust, for the tests.
- `pip install pyboy pillow` for the emulator tools.

```bash
cd gameboy
python3 tools/gen_assets.py   # tiles, font, sprites -> src/assets.c/.h (committed)
./scripts/build.sh            # -> build/hive.gbc (32 KiB, ROM-only, CGB-only)
make test                     # perft + 39k positions vs the Rust engine, span and filter tests
```
- `scripts/build.sh` compiles in a short temporary directory, because GBDK's `lcc` crashes on long paths and paths with spaces.
- `make test` generates `test/rust_games.txt` (24 MB, git-ignored) from the Rust engine the first time.

## Put it on the Chromatic
This uses ModRetro's official CLI. Writing to the cartridge needs Developer Mode, activated once per computer with the code from the DevDay Edition box.
```bash
npx @modretro/chromatic-cli@1.2.1 activate 'YOUR-CODE'
npx @modretro/chromatic-cli@1.2.1 live-demo build/hive.gbc       # stream from the Mac, play on the device
npx @modretro/chromatic-cli@1.2.1 write-homebrew build/hive.gbc  # flash the DevDay cartridge (replaces what's on it)
```
- **Format:** a 32 KiB ROM-only image, the format the DevDay cartridge's flash is known to accept.
- **Back up first:** `tools/cartdump.c` reads a whole cartridge (ROM + save) before you overwrite it; see `cartridge-backup/README.md`.

## Layout
- **`src/rules.c`:** move generation, play/undo, the One Hive check. Cells are one byte (q, r nibbles) on a 16x16 torus, so lookups are 8-bit.
  - Neighbour tables are in ROM.
  - The articulation-point and ant searches are hand-written SM83 assembly, with C versions for the host build.
- **`src/ai.c`:** the CPU.
  - **Easy:** a noisy one-move lookahead (~0.5 s per move on GBC).
  - **Normal:** also checks the opponent's best reply to its top 3 candidates (~1 s).
  - **Hard:** iterative-deepening alpha-beta, up to depth 4, under a fixed work budget (~4 s, max ~6 s), with a progress bar. Its eval weights were tuned over ~50k host games.
  - **Strength:** Hard beat the previous Hard 89% and went 87-11-0 (W-D-L) against the web engine's Medium, measured before the web CPU upgrade in commit 236ba60.
- **`src/main.c`:** title menu, board rendering (hexes are 2x2-tile bricks coloured by CGB palettes), cursor, HUD, pause menu, undo, help.
- **`test/`:** rules checks against the Rust engine (`rustdump`, `host_test.c`), plus span and filter tests. Arena and tuning tools: `arena.c`, `match.py`, `rustarena/` (vs the Rust AI), `ai_v1.c` (the old AI, as a baseline).
- **`tools/`:**
  - `gen_assets.py`: graphics.
  - `drive.py` and `demo.py`: headless PyBoy screenshots, and CPU timing at real Game Boy speed.
  - `check.py`: host vs SDCC builds must agree move for move.
  - `bench.py` and `profile.py`.
  - `cartdump.c`: cartridge backup.
- **`cartridge-backup/`:** notes on the cartridge's original contents. The ROM and save files themselves are git-ignored.

## Known limits
- Hard vs Hard often goes long without a winner. Against weaker play Hard does finish, in ~57 plies on average against Normal.
- No expansions and no saves.
