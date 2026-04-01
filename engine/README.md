# Hive Engine

Rust crate implementing the complete Hive board game: rules, move generation, and AI. Compiles to both native (for tests and training) and WebAssembly (for the browser).

## Architecture

### Core Modules

| Module | Purpose |
|--------|---------|
| `board.rs` | Hex grid using **axial coordinates** `(q, r)`. No fixed board -- pieces form the playing surface. Positions hold stacks (for beetles climbing). |
| `piece.rs` | The 8 piece types (`PieceType` enum), player colors (`Color`), and the `Piece` struct (type + color + id). |
| `moves.rs` | Legal move generation. The `Move` enum has three variants: `Place`, `Move`, and `PillbugThrow`. Each piece type has its own movement logic. |
| `game.rs` | `GameState` -- the central struct. Owns the board, player hands, turn counter, move history (undo/redo), time tracking, and win/draw detection. |
| `rules.rs` | `RuleConfig` -- all toggleable game settings: expansions, tournament opening, queen deadline, undo mode, time controls, custom piece counts. |
| `hive_check.rs` | **One Hive Rule** -- ensures removing a piece doesn't disconnect the hive (articulation point detection). |
| `freedom.rs` | **Freedom of Movement** -- validates that a piece can physically slide through gaps between adjacent pieces. |
| `wasm.rs` | WASM bindings via `wasm-bindgen`. All data crosses the boundary as JSON strings. |

### AI (`src/ai/`)

| Module | Purpose |
|--------|---------|
| `eval.rs` | Heuristic board evaluation. Scores positions based on queen safety, piece mobility, attacker positioning, and material. Weights are tunable via `EvalWeights`. |
| `minimax.rs` | **Minimax with alpha-beta pruning.** Iterative deepening with move ordering. Uses a node count limit (not wall-clock time) for WASM compatibility. |
| `mcts.rs` | **Monte Carlo Tree Search.** UCB1 selection, random playouts, backpropagation. Better for high branching factor positions where minimax struggles. |
| `difficulty.rs` | Maps difficulty levels (Beginner through Expert + Adaptive) to search parameters. Adaptive mode adjusts based on recent win/loss history. |

### How the AI Works

Both engines receive a `GameState` and return a chosen `Move`:

- **Minimax** explores the game tree to a fixed depth, using alpha-beta pruning to skip branches that cannot improve the result. Move ordering (checking captures and queen-threatening moves first) improves pruning efficiency. Iterative deepening searches depth 1, then 2, etc., staying within a node budget.

- **MCTS** builds a search tree incrementally: select a promising leaf (UCB1 balances exploration/exploitation), expand it, simulate a random game to completion, and backpropagate the result. After the simulation budget is exhausted, it picks the most-visited child. This works well when the evaluation function is imperfect.

The **evaluation function** (`eval.rs`) scores positions by:
- Queen danger: how many of the 6 neighbors around each queen are occupied
- Mobility: number of legal moves available to each player
- Attacker positioning: beetles and ants near the opponent's queen
- Material: pieces remaining in hand

## Coordinate System

The board uses axial hex coordinates `(q, r)` with 6 directions:

```text
      NW(0,-1)  NE(+1,-1)
  W(-1,0)   *   E(+1,0)
      SW(-1,+1) SE(0,+1)
```

`Coord` is a type alias for `(i32, i32)`.

## Key Types

```rust
// A game action
enum Move {
    Place { piece_type: PieceType, to: Coord },
    Move { from: Coord, to: Coord },
    PillbugThrow { pillbug_at: Coord, target: Coord, to: Coord },
    Pass,
}

// Complete game state
struct GameState {
    board: Board,
    hands: [HashMap<PieceType, u8>; 2],
    turn: u16,
    current_player: Color,
    rules: RuleConfig,
    history: Vec<HistoryEntry>,
    // ...
}
```

## WASM Interface

The `wasm.rs` module exposes these functions to JavaScript (all take/return JSON strings):

- `create_game(rules_json)` -- Create a new game with given rules
- `get_legal_moves(state_json)` -- Get all legal moves for the current player
- `apply_move(state_json, move_json)` -- Apply a move, return updated state
- `ai_move(state_json, config_json)` -- Ask the AI to choose a move

The frontend calls these from a Web Worker to avoid blocking the UI thread.

## Adding a New Piece Type

1. Add a variant to `PieceType` in `piece.rs`
2. Add its movement logic in `moves.rs` (implement a `fn piece_moves(...)` and wire it into the match in `all_legal_moves`)
3. If it has special restrictions, update `hive_check.rs` or `freedom.rs`
4. Add a default count in `rules.rs` (in the `RuleConfig` defaults and any relevant presets)
5. Update the evaluation weights in `ai/eval.rs` if the piece has unique strategic value
6. Add test cases in `tests/`

## Testing

```bash
# Run all tests
cargo test

# Run a specific test file
cargo test --test game_tests
cargo test --test rule_tests

# Run from the project root via npm
npm test
```

Tests live in `tests/game_tests.rs` and `tests/rule_tests.rs`. They cover move generation, rule enforcement, game flow, and edge cases.

## Building

```bash
# Build as WASM (output: web/public/wasm/)
wasm-pack build --target web --out-dir ../web/public/wasm

# Or from the project root:
npm run build:wasm
```

The crate produces both `cdylib` (for WASM) and `rlib` (for native use by the training binary).
