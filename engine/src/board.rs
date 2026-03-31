/// The hex grid board using axial coordinates (q, r).
///
/// There is no fixed board — pieces form the board as they're placed.
/// Each hex position can hold a stack of pieces (beetles can climb on top).
///
/// Axial coordinate system:
///   6 neighbor directions: E(+1,0), W(-1,0), SE(0,+1), NW(0,-1), NE(+1,-1), SW(-1,+1)
///
/// ```text
///       NW  NE
///      W  *  E
///       SW  SE
/// ```

use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};
use crate::piece::Piece;

/// A hex position in axial coordinates.
pub type Coord = (i32, i32);

/// The 6 directions on a hex grid (axial coordinates).
pub const DIRECTIONS: [Coord; 6] = [
    (1, 0),   // East
    (-1, 0),  // West
    (0, 1),   // Southeast
    (0, -1),  // Northwest
    (1, -1),  // Northeast
    (-1, 1),  // Southwest
];

/// Returns all 6 neighbors of a hex coordinate.
pub fn neighbors(coord: Coord) -> [Coord; 6] {
    DIRECTIONS.map(|d| (coord.0 + d.0, coord.1 + d.1))
}

/// Returns a specific neighbor in the given direction.
pub fn neighbor_in_direction(coord: Coord, direction: Coord) -> Coord {
    (coord.0 + direction.0, coord.1 + direction.1)
}

/// The game board: a map from hex coordinates to stacks of pieces.
/// An empty stack means no piece at that position (we remove empty entries).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Board {
    /// Map from (q, r) to a stack of pieces (bottom to top).
    /// A beetle on top of another piece means the stack has 2+ entries.
    grid: HashMap<Coord, Vec<Piece>>,
}

impl Board {
    pub fn new() -> Self {
        Board {
            grid: HashMap::new(),
        }
    }

    /// Place a piece on top of the stack at the given coordinate.
    pub fn place(&mut self, coord: Coord, piece: Piece) {
        self.grid.entry(coord).or_insert_with(Vec::new).push(piece);
    }

    /// Remove the top piece from the given coordinate. Returns it if present.
    pub fn remove_top(&mut self, coord: Coord) -> Option<Piece> {
        let stack = self.grid.get_mut(&coord)?;
        let piece = stack.pop();
        if stack.is_empty() {
            self.grid.remove(&coord);
        }
        piece
    }

    /// Get the top piece at a coordinate (the one that can move/be seen).
    pub fn top_piece(&self, coord: Coord) -> Option<&Piece> {
        self.grid.get(&coord).and_then(|stack| stack.last())
    }

    /// Get the full stack at a coordinate.
    pub fn stack_at(&self, coord: Coord) -> &[Piece] {
        self.grid.get(&coord).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// How tall is the stack at this position? 0 = empty.
    pub fn stack_height(&self, coord: Coord) -> usize {
        self.grid.get(&coord).map(|v| v.len()).unwrap_or(0)
    }

    /// Is the hex empty (no pieces)?
    pub fn is_empty(&self, coord: Coord) -> bool {
        !self.grid.contains_key(&coord)
    }

    /// Is there at least one piece at this hex?
    pub fn is_occupied(&self, coord: Coord) -> bool {
        self.grid.contains_key(&coord)
    }

    /// All occupied coordinates on the board.
    pub fn occupied_coords(&self) -> HashSet<Coord> {
        self.grid.keys().cloned().collect()
    }

    /// Total number of occupied hexes.
    pub fn piece_count(&self) -> usize {
        self.grid.len()
    }

    /// All occupied positions as an iterator.
    pub fn positions(&self) -> impl Iterator<Item = &Coord> {
        self.grid.keys()
    }

    /// Iterator over all (coord, top_piece) pairs.
    pub fn pieces(&self) -> impl Iterator<Item = (Coord, &Piece)> {
        self.grid.iter().filter_map(|(&coord, stack)| {
            stack.last().map(|piece| (coord, piece))
        })
    }

    /// Iterator over all (coord, full_stack) pairs.
    pub fn stacks(&self) -> impl Iterator<Item = (Coord, &Vec<Piece>)> {
        self.grid.iter().map(|(&coord, stack)| (coord, stack))
    }

    /// Returns all empty hexes adjacent to at least one occupied hex.
    /// These are the candidate positions for placing new pieces.
    pub fn empty_neighbors(&self) -> HashSet<Coord> {
        let mut result = HashSet::new();
        for &coord in self.grid.keys() {
            for neighbor in neighbors(coord) {
                if self.is_empty(neighbor) {
                    result.insert(neighbor);
                }
            }
        }
        result
    }

    /// Returns occupied neighbors of a coordinate.
    pub fn occupied_neighbors(&self, coord: Coord) -> Vec<Coord> {
        neighbors(coord)
            .into_iter()
            .filter(|&n| self.is_occupied(n))
            .collect()
    }

    /// Returns empty neighbors of a coordinate.
    pub fn empty_neighbor_coords(&self, coord: Coord) -> Vec<Coord> {
        neighbors(coord)
            .into_iter()
            .filter(|&n| self.is_empty(n))
            .collect()
    }

    /// Find the coordinate of a specific piece on the board (searches top pieces only).
    pub fn find_piece(&self, piece: &Piece) -> Option<Coord> {
        for (&coord, stack) in &self.grid {
            if stack.last() == Some(piece) {
                return Some(coord);
            }
        }
        None
    }

    /// Find any piece on the board (including buried ones).
    pub fn find_piece_any_depth(&self, piece: &Piece) -> Option<Coord> {
        for (&coord, stack) in &self.grid {
            if stack.contains(piece) {
                return Some(coord);
            }
        }
        None
    }
}
