/// WASM bindings — thin wrapper that exposes the engine to JavaScript.
///
/// All data crosses the WASM boundary as JSON strings.
/// The Web Worker in the frontend calls these functions.

use wasm_bindgen::prelude::*;
use crate::ai::difficulty::{AiConfig, AiEngine, search_params};
use crate::ai::eval::EvalWeights;
use crate::game::GameState;
use crate::moves::Move;
use crate::rules::RuleConfig;

/// Create a new game with the given rule configuration (JSON string).
/// Returns the initial game state as JSON.
#[wasm_bindgen]
pub fn create_game(rules_json: &str) -> Result<String, JsValue> {
    let rules: RuleConfig = serde_json::from_str(rules_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid rules: {}", e)))?;
    let state = GameState::new(rules);
    serde_json::to_string(&state)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
}

/// Get all legal moves for the current player.
/// Returns a JSON array of Move objects.
#[wasm_bindgen]
pub fn get_legal_moves(state_json: &str) -> Result<String, JsValue> {
    let state: GameState = serde_json::from_str(state_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid state: {}", e)))?;
    let moves = state.legal_moves();
    serde_json::to_string(&moves)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
}

/// Apply a move to the game state.
/// Returns the updated game state as JSON.
#[wasm_bindgen]
pub fn apply_move(state_json: &str, move_json: &str) -> Result<String, JsValue> {
    let mut state: GameState = serde_json::from_str(state_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid state: {}", e)))?;
    let action: Move = serde_json::from_str(move_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid move: {}", e)))?;
    state
        .apply_move(action)
        .map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&state)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
}

/// Undo the last move. Returns updated state as JSON.
#[wasm_bindgen]
pub fn undo_move(state_json: &str) -> Result<String, JsValue> {
    let mut state: GameState = serde_json::from_str(state_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid state: {}", e)))?;
    state.undo().map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&state)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
}

/// Redo a previously undone move. Returns updated state as JSON.
#[wasm_bindgen]
pub fn redo_move(state_json: &str) -> Result<String, JsValue> {
    let mut state: GameState = serde_json::from_str(state_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid state: {}", e)))?;
    state.redo().map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&state)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
}

/// Run the AI to pick a move. Returns the chosen Move as JSON.
///
/// `ai_config_json` specifies the engine (minimax/mcts) and difficulty.
#[wasm_bindgen]
pub fn ai_pick_move(state_json: &str, ai_config_json: &str) -> Result<String, JsValue> {
    let state: GameState = serde_json::from_str(state_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid state: {}", e)))?;
    let ai_config: AiConfig = serde_json::from_str(ai_config_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid AI config: {}", e)))?;

    let weights = ai_config.custom_weights.clone().unwrap_or_default();
    let params = search_params(&ai_config);

    let best_move = match ai_config.engine {
        AiEngine::Minimax => {
            let result = crate::ai::minimax::search(
                &state,
                params.max_depth,
                params.time_limit,
                &weights,
            );
            result.best_move
        }
        AiEngine::Mcts => {
            let result = crate::ai::mcts::search(
                &state,
                params.max_simulations,
                params.time_limit,
                &weights,
            );
            result.best_move
        }
    };

    serde_json::to_string(&best_move)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
}

/// Evaluate the current board position for the given player.
/// Returns a JSON object with score, win probability, and detailed stats.
#[wasm_bindgen]
pub fn evaluate_position(state_json: &str, player_json: &str) -> Result<String, JsValue> {
    let state: GameState = serde_json::from_str(state_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid state: {}", e)))?;
    let player: crate::piece::Color = serde_json::from_str(player_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid player: {}", e)))?;

    let weights = EvalWeights::default();
    let score = crate::ai::eval::evaluate(&state, player, &weights);
    let stats = crate::ai::eval::position_stats(&state, player);

    // Convert raw score to win probability using sigmoid: P = 1 / (1 + e^(-score/k))
    let k = 30.0; // Scaling factor — tuned so a ~30 point lead ≈ 73% win prob
    let win_prob = if score.is_infinite() {
        if score > 0.0 { 1.0 } else { 0.0 }
    } else {
        1.0 / (1.0 + (-score / k).exp())
    };

    let result = serde_json::json!({
        "score": if score.is_infinite() { if score > 0.0 { 9999.0 } else { -9999.0 } } else { score },
        "winProbability": win_prob,
        "stats": stats,
    });

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
}

/// Analyze a move: returns classification (Brilliant/Good/Inaccuracy/Mistake/Blunder)
/// and the score change. Compares position eval before and after the move.
#[wasm_bindgen]
pub fn analyze_move(state_json: &str, move_json: &str) -> Result<String, JsValue> {
    let state: GameState = serde_json::from_str(state_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid state: {}", e)))?;
    let action: Move = serde_json::from_str(move_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid move: {}", e)))?;

    let player = state.current_player;
    let weights = EvalWeights::default();

    // Score before the move (from current player's perspective).
    let score_before = crate::ai::eval::evaluate(&state, player, &weights);

    // Apply the move.
    let mut new_state = state.clone();
    new_state.apply_move(action)
        .map_err(|e| JsValue::from_str(&e))?;

    // Score after (still from original player's perspective).
    let score_after = crate::ai::eval::evaluate(&new_state, player, &weights);

    // Find the best possible move's score for comparison.
    let legal = crate::moves::all_legal_moves(&state);
    let mut best_score = f64::NEG_INFINITY;
    for m in &legal {
        let mut temp = state.clone();
        if temp.apply_move(m.clone()).is_ok() {
            let s = crate::ai::eval::evaluate(&temp, player, &weights);
            if s > best_score {
                best_score = s;
            }
        }
    }

    let delta = score_after - best_score; // How far from the best move (always ≤ 0)
    let k = 30.0;
    let win_prob_before = if score_before.is_infinite() {
        if score_before > 0.0 { 1.0 } else { 0.0 }
    } else {
        1.0 / (1.0 + (-score_before / k).exp())
    };
    let win_prob_after = if score_after.is_infinite() {
        if score_after > 0.0 { 1.0 } else { 0.0 }
    } else {
        1.0 / (1.0 + (-score_after / k).exp())
    };

    // Classify using expected points loss (delta from best).
    let classification = if delta >= -1.0 {
        if score_after > score_before + 10.0 { "Brilliant" } else { "Best" }
    } else if delta >= -5.0 {
        "Good"
    } else if delta >= -15.0 {
        "Inaccuracy"
    } else if delta >= -30.0 {
        "Mistake"
    } else {
        "Blunder"
    };

    let result = serde_json::json!({
        "classification": classification,
        "scoreBefore": if score_before.is_infinite() { if score_before > 0.0 { 9999.0 } else { -9999.0 } } else { score_before },
        "scoreAfter": if score_after.is_infinite() { if score_after > 0.0 { 9999.0 } else { -9999.0 } } else { score_after },
        "bestScore": if best_score.is_infinite() { if best_score > 0.0 { 9999.0 } else { -9999.0 } } else { best_score },
        "delta": delta,
        "winProbBefore": win_prob_before,
        "winProbAfter": win_prob_after,
    });

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
}

/// Get all available game presets as JSON.
#[wasm_bindgen]
pub fn get_presets() -> Result<String, JsValue> {
    let presets = crate::rules::GamePreset::all_presets();
    serde_json::to_string(&presets)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
}
