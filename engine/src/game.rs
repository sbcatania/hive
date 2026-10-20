//! Game state and rules: placement, movement for every bug, play/undo, game end.

use crate::hex::*;
use crate::pieces::*;
use serde::{Deserialize, Serialize};

/// Tallest possible stack: a ground piece plus 4 beetles and 2 mosquitoes.
pub const MAX_HEIGHT: usize = 8;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Move {
    pub piece: PieceId,
    /// `NO_CELL` for placements.
    pub from: Cell,
    pub to: Cell,
}

impl Move {
    pub const PASS: Move = Move { piece: NO_PIECE, from: NO_CELL, to: NO_CELL };

    #[inline]
    pub fn is_pass(&self) -> bool {
        self.piece == NO_PIECE
    }
    #[inline]
    pub fn is_placement(&self) -> bool {
        !self.is_pass() && self.from == NO_CELL
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Rules {
    pub mosquito: bool,
    pub ladybug: bool,
    pub pillbug: bool,
    /// Tournament opening: no Queen on either player's first turn.
    pub tournament: bool,
}

impl Default for Rules {
    fn default() -> Self {
        Rules { mosquito: true, ladybug: true, pillbug: true, tournament: true }
    }
}

impl Rules {
    pub fn base() -> Self {
        Rules { mosquito: false, ladybug: false, pillbug: false, tournament: true }
    }

    pub fn enabled(&self, bug: Bug) -> bool {
        match bug {
            Bug::Mosquito => self.mosquito,
            Bug::Ladybug => self.ladybug,
            Bug::Pillbug => self.pillbug,
            _ => true,
        }
    }

    /// UHP GameTypeString, e.g. `Base`, `Base+MP`.
    pub fn game_type_string(&self) -> String {
        let mut s = String::from("Base");
        if self.mosquito || self.ladybug || self.pillbug {
            s.push('+');
            if self.mosquito {
                s.push('M');
            }
            if self.ladybug {
                s.push('L');
            }
            if self.pillbug {
                s.push('P');
            }
        }
        s
    }

    pub fn parse_game_type(s: &str, tournament: bool) -> Option<Rules> {
        let s = s.trim();
        let mut r = Rules { mosquito: false, ladybug: false, pillbug: false, tournament };
        if s == "Base" {
            return Some(r);
        }
        let ext = s.strip_prefix("Base+")?;
        if ext.is_empty() {
            return None;
        }
        for c in ext.chars() {
            match c {
                'M' => r.mosquito = true,
                'L' => r.ladybug = true,
                'P' => r.pillbug = true,
                _ => return None,
            }
        }
        Some(r)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum GameState {
    NotStarted,
    InProgress,
    Draw,
    WhiteWins,
    BlackWins,
}

impl GameState {
    pub fn is_over(self) -> bool {
        matches!(self, GameState::Draw | GameState::WhiteWins | GameState::BlackWins)
    }
    pub fn as_str(self) -> &'static str {
        match self {
            GameState::NotStarted => "NotStarted",
            GameState::InProgress => "InProgress",
            GameState::Draw => "Draw",
            GameState::WhiteWins => "WhiteWins",
            GameState::BlackWins => "BlackWins",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct HistoryEntry {
    pub mv: Move,
    /// Position hash before this move.
    pub prev_hash: u64,
    prev_last_moved: PieceId,
    prev_state: GameState,
}

/// 1024-bit set of cells.
#[derive(Clone, Copy)]
struct CellSet([u64; CELLS / 64]);

impl CellSet {
    fn new() -> Self {
        CellSet([0; CELLS / 64])
    }
    #[inline]
    fn insert(&mut self, c: Cell) -> bool {
        let (w, b) = (c as usize >> 6, c as usize & 63);
        let had = self.0[w] & (1 << b) != 0;
        self.0[w] |= 1 << b;
        !had
    }
    #[inline]
    #[allow(dead_code)]
    fn contains(&self, c: Cell) -> bool {
        self.0[c as usize >> 6] & (1 << (c as usize & 63)) != 0
    }
}

#[inline]
fn splitmix(mut x: u64) -> u64 {
    x = x.wrapping_add(0x9E37_79B9_7F4A_7C15);
    x = (x ^ (x >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    x = (x ^ (x >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    x ^ (x >> 31)
}

#[inline]
fn piece_key(p: PieceId, c: Cell, level: u8) -> u64 {
    splitmix(((p as u64) << 16) | ((level as u64) << 12) | c as u64)
}

#[inline]
fn last_moved_key(p: PieceId) -> u64 {
    if p == NO_PIECE {
        0
    } else {
        splitmix((1 << 40) | p as u64)
    }
}

const SIDE_KEY: u64 = 0x5BD1_E995_3C6E_F372;

#[derive(Clone)]
pub struct Game {
    pub rules: Rules,
    height: [u8; CELLS],
    stack: [[PieceId; MAX_HEIGHT]; CELLS],
    pos: [Cell; NUM_PIECES],
    level: [u8; NUM_PIECES],
    /// Number of moves (including passes) played so far.
    pub ply: u32,
    /// The piece moved on the previous turn; it can't move or be moved this turn.
    pub last_moved: PieceId,
    pub state: GameState,
    pub history: Vec<HistoryEntry>,
    pub hash: u64,
}

impl Game {
    pub fn new(rules: Rules) -> Game {
        Game {
            rules,
            height: [0; CELLS],
            stack: [[NO_PIECE; MAX_HEIGHT]; CELLS],
            pos: [NO_CELL; NUM_PIECES],
            level: [0; NUM_PIECES],
            ply: 0,
            last_moved: NO_PIECE,
            state: GameState::NotStarted,
            history: Vec::with_capacity(128),
            hash: 0,
        }
    }

    // ---- Queries --------------------------------------------------------

    #[inline]
    pub fn to_move(&self) -> Color {
        if self.ply % 2 == 0 {
            Color::White
        } else {
            Color::Black
        }
    }

    /// 1-based turn number of the player to move (UHP `White[3]`).
    #[inline]
    pub fn turn_number(&self) -> u32 {
        self.ply / 2 + 1
    }

    #[inline]
    pub fn height(&self, c: Cell) -> u8 {
        self.height[c as usize]
    }

    #[inline]
    pub fn occupied(&self, c: Cell) -> bool {
        self.height[c as usize] > 0
    }

    #[inline]
    pub fn top(&self, c: Cell) -> PieceId {
        let h = self.height[c as usize];
        if h == 0 {
            NO_PIECE
        } else {
            self.stack[c as usize][h as usize - 1]
        }
    }

    /// Pieces at `c`, bottom first.
    pub fn stack_at(&self, c: Cell) -> &[PieceId] {
        &self.stack[c as usize][..self.height[c as usize] as usize]
    }

    #[inline]
    pub fn position(&self, p: PieceId) -> Cell {
        self.pos[p as usize]
    }

    #[inline]
    pub fn level_of(&self, p: PieceId) -> u8 {
        self.level[p as usize]
    }

    #[inline]
    pub fn in_hand(&self, p: PieceId) -> bool {
        self.pos[p as usize] == NO_CELL
    }

    #[inline]
    pub fn on_top(&self, p: PieceId) -> bool {
        let c = self.pos[p as usize];
        c != NO_CELL && self.level[p as usize] + 1 == self.height[c as usize]
    }

    pub fn queen_placed(&self, color: Color) -> bool {
        !self.in_hand(queen_of(color))
    }

    pub fn piece_enabled(&self, p: PieceId) -> bool {
        self.rules.enabled(bug_of(p))
    }

    /// Cells occupied by at least one piece.
    pub fn occupied_cells(&self) -> Vec<Cell> {
        let mut v: Vec<Cell> = (0..NUM_PIECES as PieceId)
            .filter(|&p| !self.in_hand(p) && self.level[p as usize] == 0)
            .map(|p| self.pos[p as usize])
            .collect();
        v.sort_unstable();
        v
    }

    /// Number of occupied cells around `p` (a surrounded Queen has 6).
    pub fn occupied_neighbors(&self, p: PieceId) -> u8 {
        let c = self.pos[p as usize];
        if c == NO_CELL {
            return 0;
        }
        neighbors(c).iter().filter(|&&n| self.occupied(n)).count() as u8
    }

    /// Next piece of `bug` in `color`'s hand (pieces are placed in numeric order).
    pub fn next_in_hand(&self, color: Color, bug: Bug) -> Option<PieceId> {
        let start = (color.index() * PIECES_PER_COLOR) as u8 + BUG_START[bug as usize];
        (start..start + bug.count()).find(|&p| self.in_hand(p))
    }

    pub fn hand_count(&self, color: Color, bug: Bug) -> u8 {
        if !self.rules.enabled(bug) {
            return 0;
        }
        let start = (color.index() * PIECES_PER_COLOR) as u8 + BUG_START[bug as usize];
        (start..start + bug.count()).filter(|&p| self.in_hand(p)).count() as u8
    }

    // ---- Board mutation -------------------------------------------------

    fn put(&mut self, p: PieceId, c: Cell) {
        let h = self.height[c as usize];
        debug_assert!((h as usize) < MAX_HEIGHT);
        self.stack[c as usize][h as usize] = p;
        self.height[c as usize] = h + 1;
        self.pos[p as usize] = c;
        self.level[p as usize] = h;
        self.hash ^= piece_key(p, c, h);
    }

    fn lift(&mut self, p: PieceId) {
        let c = self.pos[p as usize];
        let h = self.height[c as usize] - 1;
        debug_assert_eq!(self.stack[c as usize][h as usize], p);
        self.stack[c as usize][h as usize] = NO_PIECE;
        self.height[c as usize] = h;
        self.pos[p as usize] = NO_CELL;
        self.hash ^= piece_key(p, c, h);
        self.level[p as usize] = 0;
    }

    fn set_last_moved(&mut self, p: PieceId) {
        self.hash ^= last_moved_key(self.last_moved) ^ last_moved_key(p);
        self.last_moved = p;
    }

    /// Plays a move without checking legality.
    pub fn play_unchecked(&mut self, m: Move) {
        self.history.push(HistoryEntry { mv: m, prev_hash: self.hash, prev_last_moved: self.last_moved, prev_state: self.state });
        if !m.is_pass() {
            if !m.is_placement() {
                self.lift(m.piece);
            }
            self.put(m.piece, m.to);
        }
        self.set_last_moved(m.piece);
        self.ply += 1;
        self.hash ^= SIDE_KEY;
        self.update_state();
    }

    /// Plays a move if it is legal.
    pub fn play(&mut self, m: Move) -> Result<(), String> {
        if self.state.is_over() {
            return Err("The game is over.".into());
        }
        if !self.legal_moves().contains(&m) {
            return Err(self.explain_illegal(m));
        }
        self.play_unchecked(m);
        Ok(())
    }

    pub fn undo(&mut self) -> Option<Move> {
        let e = self.history.pop()?;
        let m = e.mv;
        if !m.is_pass() {
            self.lift(m.piece);
            if !m.is_placement() {
                self.put(m.piece, m.from);
            }
        }
        self.set_last_moved(e.prev_last_moved);
        self.ply -= 1;
        self.hash ^= SIDE_KEY;
        self.state = e.prev_state;
        Some(m)
    }

    fn update_state(&mut self) {
        let w = self.occupied_neighbors(queen_of(Color::White)) == 6;
        let b = self.occupied_neighbors(queen_of(Color::Black)) == 6;
        self.state = match (w, b) {
            (true, true) => GameState::Draw,
            (true, false) => GameState::BlackWins,
            (false, true) => GameState::WhiteWins,
            _ if self.ply == 0 => GameState::NotStarted,
            _ => GameState::InProgress,
        };
    }

    /// Ends the game by agreement or resignation (not part of the move rules).
    pub fn set_result(&mut self, state: GameState) {
        self.state = state;
    }

    // ---- Move generation ------------------------------------------------

    pub fn legal_moves(&mut self) -> Vec<Move> {
        let mut out = Vec::with_capacity(128);
        self.generate_moves(&mut out);
        out
    }

    pub fn generate_moves(&mut self, out: &mut Vec<Move>) {
        out.clear();
        if self.state.is_over() {
            return;
        }
        let pinned = self.pinned_pieces();
        self.generate_moves_for(self.to_move(), self.last_moved, pinned, out);
        if out.is_empty() {
            out.push(Move::PASS);
        }
    }

    /// Moves `color` could make if it were their turn, with `stunned` unable to
    /// move (used by the evaluator to measure both sides' mobility). Doesn't add
    /// a pass when there are no moves.
    pub fn generate_moves_for(&mut self, color: Color, stunned: PieceId, pinned: u32, out: &mut Vec<Move>) {
        out.clear();
        self.generate_placements(color, out);
        if self.queen_placed(color) {
            for p in pieces_of(color) {
                if self.in_hand(p) || !self.on_top(p) || p == stunned {
                    continue;
                }
                self.generate_piece_moves(p, pinned, stunned, out);
            }
        }
        out.sort_unstable();
        out.dedup();
    }

    /// Moves available to a single piece on the board (including Pillbug throws
    /// of that piece by the side to move's pillbug/mosquito). Used by the UI.
    pub fn moves_for_piece(&mut self, p: PieceId) -> Vec<Move> {
        self.legal_moves().into_iter().filter(|m| m.piece == p).collect()
    }

    /// 1-based turn number of `color` (their next move).
    pub fn turn_number_of(&self, color: Color) -> u32 {
        let made = match color {
            Color::White => (self.ply + 1) / 2,
            Color::Black => self.ply / 2,
        };
        made + 1
    }

    fn generate_placements(&self, color: Color, out: &mut Vec<Move>) {
        let turn = self.turn_number_of(color);
        let queen_in_hand = !self.queen_placed(color);
        let must_place_queen = turn == 4 && queen_in_hand;

        let mut pieces: [PieceId; NUM_BUGS] = [NO_PIECE; NUM_BUGS];
        let mut n = 0;
        for bug in ALL_BUGS {
            if !self.rules.enabled(bug) {
                continue;
            }
            if bug == Bug::Queen && turn == 1 && self.rules.tournament {
                continue;
            }
            if must_place_queen && bug != Bug::Queen {
                continue;
            }
            if let Some(p) = self.next_in_hand(color, bug) {
                pieces[n] = p;
                n += 1;
            }
        }
        if n == 0 {
            return;
        }
        let pieces = &pieces[..n];

        if self.ply == 0 {
            for &p in pieces {
                out.push(Move { piece: p, from: NO_CELL, to: ORIGIN });
            }
            return;
        }
        if self.ply == 1 {
            for &p in pieces {
                for &c in neighbors(ORIGIN) {
                    out.push(Move { piece: p, from: NO_CELL, to: c });
                }
            }
            return;
        }

        let mut seen = CellSet::new();
        for own in pieces_of(color) {
            if self.in_hand(own) || !self.on_top(own) {
                continue;
            }
            for &c in neighbors(self.pos[own as usize]) {
                if self.occupied(c) || !seen.insert(c) {
                    continue;
                }
                let ok = neighbors(c).iter().all(|&nc| {
                    let t = self.top(nc);
                    t == NO_PIECE || color_of(t) == color
                });
                if ok {
                    for &p in pieces {
                        out.push(Move { piece: p, from: NO_CELL, to: c });
                    }
                }
            }
        }
    }

    /// Bitmask of pieces that can't leave the ground without splitting the hive
    /// (articulation points of the ground-level graph).
    pub fn pinned_pieces(&self) -> u32 {
        let cells = self.occupied_cells();
        let n = cells.len();
        if n <= 2 {
            return 0;
        }
        let index_of = |c: Cell| cells.binary_search(&c).ok();
        let mut adj: Vec<[u8; 6]> = vec![[u8::MAX; 6]; n];
        for (i, &c) in cells.iter().enumerate() {
            for (d, &nc) in neighbors(c).iter().enumerate() {
                if self.occupied(nc) {
                    adj[i][d] = index_of(nc).unwrap() as u8;
                }
            }
        }
        // Iterative Tarjan articulation points.
        let mut disc = vec![0u8; n];
        let mut low = vec![0u8; n];
        let mut is_ap = vec![false; n];
        let mut timer = 1u8;
        // stack of (node, parent, next dir, child count)
        let mut st: Vec<(usize, usize, usize, u8)> = Vec::with_capacity(n);
        disc[0] = timer;
        low[0] = timer;
        timer += 1;
        st.push((0, usize::MAX, 0, 0));
        while !st.is_empty() {
            let li = st.len() - 1;
            let (u, parent, d, children) = st[li];
            if d < 6 {
                st[li].2 += 1;
                let v = adj[u][d];
                if v == u8::MAX {
                    continue;
                }
                let v = v as usize;
                if disc[v] == 0 {
                    st[li].3 += 1;
                    disc[v] = timer;
                    low[v] = timer;
                    timer += 1;
                    st.push((v, u, 0, 0));
                } else if v != parent {
                    low[u] = low[u].min(disc[v]);
                }
            } else {
                st.pop();
                if let Some(pt) = st.last() {
                    let p = pt.0;
                    low[p] = low[p].min(low[u]);
                    if pt.1 != usize::MAX && low[u] >= disc[p] {
                        is_ap[p] = true;
                    }
                } else if children > 1 {
                    is_ap[u] = true;
                }
            }
        }
        let mut mask = 0u32;
        for (i, &c) in cells.iter().enumerate() {
            if is_ap[i] {
                mask |= 1u32 << self.stack[c as usize][0];
            }
        }
        mask
    }

    #[inline]
    fn is_pinned(&self, p: PieceId, pinned: u32) -> bool {
        self.level[p as usize] == 0 && pinned & (1 << p) != 0
    }

    fn generate_piece_moves(&mut self, p: PieceId, pinned: u32, stunned: PieceId, out: &mut Vec<Move>) {
        let from = self.pos[p as usize];
        let free = !self.is_pinned(p, pinned);
        match bug_of(p) {
            Bug::Queen if free => self.gen_slides(p, from, 1, out),
            Bug::Spider if free => self.gen_slides(p, from, 3, out),
            Bug::Ant if free => self.gen_slides(p, from, 0, out),
            Bug::Beetle if free => self.gen_beetle(p, from, out),
            Bug::Grasshopper if free => self.gen_grasshopper(p, from, out),
            Bug::Ladybug if free => self.gen_ladybug(p, from, out),
            Bug::Pillbug => {
                if free {
                    self.gen_slides(p, from, 1, out);
                }
                self.gen_pillbug_throws(from, pinned, stunned, out);
            }
            Bug::Mosquito => {
                if self.level[p as usize] > 0 {
                    // On top of the hive a mosquito can only move as a beetle.
                    self.gen_beetle(p, from, out);
                    return;
                }
                let mut copied = [false; NUM_BUGS];
                for &nc in neighbors(from) {
                    let t = self.top(nc);
                    if t != NO_PIECE {
                        copied[bug_of(t) as usize] = true;
                    }
                }
                if free {
                    for bug in ALL_BUGS {
                        if !copied[bug as usize] {
                            continue;
                        }
                        match bug {
                            Bug::Queen | Bug::Pillbug => self.gen_slides(p, from, 1, out),
                            Bug::Spider => self.gen_slides(p, from, 3, out),
                            Bug::Ant => self.gen_slides(p, from, 0, out),
                            Bug::Beetle => self.gen_beetle(p, from, out),
                            Bug::Grasshopper => self.gen_grasshopper(p, from, out),
                            Bug::Ladybug => self.gen_ladybug(p, from, out),
                            Bug::Mosquito => {}
                        }
                    }
                }
                if copied[Bug::Pillbug as usize] {
                    self.gen_pillbug_throws(from, pinned, stunned, out);
                }
            }
            _ => {}
        }
    }

    /// Ground-level slide from `from` in direction `d`, with the moving piece
    /// already lifted: the target must be empty and exactly one of the two
    /// shared neighbours occupied (contact is kept and the gap isn't too narrow).
    #[inline]
    fn can_slide(&self, from: Cell, d: usize) -> bool {
        let to = neighbor(from, d);
        if self.occupied(to) {
            return false;
        }
        let l = self.occupied(neighbor(from, (d + 5) % 6));
        let r = self.occupied(neighbor(from, (d + 1) % 6));
        l != r
    }

    /// Step for pieces that can climb (beetle rules, also used for ladybug and
    /// pillbug throws). `cur` is the height of the stack the piece leaves,
    /// not counting the piece itself.
    #[inline]
    fn can_climb(&self, from: Cell, d: usize, cur: u8) -> bool {
        let to = neighbor(from, d);
        let ht = self.height(to);
        let hl = self.height(neighbor(from, (d + 5) % 6));
        let hr = self.height(neighbor(from, (d + 1) % 6));
        if cur == 0 && ht == 0 && hl == 0 && hr == 0 {
            return false;
        }
        // A "gate" of two higher stacks blocks the move.
        hl.min(hr) <= cur.max(ht)
    }

    /// Slides for queen (1), spider (exactly 3) and ant (0 = unlimited).
    fn gen_slides(&mut self, p: PieceId, from: Cell, steps: u8, out: &mut Vec<Move>) {
        self.height[from as usize] -= 1;
        let mut seen = CellSet::new();
        seen.insert(from);
        match steps {
            0 => {
                let mut queue: Vec<Cell> = vec![from];
                let mut i = 0;
                while i < queue.len() {
                    let c = queue[i];
                    i += 1;
                    for d in 0..6 {
                        if self.can_slide(c, d) {
                            let to = neighbor(c, d);
                            if seen.insert(to) {
                                out.push(Move { piece: p, from, to });
                                queue.push(to);
                            }
                        }
                    }
                }
            }
            1 => {
                for d in 0..6 {
                    if self.can_slide(from, d) {
                        out.push(Move { piece: p, from, to: neighbor(from, d) });
                    }
                }
            }
            _ => {
                let mut dests = CellSet::new();
                self.spider_walk(p, from, from, from, steps, &mut dests, out);
            }
        }
        self.height[from as usize] += 1;
    }

    #[allow(clippy::too_many_arguments)]
    fn spider_walk(&self, p: PieceId, start: Cell, prev: Cell, cur: Cell, left: u8, dests: &mut CellSet, out: &mut Vec<Move>) {
        if left == 0 {
            if dests.insert(cur) {
                out.push(Move { piece: p, from: start, to: cur });
            }
            return;
        }
        for d in 0..6 {
            let to = neighbor(cur, d);
            if to != prev && to != start && self.can_slide(cur, d) {
                self.spider_walk(p, start, cur, to, left - 1, dests, out);
            }
        }
    }

    fn gen_beetle(&self, p: PieceId, from: Cell, out: &mut Vec<Move>) {
        let cur = self.height(from) - 1;
        for d in 0..6 {
            if self.can_climb(from, d, cur) {
                out.push(Move { piece: p, from, to: neighbor(from, d) });
            }
        }
    }

    fn gen_grasshopper(&self, p: PieceId, from: Cell, out: &mut Vec<Move>) {
        for d in 0..6 {
            let mut to = neighbor(from, d);
            if !self.occupied(to) {
                continue;
            }
            while self.occupied(to) {
                to = neighbor(to, d);
            }
            out.push(Move { piece: p, from, to });
        }
    }

    /// Ladybug: two steps on top of the hive, then one step down.
    fn gen_ladybug(&mut self, p: PieceId, from: Cell, out: &mut Vec<Move>) {
        self.height[from as usize] -= 1;
        let mut dests = CellSet::new();
        for d1 in 0..6 {
            let n1 = neighbor(from, d1);
            if !self.occupied(n1) || !self.can_climb(from, d1, 0) {
                continue;
            }
            let h1 = self.height(n1);
            for d2 in 0..6 {
                let n2 = neighbor(n1, d2);
                if !self.occupied(n2) || !self.can_climb(n1, d2, h1) {
                    continue;
                }
                let h2 = self.height(n2);
                for d3 in 0..6 {
                    let n3 = neighbor(n2, d3);
                    if n3 != from && !self.occupied(n3) && self.can_climb(n2, d3, h2) && dests.insert(n3) {
                        out.push(Move { piece: p, from, to: n3 });
                    }
                }
            }
        }
        self.height[from as usize] += 1;
    }

    /// Pillbug special ability (also used by a mosquito next to a pillbug):
    /// lift an adjacent unstacked piece onto the user and drop it on an empty
    /// cell next to the user.
    fn gen_pillbug_throws(&mut self, user: Cell, pinned: u32, stunned: PieceId, out: &mut Vec<Move>) {
        if self.height(user) != 1 {
            return;
        }
        for d in 0..6 {
            let src = neighbor(user, d);
            if self.height(src) != 1 {
                continue;
            }
            let t = self.stack[src as usize][0];
            if t == stunned || pinned & (1 << t) != 0 {
                continue;
            }
            // Up onto the user (from src towards user).
            if !self.can_climb(src, (d + 3) % 6, 0) {
                continue;
            }
            self.height[src as usize] = 0;
            for d2 in 0..6 {
                let to = neighbor(user, d2);
                if to != src && !self.occupied(to) && self.can_climb(user, d2, 1) {
                    out.push(Move { piece: t, from: src, to });
                }
            }
            self.height[src as usize] = 1;
        }
    }

    fn explain_illegal(&mut self, m: Move) -> String {
        if m.is_pass() {
            return "You can't pass when you have a legal move.".into();
        }
        let color = self.to_move();
        if !self.piece_enabled(m.piece) {
            return "That piece isn't used in this game.".into();
        }
        if m.is_placement() {
            if color_of(m.piece) != color {
                return "It isn't that player's turn.".into();
            }
            if bug_of(m.piece) == Bug::Queen && self.turn_number() == 1 && self.rules.tournament {
                return "Tournament rule: the Queen can't be placed on your first turn.".into();
            }
            if self.turn_number() == 4 && !self.queen_placed(color) && bug_of(m.piece) != Bug::Queen {
                return "You must place your Queen Bee by your fourth turn.".into();
            }
            return "A new piece must touch only your own pieces.".into();
        }
        if !self.queen_placed(color) {
            return "You can't move pieces until your Queen Bee is placed.".into();
        }
        if m.piece == self.last_moved {
            return "That piece was just moved and can't move this turn.".into();
        }
        if !self.on_top(m.piece) {
            return "That piece is covered by a beetle.".into();
        }
        "That piece can't move there.".into()
    }

    // ---- Misc -----------------------------------------------------------

    /// Number of times the current position (incl. side to move) has occurred.
    pub fn repetitions(&self) -> u32 {
        let mut count = 1;
        for e in self.history.iter().rev() {
            if e.prev_hash == self.hash {
                count += 1;
            }
            if e.mv.is_placement() {
                break; // positions before a placement can't repeat
            }
        }
        count
    }

    pub fn moves_played(&self) -> Vec<Move> {
        self.history.iter().map(|e| e.mv).collect()
    }
}
