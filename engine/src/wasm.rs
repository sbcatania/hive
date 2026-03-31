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

    let weights = EvalWeights::default();
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

/// Get all available game presets as JSON.
#[wasm_bindgen]
pub fn get_presets() -> Result<String, JsValue> {
    let presets = crate::rules::GamePreset::all_presets();
    serde_json::to_string(&presets)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {}", e)))
}
