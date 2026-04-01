/// Training CLI — evolves AI evaluation weights through self-play.
///
/// Uses a genetic algorithm:
/// 1. Create a population of EvalWeights variants (random perturbations of defaults)
/// 2. Each generation: play round-robin games between the population
/// 3. Score each variant by win rate
/// 4. Keep top 50%, mutate them to create next generation
/// 5. Save the best weights as JSON

use hive_engine::ai::eval::EvalWeights;
use hive_engine::ai::minimax;
use hive_engine::game::{GameState, GameStatus};
use hive_engine::rules::RuleConfig;

use rand::Rng;
use std::time::Duration;

fn main() {
    let args: Vec<String> = std::env::args().collect();

    let name = parse_arg(&args, "--name").expect("--name <model-name> is required");
    let games: usize = parse_arg(&args, "--games")
        .map(|s| s.parse().expect("--games must be a number"))
        .unwrap_or(1000);
    let population_size: usize = parse_arg(&args, "--population")
        .map(|s| s.parse().expect("--population must be a number"))
        .unwrap_or(20);
    let save_games = args.contains(&"--save-games".to_string());

    let generations = ((games as f64 / population_size as f64).sqrt()).max(1.0) as usize;

    println!("Training model: {}", name);
    println!(
        "Population: {}, Generations: {}, ~Games per generation: {}",
        population_size,
        generations,
        population_size * (population_size - 1)
    );
    println!();

    // Initialize population with random perturbations of the default weights.
    let mut rng = rand::thread_rng();
    let mut population: Vec<EvalWeights> = (0..population_size)
        .map(|i| {
            if i == 0 {
                EvalWeights::default() // Always keep the default as a baseline.
            } else {
                mutate(&EvalWeights::default(), &mut rng, 0.5)
            }
        })
        .collect();

    for gen in 0..generations {
        // Score each individual by round-robin win rate.
        let mut scores = vec![0.0f64; population.len()];
        let mut game_count = vec![0usize; population.len()];

        for i in 0..population.len() {
            for j in (i + 1)..population.len() {
                // Play two games (each side gets white once).
                let result_1 = play_game(&population[i], &population[j]);
                let result_2 = play_game(&population[j], &population[i]);

                match result_1 {
                    GameResult::WhiteWin => {
                        scores[i] += 1.0;
                    }
                    GameResult::BlackWin => {
                        scores[j] += 1.0;
                    }
                    GameResult::Draw => {
                        scores[i] += 0.5;
                        scores[j] += 0.5;
                    }
                }
                match result_2 {
                    GameResult::WhiteWin => {
                        scores[j] += 1.0;
                    }
                    GameResult::BlackWin => {
                        scores[i] += 1.0;
                    }
                    GameResult::Draw => {
                        scores[i] += 0.5;
                        scores[j] += 0.5;
                    }
                }

                game_count[i] += 2;
                game_count[j] += 2;
            }
        }

        // Compute win rates.
        let win_rates: Vec<f64> = scores
            .iter()
            .zip(game_count.iter())
            .map(|(&s, &g)| if g > 0 { s / g as f64 } else { 0.0 })
            .collect();

        // Sort by win rate descending.
        let mut ranked: Vec<(usize, f64)> = win_rates.iter().copied().enumerate().collect();
        ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let best_idx = ranked[0].0;
        let best_rate = ranked[0].1;
        let best_weights = population[best_idx].clone();

        println!("Generation {}/{}", gen + 1, generations);
        println!("  Best win rate: {:.1}%", best_rate * 100.0);
        println!("  Best weights: {:?}", best_weights);
        println!();

        // Selection: keep top 50%.
        let survivors_count = (population_size / 2).max(1);
        let survivors: Vec<EvalWeights> = ranked
            .iter()
            .take(survivors_count)
            .map(|(idx, _)| population[*idx].clone())
            .collect();

        // Create next generation: survivors + mutations of survivors.
        let mut next_gen = survivors.clone();
        while next_gen.len() < population_size {
            let parent_idx = rng.gen_range(0..survivors.len());
            let child = mutate(&survivors[parent_idx], &mut rng, 0.3);
            next_gen.push(child);
        }

        population = next_gen;
    }

    // Final: the best individual is population[0] (carried forward from last generation).
    // Re-evaluate to find the actual best.
    let mut best_scores = vec![0.0f64; population.len()];
    let mut best_games = vec![0usize; population.len()];
    for i in 0..population.len() {
        for j in (i + 1)..population.len() {
            let r1 = play_game(&population[i], &population[j]);
            let r2 = play_game(&population[j], &population[i]);
            for (result, white_idx, black_idx) in [(r1, i, j), (r2, j, i)] {
                match result {
                    GameResult::WhiteWin => best_scores[white_idx] += 1.0,
                    GameResult::BlackWin => best_scores[black_idx] += 1.0,
                    GameResult::Draw => {
                        best_scores[white_idx] += 0.5;
                        best_scores[black_idx] += 0.5;
                    }
                }
                best_games[white_idx] += 1;
                best_games[black_idx] += 1;
            }
        }
    }

    let final_rates: Vec<f64> = best_scores
        .iter()
        .zip(best_games.iter())
        .map(|(&s, &g)| if g > 0 { s / g as f64 } else { 0.0 })
        .collect();

    let best_idx = final_rates
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, _)| i)
        .unwrap_or(0);

    let best = &population[best_idx];

    println!("=== Training Complete ===");
    println!("Best win rate: {:.1}%", final_rates[best_idx] * 100.0);
    println!("Best weights: {:?}", best);

    // Save to models/<name>.json.
    std::fs::create_dir_all("models").expect("Failed to create models directory");
    let path = format!("models/{}.json", name);
    let json = serde_json::to_string_pretty(best).expect("Failed to serialize weights");
    std::fs::write(&path, &json).expect("Failed to write model file");
    println!("Saved to {}", path);

    // Optionally save notable games for visualization.
    if save_games {
        println!("\nSaving example games with best model...");
        std::fs::create_dir_all(format!("models/{}-games", name))
            .expect("Failed to create games directory");
        let default_weights = EvalWeights::default();
        for game_num in 0..5 {
            let (result, moves) = play_game_with_moves(best, &default_weights);
            let game_record = serde_json::json!({
                "version": 1,
                "metadata": {
                    "date": format!("training-game-{}", game_num + 1),
                    "whitePlayer": format!("Trained: {}", name),
                    "blackPlayer": "Default AI",
                    "result": match result {
                        GameResult::WhiteWin => "WhiteWins",
                        GameResult::BlackWin => "BlackWins",
                        GameResult::Draw => "Draw",
                    },
                    "totalMoves": moves.len(),
                },
                "moves": moves,
            });
            let game_path = format!("models/{}-games/game-{}.hive", name, game_num + 1);
            std::fs::write(&game_path, serde_json::to_string_pretty(&game_record).unwrap())
                .expect("Failed to write game file");
            let result_str = match result {
                GameResult::WhiteWin => "White wins",
                GameResult::BlackWin => "Black wins",
                GameResult::Draw => "Draw",
            };
            println!("  Game {}: {} ({} moves)", game_num + 1, result_str, moves.len());
        }
        println!("Games saved to models/{}-games/", name);
    }
}

