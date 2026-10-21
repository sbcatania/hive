//! Self-play data generator for training the Expert network.
//!
//! cargo run --release --features native --bin selfplay -- --games 200 --out training/data/gen0 [--net model.bin]
//!   [--sims 200] [--threads N] [--seed S] [--ab-depth 2] [--rules mixed|Base+MLP|...]
//!
//! Without --net, games are played by the alpha-beta engine (bootstrap data);
//! with --net, by MCTS guided by the network. Record format: see
//! training/hive_train/data.py.

use hive_engine::ai::Rng;
use hive_engine::features::{encode, Source, NUM_GLOBALS};
use hive_engine::mcts::{Mcts, MctsConfig};
use hive_engine::nn::Network;
use hive_engine::search::{Limits, Searcher, WIN};
use hive_engine::{Game, GameState, Move, Rules};
use rayon::prelude::*;
use std::io::Write;
use std::sync::atomic::{AtomicUsize, Ordering};

struct Args {
    games: usize,
    out: String,
    net: Option<String>,
    sims: u32,
    threads: usize,
    seed: u64,
    ab_depth: u32,
    rules: String,
    max_ply: u32,
}

fn parse_args() -> Args {
    let a: Vec<String> = std::env::args().collect();
    let get = |k: &str| a.iter().position(|s| s == k).map(|i| a[i + 1].clone());
    Args {
        games: get("--games").map(|s| s.parse().unwrap()).unwrap_or(100),
        out: get("--out").unwrap_or_else(|| "training/data/selfplay".into()),
        net: get("--net"),
        sims: get("--sims").map(|s| s.parse().unwrap()).unwrap_or(200),
        threads: get("--threads").map(|s| s.parse().unwrap()).unwrap_or_else(rayon::current_num_threads),
        seed: get("--seed").map(|s| s.parse().unwrap()).unwrap_or_else(|| std::process::id() as u64 * 7919),
        ab_depth: get("--ab-depth").map(|s| s.parse().unwrap()).unwrap_or(2),
        rules: get("--rules").unwrap_or_else(|| "mixed".into()),
        max_ply: get("--max-ply").map(|s| s.parse().unwrap()).unwrap_or(300),
    }
}

fn pick_rules(spec: &str, rng: &mut Rng) -> Rules {
    if spec != "mixed" {
        return Rules::parse_game_type(spec, true).expect("bad --rules");
    }
    // Every expansion combination appears; the full set most often.
    let combo = if rng.next_f64() < 0.4 { 7 } else { rng.below(8) };
    Rules::with_expansions(combo & 1 != 0, combo & 2 != 0, combo & 4 != 0, rng.next_f64() < 0.85)
}

struct Record {
    bytes: Vec<u8>,
    side_white: bool,
}

fn encode_record(g: &mut Game, targets: &[(Move, f32)]) -> Record {
    let moves: Vec<Move> = targets.iter().map(|t| t.0).collect();
    let e = encode(g, &moves);
    let mut b = Vec::with_capacity(512);
    b.extend_from_slice(&(e.sparse.len() as u16).to_le_bytes());
    for &(plane, cell, v) in &e.sparse {
        b.push(plane);
        b.extend_from_slice(&cell.to_le_bytes());
        b.push(v);
    }
    for v in e.globals.iter().take(NUM_GLOBALS) {
        b.extend_from_slice(&v.to_le_bytes());
    }
    b.extend_from_slice(&(moves.len() as u16).to_le_bytes());
    for (i, &(src, dst)) in e.moves.iter().enumerate() {
        let (kind, bug, sc) = match src {
            Source::Hand(bug) => (0u8, bug, 0u16),
            Source::Cell(c, bug) => (1u8, bug, c),
            Source::Pass => (2u8, 0, 0),
        };
        b.push(kind);
        b.push(bug);
        b.extend_from_slice(&sc.to_le_bytes());
        b.extend_from_slice(&dst.to_le_bytes());
        b.extend_from_slice(&targets[i].1.to_le_bytes());
    }
    Record { bytes: b, side_white: g.ply % 2 == 0 }
}

fn softmax_scores(scores: &[(Move, i32)], temp: f64) -> Vec<(Move, f32)> {
    let max = scores.iter().map(|s| s.1).max().unwrap() as f64;
    let w: Vec<f64> = scores.iter().map(|s| ((s.1 as f64 - max) / temp).exp()).collect();
    let sum: f64 = w.iter().sum();
    scores.iter().zip(w).map(|(s, wi)| (s.0, (wi / sum) as f32)).collect()
}

fn sample(targets: &[(Move, f32)], rng: &mut Rng) -> Move {
    let mut r = rng.next_f64() as f32;
    for t in targets {
        r -= t.1;
        if r <= 0.0 {
            return t.0;
        }
    }
    targets.last().unwrap().0
}

