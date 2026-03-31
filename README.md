# Hive

Play the board game [Hive](https://www.gen42.com/games/hive) against the computer or a friend — right in your browser.

**[Play now](https://hive-sbcatania.vercel.app)**

## Features

- **Full Hive rules** — all 5 base pieces (Queen Bee, Beetle, Spider, Grasshopper, Soldier Ant) with proper One Hive Rule and Freedom of Movement validation
- **3 expansion packs** — Mosquito, Ladybug, and Pillbug, each toggleable independently
- **2 AI engines** — Minimax with alpha-beta pruning and Monte Carlo Tree Search, both running entirely client-side via WebAssembly
- **5 difficulty levels** — Beginner through Expert, plus an Adaptive mode that adjusts based on your win/loss history
- **Configurable rules** — Tournament opening, queen placement deadline, undo modes, time controls, custom piece counts
- **3 visual themes** — Clean (bug emoji icons), Minimal (letter abbreviations), and Polished (textured with animations)
- **Pass-and-play** — play against a friend on the same device
- **Game presets** — Standard, Tournament, All Expansions, individual expansion configs, and fully Custom

## Architecture

```
hive/
├── engine/     Rust crate — game rules, move generation, AI (compiles to WASM)
├── training/   Rust binary — local self-play RL + opening book generation
└── web/        Next.js frontend — SVG hex grid, themes, game setup
```

The game engine is written in **Rust** and compiled to **WebAssembly** using `wasm-pack`. All game logic and AI run entirely in the browser — no server costs. The frontend is a **Next.js** static site deployed to **Vercel**.

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
- [Node.js](https://nodejs.org/) 20+

### Setup

```bash
# Build the WASM engine
npm run build:wasm

# Start the dev server
npm run dev

# Run Rust tests
npm test

# Build for production
npm run build
```

### Training (local only)

```bash
# Run self-play reinforcement learning
npm run train
```

Training runs as a native Rust binary and produces evaluation weights (`training/data/weights.json`) and an opening book (`training/data/openings.json`) that the web AI uses.

## Game Rules

Hive is an abstract strategy game where players take turns placing and moving bug tiles to surround the opponent's Queen Bee. There is no board — pieces form the playing surface as they are placed.

- **Queen Bee** — moves 1 space; must be placed by your 4th turn
- **Beetle** — moves 1 space; can climb on top of other pieces
- **Spider** — moves exactly 3 spaces along the hive perimeter
- **Grasshopper** — jumps in a straight line over pieces
- **Soldier Ant** — moves any number of spaces along the perimeter
- **Mosquito** (expansion) — copies the movement of any adjacent piece
- **Ladybug** (expansion) — moves 2 on top of the hive, then 1 down
- **Pillbug** (expansion) — moves like Queen, or throws an adjacent piece over itself

**Win condition:** Completely surround the opponent's Queen Bee on all 6 sides.

## License

MIT
