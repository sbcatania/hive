/// Legal move generation for each piece type.
///
/// Each piece type has its own movement rules. All moves must also satisfy:
/// 1. One Hive Rule — removing the piece doesn't split the hive
/// 2. Freedom of Movement — the piece can physically slide through gaps
///
/// This module generates all possible destinations for a given piece.

use std::collections::{HashSet, VecDeque};
use crate::board::{Board, Coord, neighbors, DIRECTIONS, neighbor_in_direction};
use crate::freedom::can_slide;
use crate::hive_check::can_remove;
use crate::piece::{Color, PieceType};
use crate::game::GameState;

/// A game action: either placing a new piece or moving one on the board.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Move {
    /// Place a piece from hand onto the board.
    Place { piece_type: PieceType, to: Coord },
    /// Move a piece already on the board.
    Move { from: Coord, to: Coord },
    /// Pillbug special: move an adjacent piece over the pillbug to a new spot.
    PillbugThrow {
        pillbug_at: Coord,
        target: Coord,
        to: Coord,
    },
    /// Pass the turn (only when no legal moves exist).
    Pass,
}

/// Get all legal moves for the current player.
pub fn all_legal_moves(state: &GameState) -> Vec<Move> {
    let mut moves = Vec::new();

    // Placement moves.
    moves.extend(placement_moves(state));

    // Movement moves (only if the player has placed their queen).
    if state.has_placed_queen(state.current_player) {
        moves.extend(movement_moves(state));
    }

    // If no moves available, player must pass.
    if moves.is_empty() {
        moves.push(Move::Pass);
    }

    moves
}

/// Generate all legal placement moves for the current player.
fn placement_moves(state: &GameState) -> Vec<Move> {
    let color = state.current_player;
    let player_idx = color_index(color);
    let hand = &state.hands[player_idx];
    let player_turn = state.player_turn_number(color);

    // Check if we MUST place the queen this turn (deadline enforcement).
    let must_place_queen = if let Some(deadline) = state.rules.queen_deadline {
        player_turn == deadline && !state.has_placed_queen(color)
    } else {
        false
    };

    // Find valid placement positions.
    let positions = valid_placement_positions(state, color);

    let mut moves = Vec::new();
    for (&piece_type, &count) in hand.iter() {
        if count == 0 {
            continue;
        }

        // Tournament opening: can't place Queen on turn 1.
        if piece_type == PieceType::Queen
            && state.rules.tournament_opening
            && player_turn == 1
        {
            continue;
        }

        // If must place queen, only allow queen placement.
        if must_place_queen && piece_type != PieceType::Queen {
            continue;
        }

        for &pos in &positions {
            moves.push(Move::Place { piece_type, to: pos });
        }
    }

    moves
}

/// Find all valid hexes where the current player can place a new piece.
fn valid_placement_positions(state: &GameState, color: Color) -> Vec<Coord> {
    let board = &state.board;

    // First piece: can go anywhere (convention: (0, 0)).
    if board.piece_count() == 0 {
        return vec![(0, 0)];
    }

    // Second piece (first piece of second player): adjacent to the first piece.
    if board.piece_count() == 1 {
        let first_pos = *board.positions().next().unwrap();
        return neighbors(first_pos).to_vec();
    }

    // Normal placement: must be adjacent to at least one friendly piece
    // and NOT adjacent to any enemy piece.
    let empty = board.empty_neighbors();
    empty
        .into_iter()
        .filter(|&pos| {
            let adj = neighbors(pos);
            let touches_friendly = adj.iter().any(|&n| {
                board.top_piece(n).map(|p| p.color == color).unwrap_or(false)
            });
            let touches_enemy = adj.iter().any(|&n| {
                board.top_piece(n).map(|p| p.color != color).unwrap_or(false)
            });
            touches_friendly && !touches_enemy
        })
        .collect()
}

