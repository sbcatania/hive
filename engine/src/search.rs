//! Alpha-beta search (negamax + PVS) with iterative deepening, a transposition
//! table, killer moves and history ordering.

use crate::eval::{evaluate, evaluate_fast, EvalParams, EvalScratch};
use crate::game::{Game, GameState, Move};
use crate::hex::*;
use crate::pieces::*;
use crate::time::now_ms;

pub const WIN: i32 = 1_000_000;
pub const INF: i32 = 2_000_000;
const MAX_PLY: usize = 64;

/// Search feature flags (see `Searcher::flags`).
pub const F_FAST_EVAL: u32 = 1;
pub const F_LMR: u32 = 2;
pub const F_WIN_CHECK: u32 = 4;
pub const DEFAULT_FLAGS: u32 = F_FAST_EVAL | F_LMR | F_WIN_CHECK;

#[derive(Clone, Copy, Debug)]
pub struct Limits {
    pub max_depth: u32,
    pub time_ms: f64,
}

#[derive(Clone, Debug)]
pub struct SearchResult {
    pub best: Move,
    /// From the side to move's point of view.
    pub score: i32,
    pub depth: u32,
    pub nodes: u64,
    pub pv: Vec<Move>,
    /// Scores of every root move from the last completed iteration
    /// (exact only when searched with `exact_root`).
    pub root_scores: Vec<(Move, i32)>,
}

#[derive(Clone, Copy, Default)]
struct TtEntry {
    key: u64,
    best: Option<Move>,
    score: i32,
    depth: i8,
    bound: u8, // 0 exact, 1 lower, 2 upper
}

pub struct Searcher {
    tt: Vec<TtEntry>,
    killers: [[Move; 2]; MAX_PLY],
    history: Vec<i32>,
    scratch: EvalScratch,
    move_bufs: Vec<Vec<Move>>,
    nodes: u64,
    deadline: f64,
    stopped: bool,
    pub flags: u32,
    pub params: EvalParams,
    /// Moves searched at full depth before late move reductions start.
    pub lmr_after: usize,
    /// Don't start a new iteration unless `elapsed * id_factor` time remains.
    pub id_factor: f64,
    order_keys: Vec<(i32, u16)>,
    order_tmp: Vec<Move>,
}

impl Searcher {
    pub fn new(tt_bits: u32) -> Searcher {
        Searcher {
            tt: vec![TtEntry::default(); 1 << tt_bits],
            killers: [[Move::PASS; 2]; MAX_PLY],
            history: vec![0; NUM_PIECES * CELLS],
            scratch: EvalScratch::new(),
            move_bufs: (0..MAX_PLY).map(|_| Vec::with_capacity(128)).collect(),
            nodes: 0,
            deadline: f64::INFINITY,
            stopped: false,
            flags: DEFAULT_FLAGS,
            params: EvalParams::default(),
            lmr_after: 4,
            id_factor: 1.5,
            order_keys: Vec::with_capacity(256),
            order_tmp: Vec::with_capacity(256),
        }
    }

    pub fn clear(&mut self) {
        self.tt.iter_mut().for_each(|e| *e = TtEntry::default());
        self.history.iter_mut().for_each(|h| *h = 0);
    }

    /// Root moves, reducing Black's first placement to one direction (all six
    /// are equivalent by symmetry).
    pub fn root_moves(g: &mut Game, rotation: usize) -> Vec<Move> {
        let mut moves = g.legal_moves();
        if g.ply == 1 {
            let dir_cell = neighbor(ORIGIN, rotation % 6);
            moves.retain(|m| m.to == dir_cell);
        }
        moves
    }

