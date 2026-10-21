# Hive

Play the board game [Hive](https://www.gen42.com/games/hive) in the browser: against CPU opponents, pass-and-play on one device, or online with a friend by sharing a link. The Mosquito, Ladybug and Pillbug expansions can each be switched on or off, and there are three board styles (clean 2D, classic tiles, 3D).

## Features
- **Full rules** including all three expansions and the tournament opening rule (toggle). Move generation is verified against [Mzinga](https://github.com/jonthysell/Mzinga)'s reference tests (perft counts and complete legal-move sets from championship games).
- **CPU levels**: Easy, Medium, Hard (alpha-beta search) and Expert (neural network + MCTS when a trained model is installed, otherwise a deeper search). All AI runs in your browser.
- **Analysis**: hints, evaluation bar, undo/takeback, move list in Universal Hive Protocol notation, copy/paste game import/export.
- **Online**: share a link, optional chess clock, spectator links, takeback and draw offers, rematch. Backed by Supabase.
- **How to play** page with live demo boards for every bug.

## Development
```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129   # must match Cargo.lock
./scripts/build-wasm.sh                            # engine -> web/src/wasm, web/public/wasm
cd web && npm install && npm run dev
cargo test -p hive-engine                          # rules tests
```
The generated WASM is committed, so the Vercel build only runs `next build` in `web/`.

### Online play
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `web/.env.production`) and apply `supabase/migrations/*.sql`. Each player's browser holds a secret seat token; the database stores only its hash, and all writes go through token-checked functions.

### Training the Expert AI
See [training/README.md](training/README.md). Self-play runs locally in Rust, training in PyTorch; the exported model goes in `web/public/models/`.

## Credits
Hive is designed by John Yianni and published by Gen42 Games. Rules test data comes from Mzinga by Jon Thysell (MIT).
