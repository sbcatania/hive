//! Rule invariants checked over many random games.

use hive_engine::hex::neighbors;
use hive_engine::pieces::*;
use hive_engine::{Game, Move, Rules};
use std::collections::HashSet;

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn pick<T: Copy>(&mut self, v: &[T]) -> T {
        v[(self.next() % v.len() as u64) as usize]
    }
}

fn hive_connected(g: &Game) -> bool {
    let cells = g.occupied_cells();
    if cells.is_empty() {
        return true;
    }
    let set: HashSet<_> = cells.iter().copied().collect();
    let mut seen = HashSet::new();
    let mut stack = vec![cells[0]];
    while let Some(c) = stack.pop() {
        if !seen.insert(c) {
            continue;
        }
        for &n in neighbors(c) {
            if set.contains(&n) {
                stack.push(n);
            }
        }
    }
    seen.len() == cells.len()
}

fn random_games(rules: Rules, games: u64, check: impl Fn(&mut Game, &[Move])) {
    let mut rng = Rng(0x1234_5678_9abc_def1);
    for _ in 0..games {
        let mut g = Game::new(rules);
        for _ in 0..200 {
            if g.state.is_over() {
                break;
            }
            let moves = g.legal_moves();
            check(&mut g, &moves);
            g.play_unchecked(rng.pick(&moves));
            assert!(hive_connected(&g), "hive split");
        }
    }
}

#[test]
fn stunned_piece_never_moves() {
    random_games(Rules::default(), 300, |g, moves| {
        let lm = g.last_moved;
        assert!(lm == NO_PIECE || moves.iter().all(|m| m.piece != lm));
    });
}

#[test]
fn placements_touch_only_own_color() {
    random_games(Rules::default(), 200, |g, moves| {
        if g.ply < 2 {
            return;
        }
        let me = g.to_move();
        for m in moves.iter().filter(|m| m.is_placement()) {
            assert!(!g.occupied(m.to));
            let mut touches_own = false;
            for &n in neighbors(m.to) {
                if g.occupied(n) {
                    assert_eq!(color_of(g.top(n)), me);
                    touches_own = true;
                }
            }
            assert!(touches_own);
        }
    });
}

#[test]
fn queen_deadline_and_tournament_opening() {
    random_games(Rules::default(), 200, |g, moves| {
        let me = g.to_move();
        if g.turn_number() == 1 {
            assert!(moves.iter().all(|m| m.piece != queen_of(me)));
        }
        if g.turn_number() == 4 && !g.queen_placed(me) {
            assert!(moves.iter().all(|m| m.piece == queen_of(me)));
        }
        if !g.queen_placed(me) {
            assert!(moves.iter().all(|m| m.is_placement() || m.is_pass()));
        }
    });
    let mut casual = Game::new(Rules { tournament: false, ..Rules::default() });
    assert!(casual.legal_moves().iter().any(|m| m.piece == queen_of(Color::White)));
}

#[test]
fn moves_land_on_ground_except_climbers() {
    random_games(Rules::default(), 200, |g, moves| {
        for m in moves.iter().filter(|m| !m.is_placement() && !m.is_pass()) {
            let climbs = g.occupied(m.to);
            if climbs {
                let bug = bug_of(m.piece);
                assert!(bug == Bug::Beetle || bug == Bug::Mosquito, "{:?} climbed", bug);
            }
        }
    });
}

#[test]
fn expansions_disabled_are_absent() {
    random_games(Rules::base(), 100, |_, moves| {
        for m in moves.iter().filter(|m| !m.is_pass()) {
            assert!(!bug_of(m.piece).is_expansion());
        }
    });
}

#[test]
fn undo_round_trip() {
    let mut rng = Rng(42);
    for _ in 0..50 {
        let mut g = Game::new(Rules::default());
        let mut hashes = vec![g.hash];
        for _ in 0..120 {
            if g.state.is_over() {
                break;
            }
            let moves = g.legal_moves();
            g.play_unchecked(rng.pick(&moves));
            hashes.push(g.hash);
        }
        while g.undo().is_some() {
            hashes.pop();
            assert_eq!(g.hash, *hashes.last().unwrap());
        }
    }
}

// ---- Variants ---------------------------------------------------------------

