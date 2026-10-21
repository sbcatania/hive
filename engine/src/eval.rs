//! Hand-written position evaluation for the alpha-beta AI.
//!
//! Scores are from the point of view of the side to move. The search uses
//! [`evaluate_fast`] by default: it skips move generation, so the search gets
//! about a ply deeper, which outweighs the exact mobility counts of the older
//! [`evaluate`] (kept for comparison via `Searcher::flags`).

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
            // Placements, and Pillbug throws of enemy pieces (which don't say
            // anything about that piece's own mobility).
            if m.is_placement() || color_of(m.piece) != color {
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

/// Tunable weights for [`evaluate_fast`].
#[derive(Clone, Copy, Debug)]
pub struct EvalParams {
    /// Queen liberty filled by an enemy piece.
    pub lib_enemy: i32,
    /// Queen liberty filled by an own piece that can't move away.
    pub lib_own_stuck: i32,
    /// Queen liberty filled by an own piece that could leave.
    pub lib_own_free: i32,
    /// Extra for an enemy piece next to the Queen that can't move away.
    pub lib_enemy_stuck: i32,
    /// Extra penalty by number of occupied queen neighbours (nonlinear part).
    pub surround: [i32; 7],
    /// Value of a piece that can move, by bug.
    pub movable: [i32; NUM_BUGS],
    /// Value of a piece still in hand, by bug.
    pub hand: [i32; NUM_BUGS],
    /// Stacked (beetle-like) pieces count this many times their value.
    pub stack_mult: i32,
    /// Movable pieces next to the enemy queen are worth this percentage of their value.
    pub attacker_pct: i32,
    /// Own Pillbug next to the own Queen with somewhere to throw her.
    pub pillbug_defense: i32,
    /// Pillbug in hand with a free placement spot next to the own Queen.
    pub pillbug_defense_hand: i32,
    /// Beetle (or mosquito) sitting on the enemy Queen.
    pub on_enemy_queen: i32,
    pub tempo: i32,
}

impl Default for EvalParams {
    fn default() -> Self {
        EvalParams {
            lib_enemy: 144,
            lib_own_stuck: 120,
            lib_own_free: 60,
            lib_enemy_stuck: 0,
            surround: [0, 0, 0, 0, 40, 120, 0],
            movable: [96, 16, 48, 16, 56, 64, 48, 40],
            hand: [48, 8, 24, 8, 28, 32, 24, 20],
            stack_mult: 2,
            attacker_pct: 50,
            pillbug_defense: 200,
            pillbug_defense_hand: 100,
            on_enemy_queen: 100,
            tempo: 20,
        }
    }
}

#[inline]
fn crawler(b: Bug) -> bool {
    matches!(b, Bug::Queen | Bug::Ant | Bug::Spider | Bug::Pillbug)
}

/// Empty neighbours of `c`, counting `origin` as empty.
fn liberties(g: &Game, origin: Cell, c: Cell) -> i32 {
    neighbors(c).iter().filter(|&&n| n == origin || !g.occupied(n)).count() as i32
}

fn placeable(g: &Game, c: Cell, color: Color) -> bool {
    !g.occupied(c)
        && neighbors(c).iter().all(|&n| {
            let t = g.top(n);
            t == NO_PIECE || color_of(t) == color
        })
}

/// Cheap evaluation without move generation: which pieces can move at all
/// (not pinned, covered or boxed in), how filled each Queen's neighbourhood is
/// and by whom, pieces in hand, and Pillbug defence of the Queen.
pub fn evaluate_fast(g: &Game, p: &EvalParams) -> i32 {
    let me = g.to_move();
    let pinned = g.pinned_pieces();
    let mut score = [0i32; 2];
    let mut queen_pen = [0i32; 2];
    let mut queen_n = [0usize; 2];
    let mut pill_def = [false; 2];
    let qpos = [g.position(queen_of(Color::White)), g.position(queen_of(Color::Black))];

    for color in [Color::White, Color::Black] {
        let ci = color.index();
        let queen_down = qpos[ci] != NO_CELL;
        for pc in pieces_of(color) {
            if !g.piece_enabled(pc) {
                continue;
            }
            let bug = bug_of(pc);
            if g.in_hand(pc) {
                score[ci] += p.hand[bug as usize];
                continue;
            }
            if !g.on_top(pc) {
                continue;
            }
            let c = g.position(pc);
            let stacked = g.level_of(pc) > 0;
            let mut value = p.movable[bug as usize];
            let mut is_crawler = crawler(bug);
            let mut powers = bug == Bug::Pillbug;
            if bug == Bug::Mosquito {
                if stacked {
                    value = p.movable[Bug::Beetle as usize];
                    is_crawler = false;
                } else {
                    value = 0;
                    is_crawler = true;
                    for &n in neighbors(c) {
                        let t = g.top(n);
                        if t == NO_PIECE {
                            continue;
                        }
                        let b = bug_of(t);
                        if b != Bug::Queen && b != Bug::Mosquito {
                            value = value.max(p.movable[b as usize]);
                        }
                        if b == Bug::Pillbug {
                            powers = true;
                        }
                        if !crawler(b) {
                            is_crawler = false;
                        }
                    }
                }
            }
            let mut stuck = !stacked && pinned & (1u32 << pc) != 0;
            if !stuck && is_crawler && !stacked && !(0..6).any(|d| g.can_slide(c, d)) {
                stuck = true;
            }
            if !queen_down {
                stuck = true;
            }
            if stacked {
                value *= p.stack_mult;
            }
            // Next to its own Queen.
            let own_q = qpos[ci];
            if own_q != NO_CELL && direction_to(own_q, c).is_some() {
                queen_pen[ci] += if stuck && !stacked { p.lib_own_stuck } else { p.lib_own_free };
                if powers && g.height(own_q) == 1 {
                    let best = neighbors(c).iter().map(|&l| if g.occupied(l) { 0 } else { liberties(g, own_q, l) }).max().unwrap_or(0);
                    if best > 2 {
                        pill_def[ci] = true;
                    }
                }
            }
            let enemy_q = qpos[1 - ci];
            if enemy_q != NO_CELL {
                if direction_to(enemy_q, c).is_some() {
                    queen_pen[1 - ci] += p.lib_enemy;
                    if stuck && !stacked {
                        queen_pen[1 - ci] += p.lib_enemy_stuck;
                    }
                    value = value * p.attacker_pct / 100;
                } else if c == enemy_q && stacked {
                    score[ci] += p.on_enemy_queen;
                }
            }
            if !stuck {
                score[ci] += value;
            }
        }
        if qpos[ci] != NO_CELL {
            queen_n[ci] = neighbors(qpos[ci]).iter().filter(|&&n| g.occupied(n)).count();
        }
    }
    let mut total = [0i32; 2];
    for color in [Color::White, Color::Black] {
        let ci = color.index();
        let mut s = score[ci] - queen_pen[ci] - p.surround[queen_n[ci]];
        if pill_def[ci] {
            s += p.pillbug_defense;
        } else if qpos[ci] != NO_CELL
            && g.height(qpos[ci]) == 1
            && g.next_in_hand(color, Bug::Pillbug).is_some()
            && neighbors(qpos[ci]).iter().any(|&l| placeable(g, l, color))
        {
            s += p.pillbug_defense_hand;
        }
        total[ci] = s;
    }
    total[me.index()] - total[me.other().index()] + p.tempo
}
