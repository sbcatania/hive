//! Hex grid on a 32x32 torus.
//!
//! Cells use axial coordinates (q, r) for pointy-top hexagons. Coordinates
//! wrap modulo 32, which is safe because a connected hive of at most 28 pieces
//! (plus one empty destination cell) can never span 32 cells in any direction.

pub const GRID_BITS: u32 = 5;
pub const GRID: i32 = 1 << GRID_BITS;
pub const MASK: i32 = GRID - 1;
pub const CELLS: usize = (GRID * GRID) as usize;

pub type Cell = u16;
pub const NO_CELL: Cell = u16::MAX;

/// Directions, in clockwise order starting at East (pointy-top hexes):
/// 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE. `d` and `(d + 3) % 6` are opposite,
/// and `d ± 1` are the two cells shared by a cell and its neighbour in `d`.
pub const DIRS: [(i32, i32); 6] = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)];

pub const fn cell(q: i32, r: i32) -> Cell {
    ((q & MASK) | ((r & MASK) << GRID_BITS)) as Cell
}

pub const ORIGIN: Cell = cell(0, 0);

#[inline]
pub fn cq(c: Cell) -> i32 {
    (c as i32) & MASK
}

#[inline]
pub fn cr(c: Cell) -> i32 {
    ((c as i32) >> GRID_BITS) & MASK
}

/// Coordinates wrapped into -16..16, relative to the origin.
pub fn signed_coords(c: Cell) -> (i32, i32) {
    let w = |v: i32| ((v + GRID / 2) & MASK) - GRID / 2;
    (w(cq(c)), w(cr(c)))
}

const fn build_neighbors() -> [[Cell; 6]; CELLS] {
    let mut t = [[0u16; 6]; CELLS];
    let mut i = 0;
    while i < CELLS {
        let q = (i as i32) & MASK;
        let r = ((i as i32) >> GRID_BITS) & MASK;
        let mut d = 0;
        while d < 6 {
            t[i][d] = cell(q + DIRS[d].0, r + DIRS[d].1);
            d += 1;
        }
        i += 1;
    }
    t
}

static NEIGHBORS: [[Cell; 6]; CELLS] = build_neighbors();

#[inline(always)]
pub fn neighbors(c: Cell) -> &'static [Cell; 6] {
    &NEIGHBORS[c as usize]
}

#[inline(always)]
pub fn neighbor(c: Cell, d: usize) -> Cell {
    NEIGHBORS[c as usize][d]
}

/// Direction from `a` to adjacent cell `b`, if they are adjacent.
pub fn direction_to(a: Cell, b: Cell) -> Option<usize> {
    neighbors(a).iter().position(|&n| n == b)
}