/// Parse a named CLI argument (e.g., --name foo).
fn parse_arg(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|a| a == flag)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

enum GameResult {
    WhiteWin,
    BlackWin,
    Draw,
}

/// Play a single game and return both result and move list (for replay).
fn play_game_with_moves(
    white_weights: &EvalWeights,
    black_weights: &EvalWeights,
) -> (GameResult, Vec<hive_engine::moves::Move>) {
    let rules = RuleConfig::standard();
    let mut state = GameState::new(rules);
    let time_limit = Duration::from_secs(60);
    let max_turns = 200u16;
    let mut moves = Vec::new();

    while state.status == GameStatus::InProgress && state.turn < max_turns {
        let weights = if state.current_player == hive_engine::piece::Color::White {
            white_weights
        } else {
            black_weights
        };

        let result = minimax::search(&state, 2, time_limit, weights);
        moves.push(result.best_move.clone());
        if state.apply_move(result.best_move).is_err() {
            break;
        }
    }

    let result = match state.status {
        GameStatus::WhiteWins => GameResult::WhiteWin,
        GameStatus::BlackWins => GameResult::BlackWin,
        _ => GameResult::Draw,
    };
    (result, moves)
}

/// Play a single game: white_weights vs black_weights using minimax depth 2.
fn play_game(white_weights: &EvalWeights, black_weights: &EvalWeights) -> GameResult {
    let rules = RuleConfig::standard();
    let mut state = GameState::new(rules);
    let time_limit = Duration::from_secs(60);
    let max_turns = 200u16;

    while state.status == GameStatus::InProgress && state.turn < max_turns {
        let weights = if state.current_player == hive_engine::piece::Color::White {
            white_weights
        } else {
            black_weights
        };

        let result = minimax::search(&state, 2, time_limit, weights);
        if state.apply_move(result.best_move).is_err() {
            break;
        }
    }

    match state.status {
        GameStatus::WhiteWins => GameResult::WhiteWin,
        GameStatus::BlackWins => GameResult::BlackWin,
        _ => GameResult::Draw,
    }
}

/// Mutate weights by applying random perturbations.
fn mutate(weights: &EvalWeights, rng: &mut impl Rng, strength: f64) -> EvalWeights {
    EvalWeights {
        queen_danger_per_neighbor: perturb(weights.queen_danger_per_neighbor, rng, strength),
        queen_attack_per_neighbor: perturb(weights.queen_attack_per_neighbor, rng, strength),
        mobility_per_move: perturb(weights.mobility_per_move, rng, strength),
        hand_piece_value: perturb(weights.hand_piece_value, rng, strength),
        beetle_near_queen_bonus: perturb(weights.beetle_near_queen_bonus, rng, strength),
        ant_on_board_bonus: perturb(weights.ant_on_board_bonus, rng, strength),
    }
}

/// Perturb a single weight value by a random factor.
fn perturb(value: f64, rng: &mut impl Rng, strength: f64) -> f64 {
    let factor = 1.0 + rng.gen_range(-strength..strength);
    value * factor
}