#[test]
fn piece_counts_limit_hand_and_moves() {
    let mut counts = hive_engine::game::STANDARD_COUNTS;
    counts[Bug::Spider as usize] = 0;
    counts[Bug::Ant as usize] = 1;
    let rules = Rules { counts, ..Rules::base() };
    random_games(rules, 100, |g, moves| {
        for m in moves.iter().filter(|m| m.is_placement()) {
            assert_ne!(bug_of(m.piece), Bug::Spider);
            if bug_of(m.piece) == Bug::Ant {
                assert_eq!(number_of(m.piece), 1);
            }
        }
        assert!(g.hand_count(Color::White, Bug::Ant) <= 1);
    });
}

#[test]
fn queen_deadline_variant() {
    let rules = Rules { queen_deadline: 3, ..Rules::default() };
    random_games(rules, 100, |g, moves| {
        let me = g.to_move();
        if g.turn_number() >= 3 && !g.queen_placed(me) {
            assert!(moves.iter().all(|m| m.piece == queen_of(me)));
        }
    });
}

#[test]
fn surround_threshold_ends_game_earlier() {
    let rules = Rules { surround: 5, ..Rules::default() };
    let mut rng = Rng(99);
    let mut wins = 0;
    for _ in 0..300 {
        let mut g = Game::new(rules);
        while !g.state.is_over() && g.ply < 200 {
            let moves = g.legal_moves();
            g.play_unchecked(rng.pick(&moves));
        }
        if g.state.is_over() && g.end_reason() == Some("surround") {
            let max = g.occupied_neighbors(queen_of(Color::White)).max(g.occupied_neighbors(queen_of(Color::Black)));
            assert!(max >= 5);
            wins += 1;
        }
    }
    assert!(wins > 0);
}

#[test]
fn turn_limit_adjudicates() {
    let rules = Rules { turn_limit: 12, ..Rules::default() };
    let mut rng = Rng(5);
    for _ in 0..50 {
        let mut g = Game::new(rules);
        while !g.state.is_over() {
            let moves = g.legal_moves();
            g.play_unchecked(rng.pick(&moves));
            assert!(g.ply <= 24);
        }
        if g.end_reason() == Some("turn-limit") {
            let (w, b) = (g.occupied_neighbors(queen_of(Color::White)), g.occupied_neighbors(queen_of(Color::Black)));
            let expected = match w.cmp(&b) {
                std::cmp::Ordering::Less => hive_engine::GameState::WhiteWins,
                std::cmp::Ordering::Greater => hive_engine::GameState::BlackWins,
                _ => hive_engine::GameState::Draw,
            };
            assert_eq!(g.state, expected);
        }
    }
}

#[test]
fn repetition_draw_variant() {
    // Shuffle two queens back and forth until the position repeats three times.
    let rules = Rules { repetition_draw: true, ..Rules::base() };
    let mut g = hive_engine::notation::parse_game_string("Base;InProgress;White[3];wS1;bS1 wS1-;wQ -wS1;bQ bS1-", true).unwrap();
    g.rules = rules;
    let shuffle = ["wQ \\wS1", "bQ bS1/", "wQ -wS1", "bQ bS1-"];
    let mut i = 0;
    while !g.state.is_over() && i < 12 {
        let m = hive_engine::notation::parse_move(&g, shuffle[i % 4]).unwrap();
        g.play(m).unwrap();
        i += 1;
    }
    assert_eq!(g.state, hive_engine::GameState::Draw);
    assert_eq!(g.end_reason(), Some("repetition"));
    assert_eq!(i, 8);
}

#[test]
fn preview_and_explanations() {
    let mut g = hive_engine::notation::parse_game_string("Base;InProgress;White[3];wS1;bS1 wS1-;wQ -wS1;bQ bS1-", true).unwrap();
    // White to move: Black's queen preview shows its slides next turn.
    let bq = queen_of(Color::Black);
    assert!(!g.preview_moves(bq).is_empty());
    // White's spider is pinned between the queen and the rest of the hive.
    let ws1 = hive_engine::pieces::parse_piece_name("wS1").unwrap();
    assert!(g.why_immobile(ws1).unwrap().contains("One Hive"));
}
