//! Generates puzzles from CPU-vs-CPU games: positions with exactly one winning
//! move ("win in 1") or few first moves that force a win in two ("win in 2").
//! cargo run --release --example find_puzzles -- <rules> <count> <seed>  (prints JSON lines)

use hive_engine::ai::{Ai, Level, Rng};
use hive_engine::notation::move_history_strings;
use hive_engine::notation::move_to_string;
use hive_engine::search::{Limits, Searcher, WIN};
use hive_engine::{Game, GameState, Rules};

fn mover_wins(g: &Game, mover_white: bool) -> bool {
    matches!((g.state, mover_white), (GameState::WhiteWins, true) | (GameState::BlackWins, false))
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let rules = Rules::parse_game_type(a.get(1).map(String::as_str).unwrap_or("Base+MLP"), true).unwrap();
    let want: usize = a.get(2).and_then(|s| s.parse().ok()).unwrap_or(6);
    let seed: u64 = a.get(3).and_then(|s| s.parse().ok()).unwrap_or(1);
    let mut rng = Rng::new(seed);
    let mut searcher = Searcher::new(18);
    let (mut win1, mut win2) = (0, 0);
    for game in 0..400 {
        if win1 >= want && win2 >= want {
            break;
        }
        let mut g = Game::new(rules);
        let mut ais = [Ai::new(seed * 100 + game * 2, 16), Ai::new(seed * 100 + game * 2 + 1, 16)];
        let levels = [if rng.next_f64() < 0.5 { Level::Medium } else { Level::Easy }, Level::Medium];
        while !g.state.is_over() && g.ply < 160 {
            if g.ply >= 14 {
                let white = g.ply % 2 == 0;
                let moves = g.legal_moves();
                let winners: Vec<_> = moves
                    .iter()
                    .filter(|&&m| {
                        g.play_unchecked(m);
                        let w = mover_wins(&g, white);
                        g.undo();
                        w
                    })
                    .copied()
                    .collect();
                let strs = |g: &Game, ms: &[hive_engine::Move]| ms.iter().map(|&m| move_to_string(g, m)).collect::<Vec<_>>();
                if winners.len() == 1 && win1 < want && rng.next_f64() < 0.5 {
                    println!(
                        "{}",
                        serde_json::json!({ "kind": "win1", "rules": rules.game_type_string(), "moves": move_history_strings(&g), "solutions": strs(&g, &winners) })
                    );
                    win1 += 1;
                } else if winners.is_empty() && win2 < want {
                    let r = searcher.search(&mut g, Limits { max_depth: 3, time_ms: 8000.0 }, true, 0);
                    let forcing: Vec<_> = r.root_scores.iter().filter(|s| s.1 >= WIN - 10).map(|s| s.0).collect();
                    if r.depth == 3 && (1..=2).contains(&forcing.len()) {
                        println!(
                            "{}",
                            serde_json::json!({ "kind": "win2", "rules": rules.game_type_string(), "moves": move_history_strings(&g), "solutions": strs(&g, &forcing) })
                        );
                        win2 += 1;
                    }
                }
            }
            let i = (g.ply % 2) as usize;
            let m = ais[i].choose(&mut g, levels[i], Some(300.0)).best;
            g.play_unchecked(m);
        }
    }
    eprintln!("found {} win-in-1, {} win-in-2", win1, win2);
}
