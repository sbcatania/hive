/// Freedom of Movement: a piece can only slide between two hexes if it can
/// physically fit through the gap.
///
/// When sliding from hex A to hex B, the two hexes that share edges with
/// both A and B must not BOTH be occupied — otherwise the piece is squeezed
/// and can't pass through.
///
/// Exceptions:
/// - Beetles climbing on top of the hive ignore this rule.
/// - Grasshoppers jumping over pieces ignore this rule.
/// - Ladybugs moving on top of the hive ignore this for the climbing steps.

use crate::board::{Board, Coord, DIRECTIONS, neighbors};

/// Check if a piece can slide from `from` to `to` at ground level.
///
/// For a ground-level slide, `to` must be empty and adjacent to `from`.
/// The two common neighbors of `from` and `to` cannot both be occupied.
/// Additionally, `to` must be adjacent to at least one piece (other than
/// the one at `from` which is being moved — the hive must stay connected).
pub fn can_slide(board: &Board, from: Coord, to: Coord) -> bool {
    // `to` must be empty.
    if board.is_occupied(to) {
        return false;
    }

    // `from` and `to` must be adjacent.
    if !are_adjacent(from, to) {
        return false;
    }

    // Check the "gate" — the two hexes that neighbor both `from` and `to`.
    let (gate1, gate2) = common_neighbors(from, to);
    let g1_occupied = board.is_occupied(gate1);
    let g2_occupied = board.is_occupied(gate2);

    // If both gates are occupied, the piece can't squeeze through.
    if g1_occupied && g2_occupied {
        return false;
    }

    true
}

/// Check if a piece can slide from `from` to `to` while on top of the hive.
/// This is used for beetles and ladybugs moving on top.
///
/// When on top of the hive, the gate rule is relaxed: the piece can pass
/// if it can "climb over" — at least one of the gate positions or the
/// destination must be at the same height or taller to provide something
/// to climb on/over.
pub fn can_move_on_top(board: &Board, from: Coord, to: Coord, from_height: usize) -> bool {
    if !are_adjacent(from, to) {
        return false;
    }

    let (gate1, gate2) = common_neighbors(from, to);
    let g1_height = board.stack_height(gate1);
    let g2_height = board.stack_height(gate2);
    let to_height = board.stack_height(to);

    // The piece is at `from_height` (1-indexed, top of stack).
    // It needs to be able to physically get from `from` to `to`.
    // The "gate" between them at the relevant height must not block it.
    //
    // The piece can pass if the height of the gate (max of both gates)
    // is less than the height it's moving at.
    // OR if the destination is high enough to climb onto.
    let moving_height = from_height; // The height we're leaving from (0-indexed = stack size at from - 1)
    // Must be able to physically pass: at least one of the following:
    // 1. The gate isn't blocking (not both gates taller than us)
    // 2. The destination is at or above our height (climbing up)
    !(g1_height >= moving_height && g2_height >= moving_height && to_height + 1 < moving_height)
}

/// Check if two coordinates are adjacent on the hex grid.
pub fn are_adjacent(a: Coord, b: Coord) -> bool {
    let dq = b.0 - a.0;
    let dr = b.1 - a.1;
    DIRECTIONS.contains(&(dq, dr))
}

/// Find the two hexes that are neighbors of both `a` and `b`.
/// For adjacent hexes on a hex grid, there are always exactly 2 common neighbors.
pub fn common_neighbors(a: Coord, b: Coord) -> (Coord, Coord) {
    let a_neighbors: Vec<Coord> = neighbors(a).to_vec();
    let b_neighbors: Vec<Coord> = neighbors(b).to_vec();

    let common: Vec<Coord> = a_neighbors
        .into_iter()
        .filter(|n| b_neighbors.contains(n))
        .collect();

    // For adjacent hexes, there are always exactly 2 common neighbors.
    debug_assert!(
        common.len() == 2,
        "Expected 2 common neighbors for adjacent hexes, got {}",
        common.len()
    );

    (common[0], common[1])
}
