/// Difficulty presets and adaptive difficulty logic.
///
/// Each difficulty level maps to specific AI parameters
/// (search depth for minimax, simulation count for MCTS).
/// Adaptive mode adjusts based on win/loss history.

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Available difficulty levels.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Difficulty {
    Beginner,
    Easy,
    Medium,
    Hard,
    Expert,
    Adaptive,
}

/// Which AI engine to use.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum AiEngine {
    Minimax,
    Mcts,
}

/// Complete AI configuration for a game.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AiConfig {
    pub engine: AiEngine,
    pub difficulty: Difficulty,
    /// For adaptive mode: recent win/loss record (last N games).
    /// Stored as a list of booleans (true = player won).
    pub adaptive_history: Vec<bool>,
}

impl AiConfig {
    pub fn new(engine: AiEngine, difficulty: Difficulty) -> Self {
        AiConfig {
            engine,
            difficulty,
            adaptive_history: Vec::new(),
        }
    }
}

/// Parameters that control the AI search.
pub struct SearchParams {
    /// Max depth for minimax.
    pub max_depth: u32,
    /// Max simulations for MCTS.
    pub max_simulations: u32,
    /// Time limit for the search.
    pub time_limit: Duration,
}

/// Get search parameters for a given difficulty and engine.
pub fn search_params(config: &AiConfig) -> SearchParams {
    let effective_difficulty = if config.difficulty == Difficulty::Adaptive {
        adaptive_level(&config.adaptive_history)
    } else {
        config.difficulty.clone()
    };

    match (&config.engine, &effective_difficulty) {
        // Minimax depths and time limits.
        (AiEngine::Minimax, Difficulty::Beginner) => SearchParams {
            max_depth: 1,
            max_simulations: 0,
            time_limit: Duration::from_millis(500),
        },
        (AiEngine::Minimax, Difficulty::Easy) => SearchParams {
            max_depth: 2,
            max_simulations: 0,
            time_limit: Duration::from_secs(1),
        },
        (AiEngine::Minimax, Difficulty::Medium) => SearchParams {
            max_depth: 3,
            max_simulations: 0,
            time_limit: Duration::from_secs(3),
        },
        (AiEngine::Minimax, Difficulty::Hard) => SearchParams {
            max_depth: 4,
            max_simulations: 0,
            time_limit: Duration::from_secs(5),
        },
        (AiEngine::Minimax, Difficulty::Expert) => SearchParams {
            max_depth: 6,
            max_simulations: 0,
            time_limit: Duration::from_secs(10),
        },

        // MCTS simulation counts and time limits.
        (AiEngine::Mcts, Difficulty::Beginner) => SearchParams {
            max_depth: 0,
            max_simulations: 100,
            time_limit: Duration::from_millis(500),
        },
        (AiEngine::Mcts, Difficulty::Easy) => SearchParams {
            max_depth: 0,
            max_simulations: 500,
            time_limit: Duration::from_secs(1),
        },
        (AiEngine::Mcts, Difficulty::Medium) => SearchParams {
            max_depth: 0,
            max_simulations: 2000,
            time_limit: Duration::from_secs(3),
        },
        (AiEngine::Mcts, Difficulty::Hard) => SearchParams {
            max_depth: 0,
            max_simulations: 5000,
            time_limit: Duration::from_secs(5),
        },
        (AiEngine::Mcts, Difficulty::Expert) => SearchParams {
            max_depth: 0,
            max_simulations: 20000,
            time_limit: Duration::from_secs(10),
        },

        // Adaptive redirects to a concrete level (handled above).
        (_, Difficulty::Adaptive) => unreachable!(),
    }
}

/// Determine the effective difficulty based on the adaptive history.
/// Looks at the last 10 games and adjusts accordingly.
fn adaptive_level(history: &[bool]) -> Difficulty {
    let recent: Vec<bool> = history.iter().rev().take(10).cloned().collect();
    if recent.is_empty() {
        return Difficulty::Medium; // Start at medium.
    }

    let win_rate = recent.iter().filter(|&&w| w).count() as f64 / recent.len() as f64;

    if win_rate >= 0.8 {
        Difficulty::Expert
    } else if win_rate >= 0.6 {
        Difficulty::Hard
    } else if win_rate >= 0.4 {
        Difficulty::Medium
    } else if win_rate >= 0.2 {
        Difficulty::Easy
    } else {
        Difficulty::Beginner
    }
}
