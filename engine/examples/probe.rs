//! Prints the legal moves of one piece: cargo run --example probe -- "<GameString>" <piece> [casual]
use hive_engine::notation::{move_to_string, parse_game_string};
use hive_engine::pieces::parse_piece_name;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let tournament = args.get(3).map(|s| s != "casual").unwrap_or(true);
    let mut g = match parse_game_string(&args[1], tournament) {
        Ok(g) => g,
        Err(e) => {
            println!("ERROR {}", e);
            return;
        }
    };
    let p = parse_piece_name(&args[2]).expect("piece");
    let moves = g.moves_for_piece(p);
    println!("{} to move, {} moves for {}:", g.to_move().name(), moves.len(), args[2]);
    for m in moves {
        println!("  {}", move_to_string(&g, m));
    }
}
