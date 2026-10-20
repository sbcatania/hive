//! Neural-network input encoding, shared by in-browser inference and the
//! self-play data writer (the Python trainer never encodes positions itself).
//!
//! The board is cropped to a `GRID x GRID` axial window centred on the hive,
//! from the point of view of the side to move. Spatial planes are sparse
//! integer counts; global features are broadcast to every cell.

use crate::game::{Game, Move};
use crate::hex::*;
use crate::layout::Layout;
use crate::pieces::*;

pub const GRID: usize = 18;
pub const GRID_CELLS: usize = GRID * GRID;

/// Spatial planes: 0-7 own top piece by bug, 8-15 opponent top piece by bug,
/// 16/17 own/opponent pieces buried under the top, 18 stack height above 1,
/// 19 stunned piece, 20 legal placement cell for side to move, 21 pinned piece.
pub const SPARSE_PLANES: usize = 22;
/// Plane 22 is constant 1 inside the window (so the net can see the border).
pub const ONES_PLANE: usize = 22;
/// Globals: own hand by bug (8), opponent hand by bug (8), M/L/P enabled (3),
/// own turn number / 10 (1).
pub const NUM_GLOBALS: usize = 20;
pub const IN_CHANNELS: usize = SPARSE_PLANES + 1 + NUM_GLOBALS;

/// Source of a move for the policy head.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Source {
    /// Placing a piece of this bug from hand.
    Hand(u8),
    /// Moving the top piece of this window cell (bug given for the embedding).
    Cell(u16, u8),
    Pass,
}

pub struct Encoded {
    pub sparse: Vec<(u8, u16, u8)>,
    pub globals: [f32; NUM_GLOBALS],
    /// Window index for each move passed to `encode`.
    pub moves: Vec<(Source, u16)>,
}

pub struct Frame {
    layout: Layout,
    origin: (i32, i32),
}

impl Frame {
    pub fn new(g: &Game) -> Frame {
        let layout = Layout::new(g);
        let (cq, cr) = layout.center();
        let half = GRID as i32 / 2;
        Frame { layout, origin: (cq - half, cr - half) }
    }

    pub fn index(&self, c: Cell) -> u16 {
        let (q, r) = self.layout.coords(c);
        let x = (q - self.origin.0).clamp(0, GRID as i32 - 1);
        let y = (r - self.origin.1).clamp(0, GRID as i32 - 1);
        (y as usize * GRID + x as usize) as u16
    }
}

pub fn encode(g: &mut Game, moves: &[Move]) -> Encoded {
    let me = g.to_move();
    let frame = Frame::new(g);
    let mut sparse = Vec::with_capacity(96);
    let pinned = g.pinned_pieces();

    for &c in &frame.layout.occupied {
        let i = frame.index(c);
        let stack = g.stack_at(c);
        let top = *stack.last().unwrap();
        let own = color_of(top) == me;
        sparse.push(((bug_of(top) as u8) + if own { 0 } else { 8 }, i, 1));
        if stack.len() > 1 {
            let buried_own = stack[..stack.len() - 1].iter().filter(|&&p| color_of(p) == me).count() as u8;
            let buried_opp = (stack.len() - 1) as u8 - buried_own;
            if buried_own > 0 {
                sparse.push((16, i, buried_own));
            }
            if buried_opp > 0 {
                sparse.push((17, i, buried_opp));
            }
            sparse.push((18, i, (stack.len() - 1) as u8));
        }
        if stack[0] < 32 && pinned & (1u32 << stack[0]) != 0 {
            sparse.push((21, i, 1));
        }
    }
    if g.last_moved != NO_PIECE && !g.in_hand(g.last_moved) {
        sparse.push((19, frame.index(g.position(g.last_moved)), 1));
    }

    let mut placement_cells: Vec<u16> = moves.iter().filter(|m| m.is_placement()).map(|m| frame.index(m.to)).collect();
    placement_cells.sort_unstable();
    placement_cells.dedup();
    for i in placement_cells {
        sparse.push((20, i, 1));
    }

    let mut globals = [0f32; NUM_GLOBALS];
    for (k, bug) in ALL_BUGS.iter().enumerate() {
        globals[k] = g.hand_count(me, *bug) as f32;
        globals[8 + k] = g.hand_count(me.other(), *bug) as f32;
    }
    globals[16] = g.rules.mosquito as u8 as f32;
    globals[17] = g.rules.ladybug as u8 as f32;
    globals[18] = g.rules.pillbug as u8 as f32;
    globals[19] = (g.turn_number() as f32 / 10.0).min(3.0);

    let enc_moves = moves
        .iter()
        .map(|m| {
            if m.is_pass() {
                (Source::Pass, 0)
            } else if m.is_placement() {
                (Source::Hand(bug_of(m.piece) as u8), frame.index(m.to))
            } else {
                (Source::Cell(frame.index(m.from), bug_of(m.piece) as u8), frame.index(m.to))
            }
        })
        .collect();

    Encoded { sparse, globals, moves: enc_moves }
}

/// Dense channel-last input: `[GRID_CELLS][IN_CHANNELS]`.
pub fn dense(e: &Encoded, out: &mut Vec<f32>) {
    out.clear();
    out.resize(GRID_CELLS * IN_CHANNELS, 0.0);
    for cell in 0..GRID_CELLS {
        let base = cell * IN_CHANNELS;
        out[base + ONES_PLANE] = 1.0;
        out[base + SPARSE_PLANES + 1..base + IN_CHANNELS].copy_from_slice(&e.globals);
    }
    for &(plane, cell, v) in &e.sparse {
        out[cell as usize * IN_CHANNELS + plane as usize] += v as f32;
    }
}
