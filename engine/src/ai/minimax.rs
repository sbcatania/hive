/// Minimax search with alpha-beta pruning.
///
/// This is the classical game tree search algorithm. It explores possible moves
/// to a given depth, pruning branches that can't affect the final decision.
///
/// Features:
/// - Alpha-beta pruning for efficiency
/// - Iterative deepening (search depth 1, then 2, etc. until time runs out)
/// - Move ordering (check promising moves first for better pruning)

use crate::ai::eval::{evaluate, EvalWeights};
use crate::game::GameState;
use crate::moves::{Move, all_legal_moves};
use crate::piece::Color;
use std::time::Duration;

/// Maximum nodes to search per depth iteration.
/// This acts as a portable time limit (std::time::Instant doesn't work in WASM).
fn max_nodes_for_duration(time_limit: Duration) -> u64 {
    // Rough calibration: ~5000 nodes/sec in WASM, be conservative.
    let millis = time_limit.as_millis() as u64;
    (millis * 5).max(1000)
}

/// Result of a minimax search.
pub struct SearchResult {
    pub best_move: Move,
    pub score: f64,
    pub depth_reached: u32,
    pub nodes_searched: u64,
}

/// Run iterative deepening minimax search.
///
/// Searches progressively deeper until `max_depth` or node budget is exhausted.
/// Returns the best move found so far.
pub fn search(
    state: &GameState,
    max_depth: u32,
    time_limit: Duration,
    weights: &EvalWeights,
) -> SearchResult {
    let player = state.current_player;
    let node_budget = max_nodes_for_duration(time_limit);

    let mut best_result = SearchResult {
        best_move: Move::Pass,
        score: f64::NEG_INFINITY,
        depth_reached: 0,
        nodes_searched: 0,
    };

    let mut total_nodes = 0u64;

    // Iterative deepening: search at depth 1, 2, 3, ...
    for depth in 1..=max_depth {
        if total_nodes >= node_budget {
            break;
        }

        let mut nodes = 0u64;
        let remaining = node_budget.saturating_sub(total_nodes);
        let result = minimax_root(state, depth, player, weights, remaining, &mut nodes);
        total_nodes += nodes;

        if let Some((best_move, score)) = result {
            best_result = SearchResult {
                best_move,
                score,
                depth_reached: depth,
                nodes_searched: total_nodes,
            };

            // If we found a winning move, stop searching.
            if score == f64::INFINITY {
                break;
            }
        }
    }

    best_result
}

/// Root-level minimax: evaluates each legal move and returns the best one.
fn minimax_root(
    state: &GameState,
    depth: u32,
    player: Color,
    weights: &EvalWeights,
    node_budget: u64,
    nodes: &mut u64,
) -> Option<(Move, f64)> {
    let moves = all_legal_moves(state);
    if moves.is_empty() {
        return None;
    }

    // Order moves to improve pruning (heuristic: placements first, then moves).
    let ordered_moves = order_moves(moves, state);

    let mut best_move = ordered_moves[0].clone();
    let mut best_score = f64::NEG_INFINITY;
    let mut alpha = f64::NEG_INFINITY;
    let beta = f64::INFINITY;

    for action in ordered_moves {
        if *nodes >= node_budget {
            break;
        }

        let mut child = state.clone();
        if child.apply_move(action.clone()).is_err() {
            continue;
        }

        *nodes += 1;
        let score = -minimax(
            &child,
            depth - 1,
            -beta,
            -alpha,
            player.opponent(),
            player,
            weights,
            node_budget,
            nodes,
        );

        if score > best_score {
            best_score = score;
            best_move = action;
        }
        if score > alpha {
            alpha = score;
        }
    }

    Some((best_move, best_score))
}

/// Recursive minimax with alpha-beta pruning (negamax formulation).
fn minimax(
    state: &GameState,
    depth: u32,
    mut alpha: f64,
    beta: f64,
    current: Color,
    maximizing: Color,
    weights: &EvalWeights,
    node_budget: u64,
    nodes: &mut u64,
) -> f64 {
    // Node budget check.
    if *nodes >= node_budget {
        return evaluate(state, current, weights);
    }

    // Base case: reached max depth or game is over.
    if depth == 0 || state.status != crate::game::GameStatus::InProgress {
        let raw_eval = evaluate(state, maximizing, weights);
        // Negate if we're the opponent.
        return if current == maximizing { raw_eval } else { -raw_eval };
    }

    let moves = all_legal_moves(state);
    let ordered_moves = order_moves(moves, state);

    let mut best_score = f64::NEG_INFINITY;

    for action in ordered_moves {
        if *nodes >= node_budget {
            break;
        }

        let mut child = state.clone();
        if child.apply_move(action).is_err() {
            continue;
        }

        *nodes += 1;
        let score = -minimax(
            &child,
            depth - 1,
            -beta,
            -alpha,
            current.opponent(),
            maximizing,
            weights,
            node_budget,
            nodes,
        );

        if score > best_score {
            best_score = score;
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            break; // Beta cutoff.
        }
    }

    best_score
}

/// Order moves heuristically to improve alpha-beta pruning.
/// Better move ordering = more pruning = faster search.
fn order_moves(moves: Vec<Move>, state: &GameState) -> Vec<Move> {
    let mut scored: Vec<(Move, i32)> = moves
        .into_iter()
        .map(|m| {
            let priority = match &m {
                // Moves near the opponent's queen are likely good.
                Move::Move { to, .. } => {
                    if is_near_opponent_queen(state, *to) { 100 } else { 50 }
                }
                // Placing pieces near opponent queen is aggressive.
                Move::Place { to, .. } => {
                    if is_near_opponent_queen(state, *to) { 90 } else { 40 }
                }
                Move::PillbugThrow { .. } => 80,
                Move::Pass => 0,
            };
            (m, priority)
        })
        .collect();

    scored.sort_by(|a, b| b.1.cmp(&a.1));
    scored.into_iter().map(|(m, _)| m).collect()
}

/// Check if a coordinate is adjacent to the opponent's queen.
fn is_near_opponent_queen(state: &GameState, coord: crate::board::Coord) -> bool {
    let opponent = state.current_player.opponent();
    let queen = crate::piece::Piece::new(crate::piece::PieceType::Queen, opponent, 0);
    if let Some(queen_coord) = state.board.find_piece_any_depth(&queen) {
        crate::freedom::are_adjacent(coord, queen_coord)
    } else {
        false
    }
}
