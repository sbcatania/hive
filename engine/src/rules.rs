/// Game rule configuration — everything that can be toggled before a game starts.
///
/// This includes expansion packs, tournament rules, time controls, piece counts, and undo mode.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::piece::PieceType;

/// How undo works in this game.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum UndoMode {
    /// No undo allowed.
    None,
    /// Can only undo the very last move.
    LastMoveOnly,
    /// Full undo/redo history.
    FullUndoRedo,
}

/// Complete game rules configuration.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RuleConfig {
    /// Include the Mosquito expansion piece.
    pub use_mosquito: bool,
    /// Include the Ladybug expansion piece.
    pub use_ladybug: bool,
    /// Include the Pillbug expansion piece.
    pub use_pillbug: bool,
    /// Tournament Opening Rule: Queen cannot be placed on turn 1.
    pub tournament_opening: bool,
    /// The turn number by which the Queen MUST be placed.
    /// `Some(4)` means by your 4th turn. `None` means no deadline.
    pub queen_deadline: Option<u8>,
    /// How undo works.
    pub undo_mode: UndoMode,
    /// Time control in seconds per player. `None` means untimed.
    pub time_control: Option<u32>,
    /// How many of each piece type each player gets.
    /// This allows custom piece counts (e.g., 4 ants instead of 3).
    pub piece_counts: HashMap<PieceType, u8>,
}

impl RuleConfig {
    /// Standard game rules with no expansions.
    pub fn standard() -> Self {
        let mut counts = HashMap::new();
        counts.insert(PieceType::Queen, 1);
        counts.insert(PieceType::Beetle, 2);
        counts.insert(PieceType::Spider, 2);
        counts.insert(PieceType::Grasshopper, 3);
        counts.insert(PieceType::Ant, 3);

        RuleConfig {
            use_mosquito: false,
            use_ladybug: false,
            use_pillbug: false,
            tournament_opening: false,
            queen_deadline: Some(4),
            undo_mode: UndoMode::LastMoveOnly,
            time_control: None,
            piece_counts: counts,
        }
    }

    /// Tournament rules: standard + tournament opening + all expansions.
    pub fn tournament() -> Self {
        let mut config = Self::all_expansions();
        config.tournament_opening = true;
        config
    }

    /// Standard game with all three expansions enabled.
    pub fn all_expansions() -> Self {
        let mut config = Self::standard();
        config.use_mosquito = true;
        config.use_ladybug = true;
        config.use_pillbug = true;
        config.piece_counts.insert(PieceType::Mosquito, 1);
        config.piece_counts.insert(PieceType::Ladybug, 1);
        config.piece_counts.insert(PieceType::Pillbug, 1);
        config
    }

    /// Get the count for a piece type. Returns 0 if not in the game.
    pub fn count_for(&self, piece_type: PieceType) -> u8 {
        // Expansion pieces are only available if their expansion is enabled.
        match piece_type {
            PieceType::Mosquito if !self.use_mosquito => 0,
            PieceType::Ladybug if !self.use_ladybug => 0,
            PieceType::Pillbug if !self.use_pillbug => 0,
            _ => *self.piece_counts.get(&piece_type).unwrap_or(&0),
        }
    }

    /// All piece types available in this game configuration.
    pub fn available_piece_types(&self) -> Vec<PieceType> {
        let mut types = vec![
            PieceType::Queen,
            PieceType::Beetle,
            PieceType::Spider,
            PieceType::Grasshopper,
            PieceType::Ant,
        ];
        if self.use_mosquito {
            types.push(PieceType::Mosquito);
        }
        if self.use_ladybug {
            types.push(PieceType::Ladybug);
        }
        if self.use_pillbug {
            types.push(PieceType::Pillbug);
        }
        types
    }
}

/// Preset game configurations for the setup screen.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GamePreset {
    pub name: String,
    pub description: String,
    pub rules: RuleConfig,
}

impl GamePreset {
    pub fn all_presets() -> Vec<GamePreset> {
        vec![
            GamePreset {
                name: "Standard".to_string(),
                description: "Base game — no expansions".to_string(),
                rules: RuleConfig::standard(),
            },
            GamePreset {
                name: "All Expansions".to_string(),
                description: "Base game + Mosquito, Ladybug, Pillbug".to_string(),
                rules: RuleConfig::all_expansions(),
            },
            GamePreset {
                name: "Tournament".to_string(),
                description: "All expansions + tournament opening rule".to_string(),
                rules: RuleConfig::tournament(),
            },
            GamePreset {
                name: "Mosquito Only".to_string(),
                description: "Base game + Mosquito expansion".to_string(),
                rules: {
                    let mut r = RuleConfig::standard();
                    r.use_mosquito = true;
                    r.piece_counts.insert(PieceType::Mosquito, 1);
                    r
                },
            },
            GamePreset {
                name: "Ladybug Only".to_string(),
                description: "Base game + Ladybug expansion".to_string(),
                rules: {
                    let mut r = RuleConfig::standard();
                    r.use_ladybug = true;
                    r.piece_counts.insert(PieceType::Ladybug, 1);
                    r
                },
            },
            GamePreset {
                name: "Pillbug Only".to_string(),
                description: "Base game + Pillbug expansion".to_string(),
                rules: {
                    let mut r = RuleConfig::standard();
                    r.use_pillbug = true;
                    r.piece_counts.insert(PieceType::Pillbug, 1);
                    r
                },
            },
            GamePreset {
                name: "Custom".to_string(),
                description: "Configure everything yourself".to_string(),
                rules: RuleConfig::standard(),
            },
        ]
    }
}
