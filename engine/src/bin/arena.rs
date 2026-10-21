//! Plays CPU levels (or a network) against each other to measure strength.
//!
//! cargo run --release --features native --bin arena -- <white> <black> [games] [time_ms] [--net path] [--rules Base+MLP]
//! Levels: easy, medium, hard, expert. "expert" uses the network from --net;
//! "expertb" plays as Expert with the network from --net-b (to compare two networks).

use hive_engine::ai::{Ai, Level};
use hive_engine::notation::move_to_string;
use hive_engine::{Game, GameState, Rules};
use rayon::prelude::*;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let spec_a = args.get(1).cloned().unwrap_or_else(|| "hard".into());
    let spec_b = args.get(2).cloned().unwrap_or_else(|| "medium".into());
    let level = |s: &str| if s == "expertb" { Level::Expert } else { Level::parse(s).expect("level") };
    let (a, b) = (level(&spec_a), level(&spec_b));
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
    let net_b_bytes = args.iter().position(|s| s == "--net-b").map(|i| std::fs::read(&args[i + 1]).expect("read net-b"));

    let results: Vec<(i32, u32)> = (0..games)
        .into_par_iter()
        .map(|i| {
            let (white, black) = if i % 2 == 0 { (a, b) } else { (b, a) };
            let (white_spec, black_spec) = if i % 2 == 0 { (&spec_a, &spec_b) } else { (&spec_b, &spec_a) };
            let mut ais: Vec<Ai> = [white_spec, black_spec]
                .iter()
                .enumerate()
                .map(|(k, spec)| {
                    let mut ai = Ai::new(1000 + i as u64 * 7 + k as u64, 18);
                    let bytes = if spec.as_str() == "expertb" { &net_b_bytes } else { &net_bytes };
                    if let Some(bytes) = bytes {
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
    println!("{} vs {}: +{} -{} ={}  (avg {:.0} plies)", spec_a, spec_b, wins, losses, draws, avg_len);
}
