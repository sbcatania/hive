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
- **Analysis mode** — chess.com-style move classification (Brilliant/Best/Good/Inaccuracy/Mistake/Blunder), win probability bar, position stats (queen safety, mobility, piece counts)
- **Game recording** — auto-saves games to localStorage, export as `.hive` files, import and replay with step-by-step controls
- **Training CLI** — evolve custom AI models through self-play genetic algorithm, then load them in the browser
- **Stacked piece visualization** — visual depth indicators for beetles on top of other pieces
- **Undo/redo** — full undo/redo with AI pause after undo, Escape key and click-to-deselect

## Tech Stack

- **Engine:** Rust, compiled to WebAssembly via `wasm-pack`
- **Frontend:** Next.js (React), TypeScript, Tailwind CSS
- **Deployment:** Vercel (static export)
- **AI:** Minimax with alpha-beta pruning, Monte Carlo Tree Search — all client-side

## Architecture

```
hive/
├── engine/              Rust crate — game rules, move generation, AI (compiles to WASM)
│   └── src/
│       ├── board.rs       Hex grid with axial coordinates, piece stacking
│       ├── piece.rs       Piece types (8 bugs), colors, identifiers
│       ├── moves.rs       Legal move generation per piece type
│       ├── game.rs        Game state, turn logic, undo/redo, win detection
│       ├── rules.rs       Rule configuration and presets
│       ├── hive_check.rs  One Hive Rule validation
│       ├── freedom.rs     Freedom of Movement validation
│       ├── ai/            AI engines (minimax, MCTS, evaluation, difficulty)
│       ├── wasm.rs        WASM bindings (JSON serialization across the boundary)
│       └── bin/train.rs   Training CLI binary (genetic algorithm self-play)
├── models/              Trained model weights (JSON) and example games (.hive)
└── web/                 Next.js frontend
    └── src/
        ├── app/           Next.js app router pages
        ├── components/    React components (board/, game/, setup/, ui/)
        ├── hooks/         Custom hooks (useGameEngine — WASM bridge)
        ├── lib/           Shared utilities, types, and game recorder
        ├── themes/        Visual theme definitions (Clean, Minimal, Polished)
        └── workers/       Web Worker for off-main-thread AI computation
```

All game logic and AI run entirely in the browser via WebAssembly — no server required. The frontend is a Next.js static site deployed to Vercel.

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
- [Node.js](https://nodejs.org/) 20+

### Quick Start

```bash
# Clone and install
git clone https://github.com/your-username/hive.git
cd hive && cd web && npm install && cd ..

# Build the WASM engine (outputs to web/public/wasm/)
npm run build:wasm

# Start the Next.js dev server (also rebuilds WASM)
npm run dev
# Open http://localhost:3000
```

### All Commands

| Command | Description |
|---------|-------------|
| `npm run build:wasm` | Compile Rust engine to WASM (`web/public/wasm/`) |
| `npm run dev` | Build WASM + start Next.js dev server |
| `npm run build` | Full production build (WASM + Next.js static export) |
| `npm test` | Run Rust engine tests (`cargo test`) |
| `npm run train -- --name my-model` | Train a custom AI model via self-play |

### Training Custom AI Models

Train your own AI by evolving evaluation weights through self-play:

```bash
# Basic training (1000 games, population 20)
cargo run --bin train -- --name my-model --games 1000

# Larger training with saved example games
cargo run --bin train -- --name strong-ai --games 5000 --population 30 --save-games
```

**Options:**
- `--name <name>` (required) — model name, saved to `models/<name>.json`
- `--games <count>` — total games budget (default: 1000)
- `--population <size>` — population size per generation (default: 20)
- `--save-games` — save 5 example games as `.hive` files for replay

**Using trained models:** In the game setup UI, click "Load Model" under Computer Opponent and select your `models/<name>.json` file. The AI will use your trained weights instead of the defaults.

**Replaying training games:** Import `.hive` files from `models/<name>-games/` using the "Import .hive File" button on the setup screen.

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

## Deployment

The project is deployed as a static site on [Vercel](https://vercel.com). The build command (`npm run build`) compiles the WASM engine and then exports the Next.js app as static HTML/JS. No server-side runtime is needed.

Configuration is in `vercel.json` at the project root.

## License

MIT
