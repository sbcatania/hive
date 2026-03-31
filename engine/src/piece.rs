/// All the bug types in Hive, including expansion pieces.
///
/// Base game: Queen, Beetle, Spider, Grasshopper, Ant
/// Expansions: Mosquito, Ladybug, Pillbug

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PieceType {
    Queen,
    Beetle,
    Spider,
    Grasshopper,
    Ant,
    // Expansion pieces
    Mosquito,
    Ladybug,
    Pillbug,
}

impl PieceType {
    /// Whether this piece type is from an expansion pack.
    pub fn is_expansion(&self) -> bool {
        matches!(self, PieceType::Mosquito | PieceType::Ladybug | PieceType::Pillbug)
    }
}

/// Player color — White always goes first.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Color {
    White,
    Black,
}

impl Color {
    /// Returns the other player's color.
    pub fn opponent(&self) -> Color {
        match self {
            Color::White => Color::Black,
            Color::Black => Color::White,
        }
    }
}

/// A single game piece, identified by type, color, and a unique ID.
/// The ID distinguishes multiple pieces of the same type (e.g., Ant #0, #1, #2).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Piece {
    pub piece_type: PieceType,
    pub color: Color,
    pub id: u8,
}

impl Piece {
    pub fn new(piece_type: PieceType, color: Color, id: u8) -> Self {
        Piece { piece_type, color, id }
    }
}

impl std::fmt::Display for Piece {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let type_char = match self.piece_type {
            PieceType::Queen => "Q",
            PieceType::Beetle => "B",
            PieceType::Spider => "S",
            PieceType::Grasshopper => "G",
            PieceType::Ant => "A",
            PieceType::Mosquito => "M",
            PieceType::Ladybug => "L",
            PieceType::Pillbug => "P",
        };
        let color_char = match self.color {
            Color::White => "w",
            Color::Black => "b",
        };
        write!(f, "{}{}{}", color_char, type_char, self.id)
    }
}
