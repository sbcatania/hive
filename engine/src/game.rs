/// The main game state — owns the board, player hands, turn counter, and history.
///
/// This is the central struct that the UI interacts with.
/// It handles turn progression, move application, undo, and win/draw detection.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::board::{Board, Coord, neighbors};
use crate::moves::{Move, all_legal_moves, color_index};
use crate::piece::{Color, Piece, PieceType};
use crate::rules::{RuleConfig, UndoMode};

/// The outcome of the game.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameStatus {
    InProgress,
    WhiteWins,
    BlackWins,
    Draw,
}

/// Complete game state.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GameState {
    /// The hex grid with all placed pieces.
    pub board: Board,
    /// Unplaced pieces for each player. Index 0 = White, 1 = Black.
    /// Maps piece type to remaining count.
    pub hands: [HashMap<PieceType, u8>; 2],
    /// Total number of half-turns elapsed (increments each time any player acts).
    pub turn: u16,
    /// Whose turn is it?
    pub current_player: Color,
    /// Rule configuration for this game.
    pub rules: RuleConfig,
    /// Move history (for undo).
    pub history: Vec<HistoryEntry>,
    /// Future moves (for redo after undo).
    pub redo_stack: Vec<HistoryEntry>,
    /// The last move made by the opponent (used for Pillbug restriction).
    pub last_move: Option<Move>,
    /// Current game status.
    pub status: GameStatus,
    /// Time remaining for each player in seconds (if timed).
    pub time_remaining: [Option<f64>; 2],
}

/// An entry in the move history, storing enough info to undo the move.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub action: Move,
    pub player: Color,
    /// Snapshot of the previous last_move (needed for undo).
    pub prev_last_move: Option<Move>,
}

impl GameState {
    /// Create a new game with the given rules.
    pub fn new(rules: RuleConfig) -> Self {
        let hands = [
            Self::create_hand(&rules, Color::White),
            Self::create_hand(&rules, Color::Black),
        ];

        let time_remaining = [
            rules.time_control.map(|t| t as f64),
            rules.time_control.map(|t| t as f64),
        ];

        GameState {
            board: Board::new(),
            hands,
            turn: 0,
            current_player: Color::White,
            rules,
            history: Vec::new(),
            redo_stack: Vec::new(),
            last_move: None,
            status: GameStatus::InProgress,
            time_remaining,
        }
    }

    /// Build a hand (unplaced pieces) for a player based on the rules.
    fn create_hand(rules: &RuleConfig, _color: Color) -> HashMap<PieceType, u8> {
        let mut hand = HashMap::new();
        for piece_type in rules.available_piece_types() {
            let count = rules.count_for(piece_type);
            if count > 0 {
                hand.insert(piece_type, count);
            }
        }
        hand
    }

    /// How many turns has this specific player taken?
    /// (Each "turn" in our numbering is a half-turn, so player turn = ceil(turn/2) for White).
    pub fn player_turn_number(&self, color: Color) -> u8 {
        let half_turns = self.turn as u8;
        match color {
            Color::White => (half_turns / 2) + 1,
            Color::Black => ((half_turns + 1) / 2) + if half_turns == 0 { 0 } else { 0 },
        }
    }

    /// Has the given player placed their Queen on the board?
    pub fn has_placed_queen(&self, color: Color) -> bool {
        let idx = color_index(color);
        let queen_in_hand = self.hands[idx].get(&PieceType::Queen).copied().unwrap_or(0);
        queen_in_hand == 0
    }

    /// Get all legal moves for the current player.
    pub fn legal_moves(&self) -> Vec<Move> {
        if self.status != GameStatus::InProgress {
            return Vec::new();
        }
        all_legal_moves(self)
    }

    /// Apply a move to the game state.
    /// Returns an error message if the move is illegal.
    pub fn apply_move(&mut self, action: Move) -> Result<(), String> {
        if self.status != GameStatus::InProgress {
            return Err("Game is already over".to_string());
        }

        // Save state for undo.
        let history_entry = HistoryEntry {
            action: action.clone(),
            player: self.current_player,
            prev_last_move: self.last_move.clone(),
        };

        match &action {
            Move::Place { piece_type, to } => {
                self.apply_placement(*piece_type, *to)?;
            }
            Move::Move { from, to } => {
                self.apply_movement(*from, *to)?;
            }
            Move::PillbugThrow { pillbug_at: _, target, to } => {
                self.apply_pillbug_throw(*target, *to)?;
            }
            Move::Pass => {
                // Just pass — no board changes.
            }
        }

        // Record history.
        self.history.push(history_entry);
        self.redo_stack.clear(); // New move clears redo stack.

        // Update last move (for Pillbug restriction).
        self.last_move = Some(action);

        // Advance turn.
        self.current_player = self.current_player.opponent();
        self.turn += 1;

        // Check for win/draw.
        self.update_status();

        Ok(())
    }

