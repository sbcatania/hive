# Training the Expert AI

The website's **Expert** level uses a small residual network (policy + value) inside an AlphaZero-style MCTS. Training happens on your own computer; the website only downloads the finished weights (`web/public/models/hive-net.bin`, ~300 KB).

How the pieces fit together:

| Step | Where | What |
|---|---|---|
| Self-play | Rust (`target/release/selfplay`) | Plays games and writes positions, search targets and results to `training/data/genN/*.bin`. Generation 0 uses the alpha-beta engine; later generations use MCTS with the current network. |
| Training | Python / PyTorch (`hive_train.train`) | Trains on a sliding window of recent generations, writes `runs/genN/model.pt` and the engine format `runs/genN/hive-net.bin`. |
| Gating | Rust (`target/release/arena`) | Plays the new network against the current best; it's promoted to `runs/best/` if it scores at least 50%. |
| Install | `hive_train.loop --install` | Copies `runs/best/hive-net.bin` into `web/public/models/` and points `manifest.json` at it. Commit and push to deploy. |

Position encoding lives only in Rust (`engine/src/features.rs`), so Python never has to reproduce Hive rules.

## Setup

```bash
# from the repo root
export PATH="$HOME/.cargo/bin:$PATH"
cargo build --release --features native --bin selfplay --bin arena --bin nncheck

cd training
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # a CUDA or Apple-silicon (MPS) build of torch is used automatically if present
```

Sanity check that the Rust and PyTorch networks agree (needs some self-play data first):

```bash
../target/release/selfplay --games 4 --out data/check
python -m hive_train.check data/check/$(ls data/check | head -1)
```

## Run the loop

```bash
python -m hive_train.loop --generations 10 --games 400
python -m hive_train.loop --install       # put the best network on the website
cd .. && git add web/public/models && git commit -m "Update Expert network" && git push
```

Resume an interrupted run with `--start N` (existing `data/genN` folders are reused). Useful knobs:

- `--games` games per generation (more = better data, slower). 400 is a reasonable start; strong play needs thousands per generation.
- `--sims` MCTS simulations per move in self-play (default 200).
- `--channels`, `--blocks` network size (default 32 x 4). Bigger networks are stronger but slower in the browser; keep a browser move under about 3 seconds.
- `--threads` self-play threads (default: all cores).

Rough cost on an 8-core laptop: generation 0 (alpha-beta) about 6 s per game per core; MCTS generations about 10-20 s per game per core; training a few minutes per generation on CPU.

## Measuring strength

```bash
../target/release/arena expert hard 40 2000 --net runs/best/hive-net.bin
```

prints wins/losses/draws of the network against the Hard level at 2 s per move. Only install a network that beats Hard; otherwise the site's Expert level is better off with its alpha-beta fallback (what it uses when `manifest.json` has `"file": null`).
