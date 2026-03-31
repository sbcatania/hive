/// Hive board game engine.
///
/// This crate contains the complete game logic for Hive, including:
/// - Board representation using axial hex coordinates
/// - All piece movement rules (base game + 3 expansions)
/// - One Hive Rule and Freedom of Movement validation
/// - Game state management, turn logic, and win detection
/// - Rule configuration with presets
/// - AI (minimax and MCTS) — see the `ai` module
/// - WASM bindings for use in the browser

pub mod board;
pub mod piece;
pub mod rules;
pub mod game;
pub mod moves;
pub mod hive_check;
pub mod freedom;
pub mod ai;
pub mod wasm;