    /// Place a piece from the current player's hand onto the board.
    fn apply_placement(&mut self, piece_type: PieceType, to: Coord) -> Result<(), String> {
        let idx = color_index(self.current_player);
        let count = self.hands[idx].get(&piece_type).copied().unwrap_or(0);
        if count == 0 {
            return Err(format!("No {:?} pieces left in hand", piece_type));
        }

        // Create the piece with the next available ID.
        let total = self.rules.count_for(piece_type);
        let id = total - count;
        let piece = Piece::new(piece_type, self.current_player, id);

        // Place on board.
        self.board.place(to, piece);

        // Remove from hand.
        *self.hands[idx].get_mut(&piece_type).unwrap() -= 1;

        Ok(())
    }

    /// Move a piece on the board from one hex to another.
    fn apply_movement(&mut self, from: Coord, to: Coord) -> Result<(), String> {
        let piece = self.board.remove_top(from)
            .ok_or_else(|| format!("No piece at {:?}", from))?;

        if piece.color != self.current_player {
            // Put it back.
            self.board.place(from, piece);
            return Err("Cannot move opponent's piece".to_string());
        }

        self.board.place(to, piece);
        Ok(())
    }

    /// Execute a Pillbug throw: move target piece to destination.
    fn apply_pillbug_throw(&mut self, target: Coord, to: Coord) -> Result<(), String> {
        let piece = self.board.remove_top(target)
            .ok_or_else(|| format!("No piece at {:?}", target))?;

        self.board.place(to, piece);
        Ok(())
    }

    /// Check if either queen is surrounded and update game status.
    fn update_status(&mut self) {
        let white_queen_surrounded = self.is_queen_surrounded(Color::White);
        let black_queen_surrounded = self.is_queen_surrounded(Color::Black);

        self.status = match (white_queen_surrounded, black_queen_surrounded) {
            (true, true) => GameStatus::Draw,
            (true, false) => GameStatus::BlackWins,
            (false, true) => GameStatus::WhiteWins,
            (false, false) => GameStatus::InProgress,
        };
    }

    /// Is the given player's queen completely surrounded (all 6 neighbors occupied)?
    fn is_queen_surrounded(&self, color: Color) -> bool {
        // Find the queen on the board.
        let queen = Piece::new(PieceType::Queen, color, 0);
        let coord = match self.board.find_piece_any_depth(&queen) {
            Some(c) => c,
            None => return false, // Queen not placed yet.
        };

        // Check all 6 neighbors.
        neighbors(coord).iter().all(|&n| self.board.is_occupied(n))
    }

    /// Undo the last move (if undo is allowed by the rules).
    pub fn undo(&mut self) -> Result<(), String> {
        match self.rules.undo_mode {
            UndoMode::None => return Err("Undo is not allowed in this game".to_string()),
            UndoMode::LastMoveOnly => {
                if self.history.len() > 1 && self.redo_stack.len() >= 1 {
                    return Err("Can only undo the very last move".to_string());
                }
            }
            UndoMode::FullUndoRedo => {} // Always allowed.
        }

        let entry = self.history.pop()
            .ok_or_else(|| "No moves to undo".to_string())?;

        // Reverse the move.
        match &entry.action {
            Move::Place { piece_type, to } => {
                // Remove from board, add back to hand.
                self.board.remove_top(*to);
                let idx = color_index(entry.player);
                *self.hands[idx].entry(*piece_type).or_insert(0) += 1;
            }
            Move::Move { from, to } => {
                // Move piece back.
                let piece = self.board.remove_top(*to).unwrap();
                self.board.place(*from, piece);
            }
            Move::PillbugThrow { pillbug_at: _, target, to } => {
                // Move thrown piece back.
                let piece = self.board.remove_top(*to).unwrap();
                self.board.place(*target, piece);
            }
            Move::Pass => {} // Nothing to undo.
        }

        // Restore state.
        self.last_move = entry.prev_last_move.clone();
        self.current_player = entry.player;
        self.turn -= 1;
        self.status = GameStatus::InProgress; // Undo always returns to in-progress.

        // Save for redo.
        self.redo_stack.push(entry);

        Ok(())
    }

    /// Redo a previously undone move.
    pub fn redo(&mut self) -> Result<(), String> {
        if self.rules.undo_mode != UndoMode::FullUndoRedo {
            return Err("Redo is not available in this undo mode".to_string());
        }

        let entry = self.redo_stack.pop()
            .ok_or_else(|| "No moves to redo".to_string())?;

        // Re-apply the move without clearing the redo stack.
        let action = entry.action.clone();
        match &action {
            Move::Place { piece_type, to } => {
                self.apply_placement(*piece_type, *to)?;
            }
            Move::Move { from, to } => {
                self.apply_movement(*from, *to)?;
            }
            Move::PillbugThrow { pillbug_at: _, target, to } => {
                self.apply_pillbug_throw(*target, *to)?;
            }
            Move::Pass => {}
        }

        self.history.push(entry);
        self.last_move = Some(action);
        self.current_player = self.current_player.opponent();
        self.turn += 1;
        self.update_status();

        Ok(())
    }

    /// Get the number of pieces a player has remaining in hand for a given type.
    pub fn pieces_in_hand(&self, color: Color, piece_type: PieceType) -> u8 {
        let idx = color_index(color);
        self.hands[idx].get(&piece_type).copied().unwrap_or(0)
    }

    /// Get total pieces in a player's hand.
    pub fn total_in_hand(&self, color: Color) -> u8 {
        let idx = color_index(color);
        self.hands[idx].values().sum()
    }
}
