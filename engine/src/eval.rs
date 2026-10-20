//! Hand-written position evaluation for the alpha-beta AI.
//!
//! Scores are from the point of view of the side to move. The dominant terms
//! are queen safety (occupied neighbours of each queen) and mobility, measured
//! with real move generation for both sides.

use crate::game::{Game, Move};
use crate::hex::*;
use crate::pieces::*;

/// Penalty by number of occupied cells around a queen.
const QUEEN_SURROUND: [i32; 7] = [0, 10, 30, 65, 125, 230, 0];
/// Discount for neighbours that are the queen owner's own movable pieces
/// (they can step away).
const OWN_MOVABLE_NEIGHBOR_REFUND: i32 = 6;
const QUEEN_CAN_MOVE: i32 = 12;
/// Bonus for a piece that can move, by bug.
const MOBILE: [i32; NUM_BUGS] = [6, 8, 16, 10, 22, 20, 14, 10];
/// Bonus per destination, by bug (capped).
const PER_DEST: [i32; NUM_BUGS] = [2, 1, 2, 1, 1, 1, 1, 2];
const DEST_CAP: i32 = 8;
/// Value of keeping a piece in hand, by bug.
const IN_HAND: [i32; NUM_BUGS] = [0, 4, 8, 5, 12, 10, 6, 5];
/// Pieces that can reach an empty cell next to the enemy queen next move.
const ATTACKER: i32 = 24;
const ON_ENEMY: i32 = 10;
const ON_ENEMY_QUEEN: i32 = 60;
const COVERED: i32 = 6;
const TEMPO: i32 = 6;

pub struct EvalScratch {
    moves: Vec<Move>,
}

impl EvalScratch {
    pub fn new() -> Self {
        EvalScratch { moves: Vec::with_capacity(256) }
    }
}

impl Default for EvalScratch {
    fn default() -> Self {
        Self::new()
    }
}

pub fn evaluate(g: &mut Game, scratch: &mut EvalScratch) -> i32 {
    let me = g.to_move();
    let pinned = g.pinned_pieces();
    let mut score = [0i32; 2];
    let mut dests = [0i32; NUM_PIECES];
    let mut attacker = [false; NUM_PIECES];

    for color in [Color::White, Color::Black] {
        let stunned = if color == me { g.last_moved } else { NO_PIECE };
        g.generate_moves_for(color, stunned, pinned, &mut scratch.moves);
        let enemy_q = g.position(queen_of(color.other()));
        for m in &scratch.moves {
            if m.is_placement() {
                continue;
            }
            dests[m.piece as usize] += 1;
            if enemy_q != NO_CELL
                && direction_to(enemy_q, m.to).is_some()
                && direction_to(enemy_q, m.from).is_none()
                && !g.occupied(m.to)
            {
                attacker[m.piece as usize] = true;
            }
        }
    }

    for color in [Color::White, Color::Black] {
        let ci = color.index();
        let mut s = 0;
        let q = queen_of(color);
        let qc = g.position(q);
        if qc != NO_CELL {
            let mut n = 0;
            for &nc in neighbors(qc) {
                if !g.occupied(nc) {
                    continue;
                }
                n += 1;
                let t = g.top(nc);
                if color_of(t) == color && dests[t as usize] > 0 && t != q {
                    s += OWN_MOVABLE_NEIGHBOR_REFUND;
                }
            }
            s -= QUEEN_SURROUND[n];
            if dests[q as usize] > 0 {
                s += QUEEN_CAN_MOVE;
            }
        }
        for p in pieces_of(color) {
            let bug = bug_of(p) as usize;
            if !g.piece_enabled(p) {
                continue;
            }
            if g.in_hand(p) {
                s += IN_HAND[bug];
                continue;
            }
            if !g.on_top(p) {
                s -= COVERED;
                continue;
            }
            let d = dests[p as usize];
            if d > 0 {
                s += MOBILE[bug] + PER_DEST[bug] * d.min(DEST_CAP);
            }
            if attacker[p as usize] {
                s += ATTACKER;
            }
            let lvl = g.level_of(p);
            if lvl > 0 {
                let below = g.stack_at(g.position(p))[lvl as usize - 1];
                if color_of(below) != color {
                    s += if below == queen_of(color.other()) { ON_ENEMY_QUEEN } else { ON_ENEMY };
                }
            }
        }
        score[ci] = s;
    }
    score[me.index()] - score[me.other().index()] + TEMPO
}