    /// Iterative deepening search. With `exact_root`, every root move gets an
    /// exact score (slower; used by the weaker levels to pick among moves).
    pub fn search(&mut self, g: &mut Game, limits: Limits, exact_root: bool, rotation: usize) -> SearchResult {
        self.nodes = 0;
        self.stopped = false;
        let start = now_ms();
        self.deadline = start + limits.time_ms;
        self.killers = [[Move::PASS; 2]; MAX_PLY];
        for h in self.history.iter_mut() {
            *h /= 8;
        }

        let mut root = Self::root_moves(g, rotation);
        let mut result = SearchResult {
            best: root[0],
            score: 0,
            depth: 0,
            nodes: 0,
            pv: vec![root[0]],
            root_scores: root.iter().map(|&m| (m, 0)).collect(),
        };
        if root.len() == 1 && !exact_root {
            result.depth = 1;
            return result;
        }

        for depth in 1..=limits.max_depth.max(1) {
            self.order(g, &mut root, 0, None);
            if let Some(i) = root.iter().position(|&m| m == result.best) {
                let m = root.remove(i);
                root.insert(0, m);
            }
            let mut alpha = -INF;
            let beta = INF;
            let mut best = root[0];
            let mut scores = Vec::with_capacity(root.len());
            for (i, &m) in root.iter().enumerate() {
                g.play_unchecked(m);
                let s = if exact_root {
                    -self.negamax(g, depth as i32 - 1, -INF, INF, 1)
                } else if i == 0 {
                    -self.negamax(g, depth as i32 - 1, -beta, -alpha, 1)
                } else {
                    let mut s = -self.negamax(g, depth as i32 - 1, -alpha - 1, -alpha, 1);
                    if s > alpha && !self.stopped {
                        s = -self.negamax(g, depth as i32 - 1, -beta, -alpha, 1);
                    }
                    s
                };
                g.undo();
                if self.stopped {
                    break;
                }
                scores.push((m, s));
                if s > alpha {
                    alpha = s;
                    best = m;
                }
            }
            if self.stopped && depth > 1 {
                // A partial iteration: the first move (the previous best) was
                // searched to the new depth, and `best` only changed if another
                // move was proven better with a full-window search. Scores from
                // different depths aren't comparable, so trust only that.
                if !scores.is_empty() && !exact_root {
                    result.best = best;
                    result.score = alpha;
                }
                break;
            }
            result.best = best;
            result.score = alpha;
            result.depth = depth;
            if scores.len() == root.len() {
                result.root_scores = scores;
            }
            self.store(g.hash, Some(best), alpha, depth as i32, 0);
            if alpha.abs() >= WIN - 100 || now_ms() > self.deadline {
                break;
            }
            // Don't start an iteration we likely can't finish.
            let now = now_ms();
            if depth > 2 && now + (now - start) * self.id_factor > self.deadline {
                break;
            }
        }
        result.nodes = self.nodes;
        result.pv = self.principal_variation(g, result.best);
        result
    }

    fn principal_variation(&mut self, g: &mut Game, first: Move) -> Vec<Move> {
        let mut pv = vec![first];
        g.play_unchecked(first);
        let mut played = 1;
        while pv.len() < 8 && !g.state.is_over() {
            let e = self.tt[(g.hash as usize) & (self.tt.len() - 1)];
            let Some(m) = e.best.filter(|_| e.key == g.hash) else { break };
            if !g.legal_moves().contains(&m) {
                break;
            }
            pv.push(m);
            g.play_unchecked(m);
            played += 1;
        }
        for _ in 0..played {
            g.undo();
        }
        pv
    }

    fn terminal_score(g: &Game, ply: usize) -> Option<i32> {
        let me = g.to_move();
        match g.state {
            GameState::Draw => Some(0),
            GameState::WhiteWins | GameState::BlackWins => {
                let winner = if g.state == GameState::WhiteWins { Color::White } else { Color::Black };
                Some(if winner == me { WIN - ply as i32 } else { -WIN + ply as i32 })
            }
            _ => None,
        }
    }

    fn negamax(&mut self, g: &mut Game, depth: i32, mut alpha: i32, beta: i32, ply: usize) -> i32 {
        self.nodes += 1;
        if self.nodes & 1023 == 0 && now_ms() > self.deadline {
            self.stopped = true;
        }
        if self.stopped {
            return 0;
        }
        if let Some(s) = Self::terminal_score(g, ply) {
            return s;
        }
        if g.repetitions() >= 2 {
            return 0;
        }
        if depth <= 0 || ply >= MAX_PLY - 1 {
            return self.leaf(g, ply);
        }

        let key = g.hash;
        let idx = (key as usize) & (self.tt.len() - 1);
        let e = self.tt[idx];
        let mut tt_move = None;
        if e.key == key {
            tt_move = e.best;
            if e.depth as i32 >= depth {
                match e.bound {
                    0 => return e.score,
                    1 if e.score >= beta => return e.score,
                    2 if e.score <= alpha => return e.score,
                    _ => {}
                }
            }
        }

        let mut moves = std::mem::take(&mut self.move_bufs[ply]);
        g.generate_moves(&mut moves);
        self.order(g, &mut moves, ply, tt_move);

        let orig_alpha = alpha;
        let mut best = -INF;
        let mut best_move = moves[0];
        let me = g.to_move();
        let enemy_q = g.position(queen_of(me.other()));
        let my_q = g.position(queen_of(me));
        let killers = self.killers[ply];
        for (i, &m) in moves.iter().enumerate() {
            // Late move reductions for quiet moves far down the ordering.
            let mut r = 0;
            if self.flags & F_LMR != 0 && depth >= 3 && i >= self.lmr_after && Some(m) != tt_move && m != killers[0] && m != killers[1] && !m.is_pass() {
                let attack = enemy_q != NO_CELL && direction_to(enemy_q, m.to).is_some();
                let defend = my_q != NO_CELL && m.from != NO_CELL && direction_to(my_q, m.from).is_some();
                if !attack && !defend {
                    r = if i >= self.lmr_after * 4 && depth >= 4 { 2 } else { 1 };
                }
            }
            g.play_unchecked(m);
            let s = if i == 0 {
                -self.negamax(g, depth - 1, -beta, -alpha, ply + 1)
            } else {
                let mut s = -self.negamax(g, depth - 1 - r, -alpha - 1, -alpha, ply + 1);
                if r > 0 && s > alpha && !self.stopped {
                    s = -self.negamax(g, depth - 1, -alpha - 1, -alpha, ply + 1);
                }
                if s > alpha && s < beta && !self.stopped {
                    s = -self.negamax(g, depth - 1, -beta, -alpha, ply + 1);
                }
                s
            };
            g.undo();
            if self.stopped {
                break;
            }
            if s > best {
                best = s;
                best_move = m;
            }
            if s > alpha {
                alpha = s;
            }
            if alpha >= beta {
                if !m.is_pass() {
                    let k = &mut self.killers[ply];
                    if k[0] != m {
                        k[1] = k[0];
                        k[0] = m;
                    }
                    self.history[m.piece as usize * CELLS + m.to as usize] += depth * depth;
                }
                break;
            }
        }
        self.move_bufs[ply] = moves;
        if self.stopped {
            return 0;
        }
        let bound = if best <= orig_alpha {
            2
        } else if best >= beta {
            1
        } else {
            0
        };
        self.store(key, Some(best_move), best, depth, bound);
        best
    }