/// Generate all legal movement moves (moving pieces already on the board).
fn movement_moves(state: &GameState) -> Vec<Move> {
    let color = state.current_player;
    let board = &state.board;
    let mut moves = Vec::new();

    // Find all pieces belonging to the current player that are on top of their stack.
    let player_pieces: Vec<(Coord, PieceType)> = board
        .pieces()
        .filter(|(_, piece)| piece.color == color)
        .map(|(coord, piece)| (coord, piece.piece_type))
        .collect();

    for (coord, piece_type) in player_pieces {
        // Check One Hive Rule: can this piece be removed?
        if !can_remove(board, coord) && board.stack_height(coord) == 1 {
            // Piece is an articulation point and not on a stack — can't move.
            // Exception: Pillbug special ability doesn't move the pillbug itself.
            // We handle Pillbug throws separately below.

            // But check if this is a Pillbug that can throw instead of move.
            if piece_type == PieceType::Pillbug || piece_type == PieceType::Mosquito {
                // Pillbug can still use special ability even if pinned.
                // Handled in pillbug_throws below.
            }
            // Skip normal movement for pinned pieces.
            // (Pillbug throws are added separately.)
            add_pillbug_throws(state, coord, piece_type, &mut moves);
            continue;
        }

        // Generate destinations based on piece type.
        let destinations = match piece_type {
            PieceType::Queen => queen_moves(board, coord),
            PieceType::Beetle => beetle_moves(board, coord),
            PieceType::Spider => spider_moves(board, coord),
            PieceType::Grasshopper => grasshopper_moves(board, coord),
            PieceType::Ant => ant_moves(board, coord),
            PieceType::Mosquito => mosquito_moves(board, coord, state),
            PieceType::Ladybug => ladybug_moves(board, coord),
            PieceType::Pillbug => {
                let dests = pillbug_basic_moves(board, coord);
                // Also add pillbug throws.
                add_pillbug_throws(state, coord, PieceType::Pillbug, &mut moves);
                dests
            }
        };

        for dest in destinations {
            moves.push(Move::Move { from: coord, to: dest });
        }
    }

    moves
}

// ─── PIECE-SPECIFIC MOVEMENT ─────────────────────────────────────────

/// Queen Bee: moves exactly 1 space by sliding along the ground.
fn queen_moves(board: &Board, coord: Coord) -> Vec<Coord> {
    sliding_moves(board, coord, 1)
}

/// Beetle: moves 1 space in any direction, can climb on top of other pieces.
fn beetle_moves(board: &Board, coord: Coord) -> Vec<Coord> {
    let height = board.stack_height(coord);
    let mut destinations = Vec::new();

    for neighbor in neighbors(coord) {
        let neighbor_height = board.stack_height(neighbor);

        if neighbor_height == 0 && height == 1 {
            // Moving to empty ground — normal slide check.
            if can_slide(board, coord, neighbor) {
                destinations.push(neighbor);
            }
        } else {
            // Climbing up onto a piece, or climbing down from a stack,
            // or moving on top of the hive.
            // Check if the beetle can physically get there (gate check at height).
            let (g1, g2) = crate::freedom::common_neighbors(coord, neighbor);
            let g1h = board.stack_height(g1);
            let g2h = board.stack_height(g2);

            // The beetle needs to pass at the max of (current height - 1) and dest height.
            // Both gates must not be taller than this passage height.
            let passage_height = (height - 1).max(neighbor_height);
            if !(g1h > passage_height && g2h > passage_height) {
                destinations.push(neighbor);
            }
        }
    }

    destinations
}

/// Spider: moves exactly 3 spaces by sliding along the hive perimeter.
/// Cannot backtrack (visit the same hex twice in one move).
fn spider_moves(board: &Board, coord: Coord) -> Vec<Coord> {
    // BFS for exactly 3 steps of sliding.
    let mut results = HashSet::new();

    // State: (current_position, visited_set, steps_taken)
    let mut queue: VecDeque<(Coord, Vec<Coord>, usize)> = VecDeque::new();
    queue.push_back((coord, vec![coord], 0));

    // Temporarily remove the spider from the board for slide checks.
    let mut temp_board = board.clone();
    temp_board.remove_top(coord);

    while let Some((pos, visited, steps)) = queue.pop_front() {
        if steps == 3 {
            results.insert(pos);
            continue;
        }

        // Try sliding to each neighbor.
        for neighbor in neighbors(pos) {
            if visited.contains(&neighbor) {
                continue;
            }

            // Must slide along the hive (neighbor must be adjacent to at least
            // one other occupied hex besides where we came from).
            if temp_board.is_occupied(neighbor) {
                continue; // Can't move to occupied hex at ground level.
            }

            // Must maintain contact with the hive while sliding.
            let touches_hive = neighbors(neighbor)
                .iter()
                .any(|&n| n != pos && temp_board.is_occupied(n));
            if !touches_hive {
                continue;
            }

            // Freedom of Movement gate check.
            if !can_slide(&temp_board, pos, neighbor) {
                continue;
            }

            let mut new_visited = visited.clone();
            new_visited.push(neighbor);
            queue.push_back((neighbor, new_visited, steps + 1));
        }
    }

    results.into_iter().collect()
}

