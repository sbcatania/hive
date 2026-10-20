//! Move-generation tests against Mzinga's reference test cases (see tests/data/README.md).

use hive_engine::notation::{move_to_string, parse_game_string, parse_move};
use hive_engine::{perft, Game, Move};
use std::collections::BTreeSet;

fn cases(file: &str) -> Vec<Vec<String>> {
    let path = format!("{}/tests/data/{}", env!("CARGO_MANIFEST_DIR"), file);
    let text = std::fs::read_to_string(path).unwrap();
    text.lines()
        .map(|l| l.trim_start_matches('\u{feff}').trim())
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .map(|l| l.split('\t').map(|s| s.to_string()).collect())
        .collect()
}

fn load(gs: &str) -> Game {
    parse_game_string(gs, true).unwrap_or_else(|e| panic!("{}: {}", gs, e))
}

fn run_perft(file: &str, max_depth: u32) {
    for c in cases(file) {
        let depth: u32 = c[1].parse().unwrap();
        if depth > max_depth {
            continue;
        }
        let expected: u64 = c[2].parse().unwrap();
        let mut g = load(&c[0]);
        assert_eq!(perft(&mut g, depth), expected, "{} depth {}", c[0], depth);
    }
}

#[test]
fn perft_base() {
    run_perft("Board_Base_PerftTest.csv", 5);
}
#[test]
#[ignore]
fn perft_deep() {
    run_perft("Board_Base_PerftTest.csv", 6);
    run_perft("Board_BaseMLP_PerftTest.csv", 5);
    run_perft("Board_BaseP_PerftTest.csv", 6);
}
#[test]
fn perft_m() {
    run_perft("Board_BaseM_PerftTest.csv", 5);
}
#[test]
fn perft_l() {
    run_perft("Board_BaseL_PerftTest.csv", 5);
}
#[test]
fn perft_p() {
    run_perft("Board_BaseP_PerftTest.csv", 5);
}
#[test]
fn perft_ml() {
    run_perft("Board_BaseML_PerftTest.csv", 4);
}
#[test]
fn perft_mp() {
    run_perft("Board_BaseMP_PerftTest.csv", 4);
}
#[test]
fn perft_lp() {
    run_perft("Board_BaseLP_PerftTest.csv", 4);
}
#[test]
fn perft_mlp() {
    run_perft("Board_BaseMLP_PerftTest.csv", 4);
}

fn parse_set(g: &Game, list: &str) -> BTreeSet<Move> {
    list.split(';')
        .filter(|s| !s.trim().is_empty())
        .map(|s| parse_move(g, s).unwrap_or_else(|e| panic!("{}: {}", s, e)))
        .collect()
}

fn check_listed_moves_valid(file: &str) {
    for c in cases(file) {
        let mut g = load(&c[0]);
        let legal: BTreeSet<Move> = g.legal_moves().into_iter().collect();
        for m in parse_set(&g, &c[1]) {
            assert!(legal.contains(&m), "{}: expected {} to be legal", c[0], move_to_string(&g, m));
        }
    }
}

#[test]
fn valid_moves_per_bug() {
    for f in [
        "Board_ValidMovesForQueenBeeTest.csv",
        "Board_ValidMovesForSpiderTest.csv",
        "Board_ValidMovesForBeetleTest.csv",
        "Board_ValidMovesForGrasshopperTest.csv",
        "Board_ValidMovesForSoldierAntTest.csv",
        "Board_ValidMovesForMosquitoTest.csv",
        "Board_ValidMovesForLadybugTest.csv",
        "Board_ValidMovesForPillbugTest.csv",
    ] {
        check_listed_moves_valid(f);
    }
}

/// Positions from real expansion games: the full set of legal moves must match exactly.
#[test]
fn valid_moves_from_real_games() {
    for c in cases("Board_ValidMovesFromRealGamesTest.csv") {
        let mut g = load(&c[0]);
        let expected = parse_set(&g, &c[1]);
        let actual: BTreeSet<Move> = g.legal_moves().into_iter().collect();
        if expected != actual {
            let missing: Vec<String> = expected.difference(&actual).map(|&m| move_to_string(&g, m)).collect();
            let extra: Vec<String> = actual.difference(&expected).map(|&m| move_to_string(&g, m)).collect();
            panic!("{}\nmissing: {:?}\nextra: {:?}", c[0], missing, extra);
        }
    }
}

#[test]
fn invalid_moves_rejected() {
    for c in cases("Board_InvalidMovesByRuleTest.csv") {
        let mut g = load(&c[0]);
        if let Ok(m) = parse_move(&g, &c[1]) {
            assert!(g.play(m).is_err(), "{}: {} should be illegal", c[0], c[1]);
        }
    }
}

#[test]
fn notation_round_trip() {
    for c in cases("Board_ValidMovesFromRealGamesTest.csv") {
        let mut g = load(&c[0]);
        for m in g.legal_moves() {
            let s = move_to_string(&g, m);
            assert_eq!(parse_move(&g, &s).unwrap(), m, "{}: {}", c[0], s);
        }
        let gs = hive_engine::notation::game_string(&g);
        let g2 = load(&gs);
        assert_eq!(g2.hash, g.hash);
    }
}

#[test]
fn undo_restores_hash() {
    for c in cases("Board_ValidMovesFromRealGamesTest.csv") {
        let mut g = load(&c[0]);
        let h = g.hash;
        for m in g.legal_moves() {
            g.play_unchecked(m);
            g.undo();
            assert_eq!(g.hash, h);
        }
    }
}
