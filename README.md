# Hive

The board game [Hive](https://www.gen42.com/games/hive), in two separate versions:

| | Where | What |
|---|---|---|
| **Web** | `engine/` (Rust → WebAssembly) + `web/` (Next.js) | The full game in the browser: CPU opponents up to a neural-net Expert, pass-and-play, online play, all three expansions, puzzles, accounts. Most of this README is about it. |
| **Game Boy Color** | [`gameboy/`](gameboy/README.md) (C, GBDK) | A from-scratch port for the Game Boy Color and the ModRetro Chromatic. Base game only, vs CPU (Easy/Normal/Hard) or pass-and-play, in a 32 KiB ROM. |

The two share no code. The Game Boy rules are a C rewrite that is tested move-for-move against the Rust engine. A rules change in `engine/` doesn't reach the Game Boy version on its own: run `make test` in `gameboy/` to see whether the C rules need the same change. See [gameboy/README.md](gameboy/README.md) for how they differ.

## Web version

Play in the browser: against CPU opponents, pass-and-play on one device, or online with a friend by sharing a link. The Mosquito, Ladybug and Pillbug expansions can each be switched on or off, and there are three board styles (clean 2D, classic tiles, 3D).

### Features
- **Themed throughout**: a "field guide by day, night garden by night" design (see [docs/DESIGN.md](docs/DESIGN.md) for the ten directions considered and the critique rounds), with light and dark themes.
- **Board styles**: Bakelite (glossy bevelled tiles), Field guide (ink on graph paper), Clean (flat, high contrast) and a 3D table with modelled tiles.
- **Click any piece**: legal moves in green; an opponent's piece shows where it could go next turn (coral, dashed); stuck pieces explain why (One Hive, beetle on top, too tight to slide...).
- **Variants** in an Advanced rules drawer: piece counts (Hive Lite), Queen deadline, capture on 5 sides, turn limit, threefold-repetition draws, plus chess clocks for local games.
- **Accounts (optional)**: email + password via Supabase Auth. Guests keep a local journal; signed-in players get a cloud journal, an Elo rating from rated online games, a profile and the leaderboard.
- **Puzzles** (win in 1 / win in 2, generated and verified by the engine) and a replay viewer for every saved game.
- **Full rules** including all three expansions and the tournament opening rule (toggle). Move generation is verified against [Mzinga](https://github.com/jonthysell/Mzinga)'s reference tests (perft counts and complete legal-move sets from championship games).
- **CPU levels**: Easy, Medium, Hard (alpha-beta search) and Expert (neural network + MCTS when a trained model is installed, otherwise a deeper search). All AI runs in your browser.
- **Analysis**: hints, evaluation bar, undo/takeback, move list in Universal Hive Protocol notation, copy/paste game import/export.
- **Online**: share a link, optional chess clock, spectator links, takeback and draw offers, rematch. Backed by Supabase.
- **How to play** page with live demo boards for every bug.

### Development
```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129   # must match Cargo.lock
./scripts/build-wasm.sh                            # engine -> web/src/wasm, web/public/wasm
cd web && npm install && npm run dev
cargo test -p hive-engine                          # rules tests
```
The generated WASM is committed, so the Vercel build only runs `next build` in `web/`.

#### Online play
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `web/.env.production`) and apply `supabase/migrations/*.sql`. Each player's browser holds a secret seat token; the database stores only its hash, and all writes go through token-checked functions.

#### Training the Expert AI
See [training/README.md](training/README.md). Self-play runs locally in Rust, training in PyTorch; the exported model goes in `web/public/models/`.

## Game Boy version
```bash
cd gameboy
./scripts/build.sh   # -> build/hive.gbc (needs GBDK-2020 in ~/gbdk)
make test            # C rules vs the Rust engine
```
Controls, flashing to a Chromatic cartridge and the CPU are covered in [gameboy/README.md](gameboy/README.md).

## Credits
Hive is designed by John Yianni and published by Gen42 Games. Rules test data comes from Mzinga by Jon Thysell (MIT).