/// Grasshopper: jumps in a straight line over at least one piece,
/// landing on the first empty hex on the other side.
fn grasshopper_moves(board: &Board, coord: Coord) -> Vec<Coord> {
    let mut destinations = Vec::new();

    for direction in DIRECTIONS {
        let mut current = neighbor_in_direction(coord, direction);

        // Must jump over at least one piece.
        if board.is_empty(current) {
            continue;
        }

        // Keep going in the same direction until we hit an empty hex.
        while board.is_occupied(current) {
            current = neighbor_in_direction(current, direction);
        }

        destinations.push(current);
    }

    destinations
}

/// Soldier Ant: slides any number of spaces along the hive perimeter.
fn ant_moves(board: &Board, coord: Coord) -> Vec<Coord> {
    // BFS along the hive perimeter with no step limit.
    let mut results = HashSet::new();
    let mut visited = HashSet::new();
    visited.insert(coord);

    let mut queue = VecDeque::new();
    queue.push_back(coord);

    // Temporarily remove the ant for slide checks.
    let mut temp_board = board.clone();
    temp_board.remove_top(coord);

    while let Some(pos) = queue.pop_front() {
        for neighbor in neighbors(pos) {
            if visited.contains(&neighbor) {
                continue;
            }

            if temp_board.is_occupied(neighbor) {
                continue;
            }

            // Must stay adjacent to the hive.
            let touches_hive = neighbors(neighbor)
                .iter()
                .any(|&n| temp_board.is_occupied(n));
            if !touches_hive {
                continue;
            }

            // Freedom of Movement check.
            if !can_slide(&temp_board, pos, neighbor) {
                continue;
            }

            visited.insert(neighbor);
            results.insert(neighbor);
            queue.push_back(neighbor);
        }
    }

    results.into_iter().collect()
}

/// Mosquito: copies the movement ability of any adjacent piece.
/// If the Mosquito is on top of the hive (stacked), it moves as a Beetle.
fn mosquito_moves(board: &Board, coord: Coord, _state: &GameState) -> Vec<Coord> {
    let height = board.stack_height(coord);

    // If on top of the hive, can only move as a beetle.
    if height > 1 {
        return beetle_moves(board, coord);
    }

    // Collect all piece types from adjacent pieces.
    let adjacent_types: HashSet<PieceType> = neighbors(coord)
        .iter()
        .filter_map(|&n| board.top_piece(n))
        .map(|p| p.piece_type)
        .collect();

    // If only adjacent to other Mosquitoes, can't move.
    let non_mosquito_types: HashSet<PieceType> = adjacent_types
        .iter()
        .filter(|&&t| t != PieceType::Mosquito)
        .cloned()
        .collect();

    if non_mosquito_types.is_empty() {
        return Vec::new();
    }

    // Union of all movement capabilities.
    let mut all_destinations = HashSet::new();

    for piece_type in non_mosquito_types {
        let dests = match piece_type {
            PieceType::Queen => queen_moves(board, coord),
            PieceType::Beetle => beetle_moves(board, coord),
            PieceType::Spider => spider_moves(board, coord),
            PieceType::Grasshopper => grasshopper_moves(board, coord),
            PieceType::Ant => ant_moves(board, coord),
            PieceType::Ladybug => ladybug_moves(board, coord),
            PieceType::Pillbug => pillbug_basic_moves(board, coord),
            PieceType::Mosquito => Vec::new(), // Can't copy another mosquito
        };
        all_destinations.extend(dests);
    }

    all_destinations.into_iter().collect()
}

/// Ladybug: moves exactly 3 spaces — 2 on top of the hive, then 1 down.
/// Step 1: climb onto an adjacent piece.
/// Step 2: move on top to another piece.
/// Step 3: climb down to an empty space.
fn ladybug_moves(board: &Board, coord: Coord) -> Vec<Coord> {
    let mut results = HashSet::new();

    // Temporarily remove the ladybug.
    let mut temp_board = board.clone();
    temp_board.remove_top(coord);

    // Step 1: climb onto any adjacent occupied hex.
    for step1 in neighbors(coord) {
        if temp_board.is_empty(step1) {
            continue; // Must climb onto a piece.
        }

        // Step 2: move on top to another adjacent occupied hex (different from start).
        for step2 in neighbors(step1) {
            if step2 == coord {
                continue; // Can't go back to start.
            }
            if temp_board.is_empty(step2) {
                continue; // Must stay on top of the hive.
            }

            // Step 3: climb down to an adjacent empty hex.
            for step3 in neighbors(step2) {
                if step3 == coord {
                    continue; // Can't return to start.
                }
                if step3 == step1 {
                    continue; // Can't go back to step 1.
                }
                if temp_board.is_occupied(step3) {
                    continue; // Must land on empty ground.
                }

                // Must be adjacent to the hive after landing.
                let touches_hive = neighbors(step3)
                    .iter()
                    .any(|&n| temp_board.is_occupied(n));
                if touches_hive {
                    results.insert(step3);
                }
            }
        }
    }

    results.into_iter().collect()
}

