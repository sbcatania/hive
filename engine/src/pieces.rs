//! Piece identities. Each colour has 14 pieces; ids are `color * 14 + index`.

use serde::{Deserialize, Serialize};

pub const PIECES_PER_COLOR: usize = 14;
pub const NUM_PIECES: usize = 28;
pub const NO_PIECE: u8 = u8::MAX;

pub type PieceId = u8;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Color {
    White = 0,
    Black = 1,
}

impl Color {
    #[inline]
    pub fn other(self) -> Color {
        match self {
            Color::White => Color::Black,
            Color::Black => Color::White,
        }
    }
    pub fn index(self) -> usize {
        self as usize
    }
    pub fn from_index(i: usize) -> Color {
        if i == 0 {
            Color::White
        } else {
            Color::Black
        }
    }
    pub fn prefix(self) -> char {
        match self {
            Color::White => 'w',
            Color::Black => 'b',
        }
    }
    pub fn name(self) -> &'static str {
        match self {
            Color::White => "White",
            Color::Black => "Black",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Bug {
    Queen = 0,
    Spider = 1,
    Beetle = 2,
    Grasshopper = 3,
    Ant = 4,
    Mosquito = 5,
    Ladybug = 6,
    Pillbug = 7,
}

pub const NUM_BUGS: usize = 8;

pub const ALL_BUGS: [Bug; NUM_BUGS] = [
    Bug::Queen,
    Bug::Spider,
    Bug::Beetle,
    Bug::Grasshopper,
    Bug::Ant,
    Bug::Mosquito,
    Bug::Ladybug,
    Bug::Pillbug,
];

impl Bug {
    pub fn letter(self) -> char {
        match self {
            Bug::Queen => 'Q',
            Bug::Spider => 'S',
            Bug::Beetle => 'B',
            Bug::Grasshopper => 'G',
            Bug::Ant => 'A',
            Bug::Mosquito => 'M',
            Bug::Ladybug => 'L',
            Bug::Pillbug => 'P',
        }
    }
    pub fn from_letter(c: char) -> Option<Bug> {
        Some(match c {
            'Q' => Bug::Queen,
            'S' => Bug::Spider,
            'B' => Bug::Beetle,
            'G' => Bug::Grasshopper,
            'A' => Bug::Ant,
            'M' => Bug::Mosquito,
            'L' => Bug::Ladybug,
            'P' => Bug::Pillbug,
            _ => return None,
        })
    }
    pub fn name(self) -> &'static str {
        match self {
            Bug::Queen => "Queen Bee",
            Bug::Spider => "Spider",
            Bug::Beetle => "Beetle",
            Bug::Grasshopper => "Grasshopper",
            Bug::Ant => "Soldier Ant",
            Bug::Mosquito => "Mosquito",
            Bug::Ladybug => "Ladybug",
            Bug::Pillbug => "Pillbug",
        }
    }
    pub fn from_index(i: usize) -> Bug {
        ALL_BUGS[i]
    }
    /// Number of copies each player has.
    pub fn count(self) -> u8 {
        match self {
            Bug::Queen | Bug::Mosquito | Bug::Ladybug | Bug::Pillbug => 1,
            Bug::Spider | Bug::Beetle => 2,
            Bug::Grasshopper | Bug::Ant => 3,
        }
    }
    pub fn is_expansion(self) -> bool {
        matches!(self, Bug::Mosquito | Bug::Ladybug | Bug::Pillbug)
    }
}

/// (bug, number) for each per-colour index. Number is 0 for unique pieces.
const LAYOUT: [(Bug, u8); PIECES_PER_COLOR] = [
    (Bug::Queen, 0),
    (Bug::Spider, 1),
    (Bug::Spider, 2),
    (Bug::Beetle, 1),
    (Bug::Beetle, 2),
    (Bug::Grasshopper, 1),
    (Bug::Grasshopper, 2),
    (Bug::Grasshopper, 3),
    (Bug::Ant, 1),
    (Bug::Ant, 2),
    (Bug::Ant, 3),
    (Bug::Mosquito, 0),
    (Bug::Ladybug, 0),
    (Bug::Pillbug, 0),
];

/// First per-colour index of each bug type.
pub const BUG_START: [u8; NUM_BUGS] = [0, 1, 3, 5, 8, 11, 12, 13];

#[inline]
pub fn color_of(p: PieceId) -> Color {
    if (p as usize) < PIECES_PER_COLOR {
        Color::White
    } else {
        Color::Black
    }
}

#[inline]
pub fn bug_of(p: PieceId) -> Bug {
    LAYOUT[p as usize % PIECES_PER_COLOR].0
}

#[inline]
pub fn number_of(p: PieceId) -> u8 {
    LAYOUT[p as usize % PIECES_PER_COLOR].1
}

pub fn piece_id(color: Color, bug: Bug, number: u8) -> PieceId {
    let base = color.index() * PIECES_PER_COLOR + BUG_START[bug as usize] as usize;
    let n = if number == 0 { 0 } else { number as usize - 1 };
    (base + n) as PieceId
}

pub fn queen_of(color: Color) -> PieceId {
    (color.index() * PIECES_PER_COLOR) as PieceId
}

/// Range of piece ids belonging to `color`.
pub fn pieces_of(color: Color) -> std::ops::Range<PieceId> {
    let s = (color.index() * PIECES_PER_COLOR) as PieceId;
    s..s + PIECES_PER_COLOR as PieceId
}

/// UHP short name, e.g. `wQ`, `bA2`.
pub fn piece_name(p: PieceId) -> String {
    let mut s = String::with_capacity(3);
    s.push(color_of(p).prefix());
    s.push(bug_of(p).letter());
    let n = number_of(p);
    if n > 0 {
        s.push((b'0' + n) as char);
    }
    s
}

pub fn parse_piece_name(s: &str) -> Option<PieceId> {
    let mut chars = s.chars();
    let color = match chars.next()? {
        'w' => Color::White,
        'b' => Color::Black,
        _ => return None,
    };
    let bug = Bug::from_letter(chars.next()?)?;
    let rest: String = chars.collect();
    let number = if rest.is_empty() {
        if bug.count() > 1 {
            return None;
        }
        0
    } else {
        let n: u8 = rest.parse().ok()?;
        if bug.count() == 1 || n == 0 || n > bug.count() {
            return None;
        }
        n
    };
    Some(piece_id(color, bug, number))
}
