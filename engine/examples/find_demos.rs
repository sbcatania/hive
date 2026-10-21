//! Searches random games for small positions that show off one bug's movement.
//! cargo run --release --example find_demos -- <BugLetter> <min_moves> <max_moves> <min_pieces> <max_pieces> [Base+MLP]
use hive_engine::ai::Rng;
use hive_engine::notation::{game_string, move_to_string};
use hive_engine::pieces::*;
use hive_engine::{Game, Rules};

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let bug = Bug::from_letter(a[1].chars().next().unwrap()).unwrap();
    let (lo, hi): (usize, usize) = (a[2].parse().unwrap(), a[3].parse().unwrap());
    let (pmin, pmax): (usize, usize) = (a[4].parse().unwrap(), a[5].parse().unwrap());
    let rules = a.get(6).map(|s| Rules::parse_game_type(s, false).unwrap()).unwrap_or(Rules { tournament: false, ..Rules::default() });
    let mut rng = Rng::new(7);
    let mut found = 0;
    for _ in 0..200000 {
        let mut g = Game::new(rules);
        for _ in 0..pmax + 4 {
            if g.state.is_over() {
                break;
            }
            let moves = g.legal_moves();
            // Prefer placements so positions stay compact.
            let pl: Vec<_> = moves.iter().copied().filter(|m| m.is_placement() && bug_of(m.piece) != bug).collect();
            let m = if !pl.is_empty() && rng.next_f64() < 0.85 { pl[rng.below(pl.len())] } else { moves[rng.below(moves.len())] };
            g.play_unchecked(m);
            let n = g.occupied_cells().len();
            if n < pmin || n > pmax {
                continue;
            }
            let me = g.to_move();
            for p in pieces_of(me) {
                if bug_of(p) != bug || g.in_hand(p) {
                    continue;
                }
                let ms = if bug == Bug::Pillbug { g.legal_moves() } else { g.moves_for_piece(p) };
                // For the pillbug, count throws of enemy pieces instead.
                let own: Vec<_> = ms.iter().filter(|m| if bug == Bug::Pillbug { !m.is_pass() && color_of(m.piece) != me } else { m.piece == p }).collect();
                if own.len() >= lo && own.len() <= hi {
                    let strs: Vec<String> = own.iter().map(|&&m| move_to_string(&g, m)).collect();
                    println!("{}\t{}\t{:?}", game_string(&g), piece_name(p), strs);
                    found += 1;
                    if found >= 5 {
                        return;
                    }
                }
            }
        }
    }
}