/// Pillbug: moves like a Queen (1 space sliding).
fn pillbug_basic_moves(board: &Board, coord: Coord) -> Vec<Coord> {
    queen_moves(board, coord)
}

/// Add Pillbug "throw" moves — the special ability to move an adjacent piece.
///
/// The Pillbug can pick up an adjacent, unstacked, non-recently-moved piece
/// and place it on any empty hex adjacent to itself.
fn add_pillbug_throws(
    state: &GameState,
    coord: Coord,
    piece_type: PieceType,
    moves: &mut Vec<Move>,
) {
    // Only Pillbug has this ability (Mosquito can copy it if adjacent to Pillbug).
    let is_pillbug = piece_type == PieceType::Pillbug;
    let is_mosquito_near_pillbug = piece_type == PieceType::Mosquito && {
        neighbors(coord).iter().any(|&n| {
            state.board.top_piece(n).map(|p| p.piece_type == PieceType::Pillbug).unwrap_or(false)
        })
    };

    if !is_pillbug && !is_mosquito_near_pillbug {
        return;
    }

    let board = &state.board;

    // Find adjacent pieces that can be thrown.
    for target in neighbors(coord) {
        if board.is_empty(target) {
            continue;
        }

        // Can't throw stacked pieces (only top piece of height-1 stacks).
        if board.stack_height(target) > 1 {
            continue;
        }

        // Can't throw a piece that just moved (Pillbug restriction).
        if let Some(last) = &state.last_move {
            match last {
                Move::Move { to, .. } if *to == target => continue,
                Move::Place { to, .. } if *to == target => continue,
                Move::PillbugThrow { to, .. } if *to == target => continue,
                _ => {}
            }
        }

        // The target piece must be removable without breaking the hive.
        if !can_remove(board, target) {
            continue;
        }

        // Gate check: the piece must be able to slide up onto the pillbug.
        // Check freedom of movement between target and pillbug position.
        let (g1, g2) = crate::freedom::common_neighbors(target, coord);
        let g1h = board.stack_height(g1);
        let g2h = board.stack_height(g2);
        if g1h > 0 && g2h > 0 {
            continue; // Can't lift through a gate.
        }

        // Find empty hexes adjacent to the pillbug where we can place the piece.
        for dest in neighbors(coord) {
            if dest == target {
                continue; // Can't put it back where it was.
            }
            if board.is_occupied(dest) {
                continue; // Must be empty.
            }

            // Gate check: piece must be able to slide down from pillbug to dest.
            let (dg1, dg2) = crate::freedom::common_neighbors(coord, dest);
            let dg1h = board.stack_height(dg1);
            let dg2h = board.stack_height(dg2);
            // Account for the fact that the target piece has been "lifted" off.
            let dg1h = if dg1 == target { dg1h.saturating_sub(1) } else { dg1h };
            let dg2h = if dg2 == target { dg2h.saturating_sub(1) } else { dg2h };
            if dg1h > 0 && dg2h > 0 {
                continue;
            }

            moves.push(Move::PillbugThrow {
                pillbug_at: coord,
                target,
                to: dest,
            });
        }
    }
}

// ─── HELPERS ─────────────────────────────────────────────────────────

/// Generate sliding moves up to `max_steps` around the hive perimeter.
/// Used by Queen (max_steps=1).
fn sliding_moves(board: &Board, coord: Coord, max_steps: usize) -> Vec<Coord> {
    let mut results = HashSet::new();

    // Temporarily remove the piece.
    let mut temp_board = board.clone();
    temp_board.remove_top(coord);

    let mut visited = HashSet::new();
    visited.insert(coord);

    let mut queue = VecDeque::new();
    queue.push_back((coord, 0));

    while let Some((pos, steps)) = queue.pop_front() {
        if steps >= max_steps {
            continue;
        }

        for neighbor in neighbors(pos) {
            if visited.contains(&neighbor) {
                continue;
            }
            if temp_board.is_occupied(neighbor) {
                continue;
            }

            // Must stay adjacent to the hive.
            let touches_hive = neighbors(neighbor)
                .iter()
                .any(|&n| temp_board.is_occupied(n));
            if !touches_hive {
                continue;
            }

            if !can_slide(&temp_board, pos, neighbor) {
                continue;
            }

            visited.insert(neighbor);
            results.insert(neighbor);
            queue.push_back((neighbor, steps + 1));
        }
    }

    results.into_iter().collect()
}

/// Convert a Color to array index (White=0, Black=1).
pub fn color_index(color: Color) -> usize {
    match color {
        Color::White => 0,
        Color::Black => 1,
    }
}
