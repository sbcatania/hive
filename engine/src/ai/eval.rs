/// Board evaluation heuristic for the AI.
///
/// Scores a board position from the perspective of a given player.
/// Positive = good for that player, negative = bad.
///
/// Key factors:
/// - Queen safety (how many neighbors around each queen)
/// - Piece mobility (how many legal moves each player has)
/// - Piece positioning (attackers near opponent's queen)
/// - Material in hand

use crate::board::{Board, neighbors};
use crate::game::{GameState, GameStatus};
use crate::moves::{all_legal_moves, color_index};
use crate::piece::{Color, PieceType};

/// Evaluation weights — can be tuned by the training system.
#[derive(Clone, Debug)]
pub struct EvalWeights {
    /// How bad it is to have neighbors around your queen (per neighbor).
    pub queen_danger_per_neighbor: f64,
    /// How good it is to have neighbors around opponent's queen.
    pub queen_attack_per_neighbor: f64,
    /// Value of each legal move available.
    pub mobility_per_move: f64,
    /// Value of having pieces still in hand (ready to place).
    pub hand_piece_value: f64,
    /// Bonus for having a beetle adjacent to opponent's queen.
    pub beetle_near_queen_bonus: f64,
    /// Bonus for having an ant on the board (very mobile piece).
    pub ant_on_board_bonus: f64,
}

impl Default for EvalWeights {
    fn default() -> Self {
        EvalWeights {
            queen_danger_per_neighbor: -15.0,
            queen_attack_per_neighbor: 20.0,
            mobility_per_move: 0.5,
            hand_piece_value: 1.0,
            beetle_near_queen_bonus: 10.0,
            ant_on_board_bonus: 3.0,
        }
    }
}

/// Evaluate the board position for the given player.
/// Returns a score: positive is good, negative is bad.
/// Returns +/- infinity for wins/losses.
pub fn evaluate(state: &GameState, player: Color, weights: &EvalWeights) -> f64 {
    // Terminal states.
    match &state.status {
        GameStatus::WhiteWins => {
            return if player == Color::White { f64::INFINITY } else { f64::NEG_INFINITY };
        }
        GameStatus::BlackWins => {
            return if player == Color::Black { f64::INFINITY } else { f64::NEG_INFINITY };
        }
        GameStatus::Draw => return 0.0,
        GameStatus::InProgress => {}
    }

    let opponent = player.opponent();
    let mut score = 0.0;

    // Queen safety: count neighbors around each queen.
    score += queen_neighbor_score(&state.board, player, weights);
    score += queen_neighbor_score_opponent(&state.board, opponent, weights);

    // Mobility: count legal moves for each side.
    // (This is expensive — we generate all moves for both players.)
    let our_moves = count_moves_for_player(state, player);
    let their_moves = count_moves_for_player(state, opponent);
    score += (our_moves as f64 - their_moves as f64) * weights.mobility_per_move;

    // Material in hand.
    let our_hand: u8 = state.hands[color_index(player)].values().sum();
    let their_hand: u8 = state.hands[color_index(opponent)].values().sum();
    score += (our_hand as f64 - their_hand as f64) * weights.hand_piece_value;

    // Piece-specific bonuses.
    for (coord, piece) in state.board.pieces() {
        if piece.color == player {
            match piece.piece_type {
                PieceType::Ant => score += weights.ant_on_board_bonus,
                PieceType::Beetle => {
                    // Bonus if adjacent to opponent's queen.
                    if is_adjacent_to_queen(&state.board, coord, opponent) {
                        score += weights.beetle_near_queen_bonus;
                    }
                }
                _ => {}
            }
        }
    }

    score
}

/// Score based on how surrounded our queen is (bad).
fn queen_neighbor_score(board: &Board, color: Color, weights: &EvalWeights) -> f64 {
    let queen = crate::piece::Piece::new(PieceType::Queen, color, 0);
    if let Some(coord) = board.find_piece_any_depth(&queen) {
        let occupied_neighbors = neighbors(coord)
            .iter()
            .filter(|&&n| board.is_occupied(n))
            .count();
        occupied_neighbors as f64 * weights.queen_danger_per_neighbor
    } else {
        0.0 // Queen not placed yet.
    }
}

/// Score based on how surrounded opponent's queen is (good for us).
fn queen_neighbor_score_opponent(board: &Board, opponent: Color, weights: &EvalWeights) -> f64 {
    let queen = crate::piece::Piece::new(PieceType::Queen, opponent, 0);
    if let Some(coord) = board.find_piece_any_depth(&queen) {
        let occupied_neighbors = neighbors(coord)
            .iter()
            .filter(|&&n| board.is_occupied(n))
            .count();
        occupied_neighbors as f64 * weights.queen_attack_per_neighbor
    } else {
        0.0
    }
}

/// Check if a coordinate is adjacent to a specific player's queen.
fn is_adjacent_to_queen(board: &Board, coord: crate::board::Coord, queen_color: Color) -> bool {
    let queen = crate::piece::Piece::new(PieceType::Queen, queen_color, 0);
    if let Some(queen_coord) = board.find_piece_any_depth(&queen) {
        crate::freedom::are_adjacent(coord, queen_coord)
    } else {
        false
    }
}

/// Count legal moves for a specific player (temporarily switches perspective).
fn count_moves_for_player(state: &GameState, player: Color) -> usize {
    if state.current_player == player {
        all_legal_moves(state).len()
    } else {
        // Create a temporary state with the player switched.
        let mut temp = state.clone();
        temp.current_player = player;
        all_legal_moves(&temp).len()
    }
}