    fn static_eval(&mut self, g: &mut Game) -> i32 {
        if self.flags & F_FAST_EVAL != 0 {
            evaluate_fast(g, &self.params)
        } else {
            evaluate(g, &mut self.scratch)
        }
    }

    /// True if `color`'s Queen is one neighbour short of being captured.
    fn queen_threatened(&self, g: &Game, color: Color) -> bool {
        let q = queen_of(color);
        !g.in_hand(q) && g.occupied_neighbors(q) + 1 >= g.rules.surround.clamp(1, 6)
    }

    /// Evaluation at the search horizon, first checking whether the side to
    /// move can surround the enemy Queen right away (the static evaluation
    /// would only see a Queen one neighbour short).
    fn leaf(&mut self, g: &mut Game, ply: usize) -> i32 {
        let me = g.to_move();
        if self.flags & F_WIN_CHECK != 0 && self.queen_threatened(g, me.other()) {
            let eq = g.position(queen_of(me.other()));
            let mut moves = std::mem::take(&mut self.move_bufs[ply]);
            g.generate_moves(&mut moves);
            let mut win = false;
            for &m in moves.iter() {
                if m.is_pass() || direction_to(eq, m.to).is_none() || g.occupied(m.to) {
                    continue;
                }
                g.play_unchecked(m);
                let won = matches!(Self::terminal_score(g, ply + 1), Some(s) if s < -WIN / 2);
                g.undo();
                if won {
                    win = true;
                    break;
                }
            }
            self.move_bufs[ply] = moves;
            if win {
                return WIN - ply as i32 - 1;
            }
        }
        self.static_eval(g)
    }

    fn store(&mut self, key: u64, best: Option<Move>, score: i32, depth: i32, bound: u8) {
        let idx = (key as usize) & (self.tt.len() - 1);
        let e = &mut self.tt[idx];
        if e.key != key || depth as i8 >= e.depth {
            *e = TtEntry { key, best, score, depth: depth as i8, bound };
        }
    }

    fn order(&mut self, g: &Game, moves: &mut [Move], ply: usize, tt_move: Option<Move>) {
        let me = g.to_move();
        let enemy_q = g.position(queen_of(me.other()));
        let my_q = g.position(queen_of(me));
        let killers = if ply < MAX_PLY { self.killers[ply] } else { [Move::PASS; 2] };
        let score = |m: &Move| -> i32 {
            if Some(*m) == tt_move {
                return 10_000_000;
            }
            if m.is_pass() {
                return 0;
            }
            let mut s = 0;
            if enemy_q != NO_CELL && direction_to(enemy_q, m.to).is_some() && (m.from == NO_CELL || direction_to(enemy_q, m.from).is_none()) {
                s += 500_000;
            } else if m.to == enemy_q {
                s += 400_000;
            }
            if my_q != NO_CELL && m.from != NO_CELL && direction_to(my_q, m.from).is_some() && direction_to(my_q, m.to).is_none() {
                s += 200_000;
            }
            if killers[0] == *m {
                s += 300_000;
            } else if killers[1] == *m {
                s += 250_000;
            }
            if m.is_placement() {
                s -= 50_000;
            }
            s + self.history[m.piece as usize * CELLS + m.to as usize].min(100_000)
        };
        let mut keys = std::mem::take(&mut self.order_keys);
        keys.clear();
        keys.extend(moves.iter().enumerate().map(|(i, m)| (-score(m), i as u16)));
        keys.sort_unstable();
        let mut tmp = std::mem::take(&mut self.order_tmp);
        tmp.clear();
        tmp.extend_from_slice(moves);
        for (slot, &(_, i)) in moves.iter_mut().zip(keys.iter()) {
            *slot = tmp[i as usize];
        }
        self.order_keys = keys;
        self.order_tmp = tmp;
    }
}
