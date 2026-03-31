/// AI module — computer opponents for the Hive game.
///
/// Provides two search algorithms:
/// - Minimax with alpha-beta pruning (classical, deterministic)
/// - Monte Carlo Tree Search (exploratory, probabilistic)
///
/// Both use a shared evaluation function to score board positions.

pub mod eval;
pub mod minimax;
pub mod mcts;
pub mod difficulty;
