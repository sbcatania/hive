//! Plays CPU levels (or a network) against each other to measure strength.
//!
//! cargo run --release --features native --bin arena -- <white> <black> [games] [time_ms] [--net path] [--rules Base+MLP]
//! Levels: easy, medium, hard, expert. "expert" uses the network if --net is given.

use hive_engine::ai::{Ai, Level};
use hive_engine::notation::move_to_string;
use hive_engine::{Game, GameState, Rules};
use rayon::prelude::*;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let a = Level::parse(args.get(1).map(String::as_str).unwrap_or("hard")).expect("level");
    let b = Level::parse(args.get(2).map(String::as_str).unwrap_or("medium")).expect("level");
    let games: usize = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(10);
    let time_ms: f64 = args.get(4).and_then(|s| s.parse().ok()).unwrap_or(500.0);
    let net_path = args.iter().position(|s| s == "--net").map(|i| args[i + 1].clone());
    let rules = args
        .iter()
        .position(|s| s == "--rules")
        .map(|i| Rules::parse_game_type(&args[i + 1], true).expect("rules"))
        .unwrap_or_default();
    let verbose = args.iter().any(|s| s == "-v");
    let net_bytes = net_path.map(|p| std::fs::read(p).expect("read net"));

    let results: Vec<(i32, u32)> = (0..games)
        .into_par_iter()
        .map(|i| {
            let (white, black) = if i % 2 == 0 { (a, b) } else { (b, a) };
            let mut ais: Vec<Ai> = (0..2)
                .map(|k| {
                    let mut ai = Ai::new(1000 + i as u64 * 7 + k, 18);
                    if let Some(bytes) = &net_bytes {
                        ai.network = Some(hive_engine::nn::Network::from_bytes(bytes).unwrap());
                    }
                    ai
                })
                .collect();
            let mut g = Game::new(rules);
            let mut log = Vec::new();
            while !g.state.is_over() && g.ply < 300 {
                let level = if g.ply % 2 == 0 { white } else { black };
                let r = ais[(g.ply % 2) as usize].choose(&mut g, level, Some(time_ms));
                log.push(format!("{}(d{})", move_to_string(&g, r.best), r.depth));
                g.play(r.best).unwrap();
            }
            if verbose {
                eprintln!("game {}: {:?} {}", i, g.state, log.join(" "));
            }
            // +1 if level `a` won.
            let a_is_white = i % 2 == 0;
            let score = match g.state {
                GameState::WhiteWins => if a_is_white { 1 } else { -1 },
                GameState::BlackWins => if a_is_white { -1 } else { 1 },
                _ => 0,
            };
            (score, g.ply)
        })
        .collect();

    let wins = results.iter().filter(|r| r.0 == 1).count();
    let losses = results.iter().filter(|r| r.0 == -1).count();
    let draws = results.len() - wins - losses;
    let avg_len = results.iter().map(|r| r.1 as f64).sum::<f64>() / results.len() as f64;
    println!("{:?} vs {:?}: +{} -{} ={}  (avg {:.0} plies)", a, b, wins, losses, draws, avg_len);
}
