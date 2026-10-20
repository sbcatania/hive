pub mod hex;
pub mod pieces;
pub mod game;
pub mod notation;

pub use game::{Game, GameState, Move, Rules};
pub use hex::Cell;
pub use pieces::{Bug, Color, PieceId};

#[cfg(feature = "wasm")]
pub mod wasm;

/// Counts leaf nodes of the move tree to `depth` (for validating move generation).
pub fn perft(g: &mut Game, depth: u32) -> u64 {
    if depth == 0 {
        return 1;
    }
    let moves = g.legal_moves();
    if depth == 1 {
        return moves.len() as u64;
    }
    let mut n = 0;
    for m in moves {
        g.play_unchecked(m);
        n += perft(g, depth - 1);
        g.undo();
    }
    n
}
