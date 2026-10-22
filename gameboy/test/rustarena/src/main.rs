//! Plays the C AI (test/cplayer, over a pipe) against the reference Rust
//! engine's AI. Usage: rustarena <cplayer> <c_level> <rust_level> <rust_ms> <games> [seed]
use hive_engine::ai::{Ai, Level};
use hive_engine::hex::signed_coords;
use hive_engine::pieces::bug_of;
use hive_engine::{Game, GameState, Move, Rules};
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

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
    let a: Vec<String> = std::env::args().collect();
    let c_level: u32 = a[2].parse().unwrap();
    let r_level = Level::parse(&a[3]).unwrap();
    let r_ms: f64 = a[4].parse().unwrap();
    let games: u32 = a[5].parse().unwrap();
    let seed: u64 = a.get(6).and_then(|s| s.parse().ok()).unwrap_or(1);
    let mut child = Command::new(&a[1]).stdin(Stdio::piped()).stdout(Stdio::piped()).spawn().unwrap();
    let mut cin = child.stdin.take().unwrap();
    let mut cout = BufReader::new(child.stdout.take().unwrap());
    let mut ask = |cmd: String| -> String {
        writeln!(cin, "{}", cmd).unwrap();
        cin.flush().unwrap();
        let mut l = String::new();
        cout.read_line(&mut l).unwrap();
        l.trim().to_string()
    };
    let (mut w, mut d, mut l, mut capped, mut bad) = (0, 0, 0, 0, 0);
    let mut plies_total = 0u32;
    for gi in 0..games {
        let c_white = gi % 2 == 0;
        let mut ai = Ai::new(seed * 1000 + gi as u64 + 1, 18);
        let mut g = Game::new(Rules::base());
        ask(format!("N {} {}", c_level, (seed * 7919 + gi as u64) % 65536));
        let mut ok = true;
        let mut plies = 0;
        while !g.state.is_over() && plies < 200 {
            let c_turn = (g.to_move() == hive_engine::Color::White) == c_white;
            if c_turn {
                let s = ask("G".into());
                match g.legal_moves().into_iter().find(|m| fmt(m) == s) {
                    Some(m) => g.play_unchecked(m),
                    None => {
                        eprintln!("game {}: C move {} not legal in Rust", gi, s);
                        ok = false;
                        break;
                    }
                }
            } else {
                let r = ai.choose(&mut g, r_level, Some(r_ms));
                let s = fmt(&r.best);
                if ask(format!("M {}", s)) != "OK" {
                    // Usually a move that stretches the hive past the C board.
                    ok = false;
                    break;
                }
                g.play_unchecked(r.best);
            }
            plies += 1;
        }
        plies_total += plies;
        if !ok {
            bad += 1;
            continue;
        }
        match g.state {
            GameState::WhiteWins => if c_white { w += 1 } else { l += 1 },
            GameState::BlackWins => if c_white { l += 1 } else { w += 1 },
            GameState::Draw => d += 1,
            _ => { capped += 1; d += 1 }
        }
    }
    println!("C(level {}) vs Rust {:?} {}ms: {} games  C wins {}  draws {} (capped {})  C losses {}  aborted {}  avg plies {:.0}",
             c_level, r_level, r_ms, games, w, d, capped, l, bad, plies_total as f64 / games as f64);
}
