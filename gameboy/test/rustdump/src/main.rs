//! Plays random base-game games with the reference Rust engine and prints every
//! position's legal move set, so the C rules can be checked move for move.
use hive_engine::hex::signed_coords;
use hive_engine::pieces::bug_of;
use hive_engine::{Game, Move, Rules};

fn fmt(m: &Move) -> String {
    if m.is_pass() {
        return "pass".into();
    }
    let (tq, tr) = signed_coords(m.to);
    let from = if m.is_placement() {
        "h".to_string()
    } else {
        let (fq, fr) = signed_coords(m.from);
        format!("{},{}", fq, fr)
    };
    format!("{} {} {},{}", bug_of(m.piece) as u8, from, tq, tr)
}

fn main() {
    let games: u64 = std::env::args().nth(1).and_then(|s| s.parse().ok()).unwrap_or(200);
    let mut seed: u64 = 0x9E3779B97F4A7C15;
    let mut rnd = move || {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        seed
    };
    for _ in 0..games {
        let mut g = Game::new(Rules::base());
        println!("G");
        for _ in 0..300 {
            if g.state.is_over() {
                break;
            }
            let moves = g.legal_moves();
            let mut s: Vec<String> = moves.iter().map(fmt).collect();
            s.sort();
            println!("P {}", s.len());
            for x in &s {
                println!("{}", x);
            }
            let m = moves[(rnd() % moves.len() as u64) as usize];
            // Stay well inside the C engine's 16x16 torus.
            if !m.is_pass() {
                let (q, r) = signed_coords(m.to);
                if q.abs() > 6 || r.abs() > 6 {
                    break;
                }
            }
            println!("M {}", fmt(&m));
            g.play_unchecked(m);
        }
        println!("E {:?}", g.state);
    }
}