/// Plays one game and returns its records with value targets filled in.
fn play_game(args: &Args, net: Option<&Network>, searcher: &mut Searcher, rng: &mut Rng) -> (Vec<u8>, GameState, u32) {
    let mut g = Game::new(pick_rules(&args.rules, rng));
    let mut records: Vec<Record> = Vec::new();
    let opening_random = 10 + rng.below(8) as u32;
    while !g.state.is_over() && g.ply < args.max_ply && g.repetitions() < 3 {
        let rotation = rng.below(6);
        let (targets, chosen) = match net {
            None => {
                let r = searcher.search(&mut g, Limits { max_depth: args.ab_depth, time_ms: 5000.0 }, true, rotation);
                let targets = softmax_scores(&r.root_scores, 40.0);
                let chosen = if r.score >= WIN - 1000 {
                    r.best
                } else if g.ply < opening_random {
                    sample(&softmax_scores(&r.root_scores, 60.0), rng)
                } else {
                    sample(&softmax_scores(&r.root_scores, 15.0), rng)
                };
                (targets, chosen)
            }
            Some(net) => {
                let cfg = MctsConfig { max_simulations: args.sims, dirichlet_frac: 0.25, max_ply: args.max_ply, ..MctsConfig::default() };
                let r = Mcts::new(cfg).search(&mut g, net, rng, rotation);
                let total: u32 = r.visits.iter().map(|v| v.1).sum::<u32>().max(1);
                let targets: Vec<(Move, f32)> = r.visits.iter().map(|&(m, n)| (m, n as f32 / total as f32)).collect();
                let chosen = if g.ply < opening_random { sample(&targets, rng) } else { r.best };
                (targets, chosen)
            }
        };
        if targets.len() > 1 {
            records.push(encode_record(&mut g, &targets));
        }
        g.play_unchecked(chosen);
    }
    let result = if g.state.is_over() {
        g.state
    } else if g.repetitions() >= 3 {
        GameState::Draw
    } else {
        // Hit the move cap: adjudicate clear advantages so the value targets aren't all draws.
        let r = searcher.search(&mut g, Limits { max_depth: 3, time_ms: 5000.0 }, false, 0);
        let white_score = if g.ply % 2 == 0 { r.score } else { -r.score };
        if white_score > 200 {
            GameState::WhiteWins
        } else if white_score < -200 {
            GameState::BlackWins
        } else {
            GameState::Draw
        }
    };
    let mut out = Vec::new();
    for r in records {
        let z: f32 = match result {
            GameState::WhiteWins => if r.side_white { 1.0 } else { -1.0 },
            GameState::BlackWins => if r.side_white { -1.0 } else { 1.0 },
            _ => 0.0,
        };
        out.extend_from_slice(&r.bytes);
        out.extend_from_slice(&z.to_le_bytes());
    }
    (out, result, g.ply)
}

fn main() {
    let args = parse_args();
    std::fs::create_dir_all(&args.out).expect("create output dir");
    let net = args.net.as_ref().map(|p| Network::from_bytes(&std::fs::read(p).expect("read net")).expect("load net"));
    let done = AtomicUsize::new(0);
    let stats = std::sync::Mutex::new([0usize; 3]);
    let started = std::time::Instant::now();
    rayon::ThreadPoolBuilder::new().num_threads(args.threads).build_global().ok();
    (0..args.threads).into_par_iter().for_each(|t| {
        let mut rng = Rng::new(args.seed.wrapping_mul(1_000_003).wrapping_add(t as u64 * 7_777 + 1));
        let mut searcher = Searcher::new(18);
        let path = format!("{}/sp-{}-{}.bin", args.out, args.seed, t);
        let mut f = std::io::BufWriter::new(std::fs::File::create(&path).expect("create file"));
        loop {
            let i = done.fetch_add(1, Ordering::SeqCst);
            if i >= args.games {
                break;
            }
            let (bytes, result, plies) = play_game(&args, net.as_ref(), &mut searcher, &mut rng);
            f.write_all(&bytes).unwrap();
            f.flush().unwrap();
            let mut s = stats.lock().unwrap();
            match result {
                GameState::WhiteWins => s[0] += 1,
                GameState::BlackWins => s[1] += 1,
                _ => s[2] += 1,
            }
            let n = s.iter().sum::<usize>();
            if n % 10 == 0 || n == args.games {
                eprintln!(
                    "{}/{} games  W {} B {} D {}  last {} plies  {:.1}s/game",
                    n,
                    args.games,
                    s[0],
                    s[1],
                    s[2],
                    plies,
                    started.elapsed().as_secs_f64() * args.threads as f64 / n as f64
                );
            }
        }
    });
}
