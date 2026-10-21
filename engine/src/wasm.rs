//! WebAssembly bindings. Everything crosses the boundary as plain JS objects
//! (via serde) shaped like the types in `web/src/lib/engine-types.ts`.

use crate::ai::{Ai, Level};
use crate::game::{Game, GameState, Move, Rules};
use crate::hex::*;
use crate::layout::Layout;
use crate::nn::Network;
use crate::notation::{game_string, move_history_strings, move_to_string, parse_game_string, parse_move};
use crate::pieces::parse_piece_name;
use crate::pieces::*;
use serde::Serialize;
use wasm_bindgen::prelude::*;

fn to_js<T: Serialize>(v: &T) -> JsValue {
    v.serialize(&serde_wasm_bindgen::Serializer::json_compatible()).unwrap()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PieceView {
    name: String,
    color: &'static str,
    bug: char,
    q: i32,
    r: i32,
    level: u8,
    on_top: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HandView {
    bug: char,
    count: u8,
    next: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MoveView {
    piece: String,
    /// Null for placements.
    from: Option<(i32, i32)>,
    to: (i32, i32),
    /// Height the piece will sit at (0 = ground).
    to_level: u8,
    notation: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StateView {
    rules: Rules,
    status: &'static str,
    to_move: &'static str,
    turn: u32,
    ply: u32,
    pieces: Vec<PieceView>,
    hands: [Vec<HandView>; 2],
    legal_moves: Vec<MoveView>,
    must_pass: bool,
    last_moved: Option<String>,
    last_move: Option<MoveView>,
    history: Vec<String>,
    game_string: String,
    queen_neighbors: [u8; 2],
    repetitions: u32,
    end_reason: Option<&'static str>,
    standard_rules: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PreviewView {
    /// Whether these are the side to move's legal moves (false = next-turn preview).
    legal: bool,
    moves: Vec<MoveView>,
    /// Why the piece can't move, when it has no moves.
    reason: Option<String>,
}

fn parse_rules(v: JsValue) -> Result<Rules, JsError> {
    serde_wasm_bindgen::from_value::<Rules>(v).map(|r| r.normalized()).map_err(|e| JsError::new(&e.to_string()))
}

/// Builds a game from rules and a list of UHP move strings.
fn game_from_moves(rules: Rules, moves: &str) -> Result<Game, JsError> {
    let mut g = Game::new(rules);
    for (i, ms) in moves.split(';').map(str::trim).filter(|s| !s.is_empty()).enumerate() {
        let m = parse_move(&g, ms).map_err(|e| JsError::new(&format!("Move {}: {}", i + 1, e)))?;
        g.play(m).map_err(|e| JsError::new(&format!("Move {} ('{}'): {}", i + 1, ms, e)))?;
    }
    Ok(g)
}

fn color_str(c: Color) -> &'static str {
    match c {
        Color::White => "w",
        Color::Black => "b",
    }
}

fn move_view(g: &Game, layout: &Layout, m: Move) -> MoveView {
    MoveView {
        piece: piece_name(m.piece),
        from: if m.from == NO_CELL { None } else { Some(layout.coords(m.from)) },
        to: layout.coords(m.to),
        to_level: if g.top(m.to) == m.piece { g.height(m.to) - 1 } else { g.height(m.to) },
        notation: move_to_string(g, m),
    }
}

#[wasm_bindgen]
pub struct HiveGame {
    game: Game,
}

#[wasm_bindgen]
impl HiveGame {
    #[wasm_bindgen(constructor)]
    pub fn new(mosquito: bool, ladybug: bool, pillbug: bool, tournament: bool) -> HiveGame {
        HiveGame { game: Game::new(Rules::with_expansions(mosquito, ladybug, pillbug, tournament)) }
    }

    /// Creates a game from a full rules object (see `Rules` in engine-types.ts).
    #[wasm_bindgen(js_name = withRules)]
    pub fn with_rules(rules: JsValue) -> Result<HiveGame, JsError> {
        Ok(HiveGame { game: Game::new(parse_rules(rules)?) })
    }

    #[wasm_bindgen(js_name = fromGameString)]
    pub fn from_game_string(s: &str, tournament: bool) -> Result<HiveGame, JsError> {
        parse_game_string(s, tournament).map(|game| HiveGame { game }).map_err(|e| JsError::new(&e))
    }

    #[wasm_bindgen(js_name = gameString)]
    pub fn game_string(&self) -> String {
        game_string(&self.game)
    }

    pub fn state(&mut self) -> JsValue {
        let g = &mut self.game;
        let moves = g.legal_moves();
        let layout = Layout::new(g);
        let mut pieces = Vec::new();
        for p in 0..NUM_PIECES as PieceId {
            if g.in_hand(p) {
                continue;
            }
            let (q, r) = layout.coords(g.position(p));
            pieces.push(PieceView {
                name: piece_name(p),
                color: color_str(color_of(p)),
                bug: bug_of(p).letter(),
                q,
                r,
                level: g.level_of(p),
                on_top: g.on_top(p),
            });
        }
        let hands = [Color::White, Color::Black].map(|c| {
            ALL_BUGS
                .iter()
                .filter(|&&b| g.rules.enabled(b))
                .map(|&b| HandView { bug: b.letter(), count: g.hand_count(c, b), next: g.next_in_hand(c, b).map(piece_name) })
                .collect()
        });
        let must_pass = moves.len() == 1 && moves[0].is_pass();
        let legal_moves = moves.iter().filter(|m| !m.is_pass()).map(|&m| move_view(g, &layout, m)).collect();
        let last_move = g.history.last().map(|e| e.mv).filter(|m| !m.is_pass()).map(|m| MoveView {
            piece: piece_name(m.piece),
            from: if m.from == NO_CELL { None } else { Some(layout.coords(m.from)) },
            to: layout.coords(m.to),
            to_level: g.level_of(m.piece),
            notation: String::new(),
        });
        let view = StateView {
            rules: g.rules,
            status: g.state.as_str(),
            to_move: color_str(g.to_move()),
            turn: g.turn_number(),
            ply: g.ply,
            pieces,
            hands,
            legal_moves,
            must_pass,
            last_moved: if g.last_moved == NO_PIECE { None } else { Some(piece_name(g.last_moved)) },
            last_move,
            history: move_history_strings(g),
            game_string: game_string(g),
            queen_neighbors: [g.occupied_neighbors(queen_of(Color::White)), g.occupied_neighbors(queen_of(Color::Black))],
            repetitions: g.repetitions(),
            end_reason: g.end_reason(),
            standard_rules: g.rules.is_standard(),
        };
        to_js(&view)
    }

    /// Where a piece could move (legal now, or next turn for the other side),
    /// plus an explanation when it can't move at all.
    pub fn preview(&mut self, piece: &str) -> Result<JsValue, JsError> {
        let p = parse_piece_name(piece).ok_or_else(|| JsError::new("Unknown piece"))?;
        let g = &mut self.game;
        let legal = color_of(p) == g.to_move();
        let moves = g.preview_moves(p);
        let layout = Layout::new(g);
        let views = moves.iter().map(|&m| move_view(g, &layout, m)).collect();
        let reason = if moves.is_empty() { g.why_immobile(p) } else { None };
        Ok(to_js(&PreviewView { legal, moves: views, reason }))
    }

    /// Plays a UHP move string. Returns the normalised move string.
    pub fn play(&mut self, move_str: &str) -> Result<String, JsError> {
        let m = parse_move(&self.game, move_str).map_err(|e| JsError::new(&e))?;
        let s = move_to_string(&self.game, m);
        self.game.play(m).map_err(|e| JsError::new(&e))?;
        Ok(s)
    }

    pub fn undo(&mut self) -> bool {
        self.game.undo().is_some()
    }

    /// Ends the game by resignation, timeout or agreement: "WhiteWins", "BlackWins" or "Draw".
    #[wasm_bindgen(js_name = setResult)]
    pub fn set_result(&mut self, result: &str) {
        let st = match result {
            "WhiteWins" => GameState::WhiteWins,
            "BlackWins" => GameState::BlackWins,
            _ => GameState::Draw,
        };
        self.game.set_result(st);
    }

    pub fn ply(&self) -> u32 {
        self.game.ply
    }
}

#[wasm_bindgen]
pub struct HiveAi {
    ai: Ai,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AiView {
    best: String,
    score_white: i32,
    white_win_prob: f64,
    depth: u32,
    nodes: u64,
    pv: Vec<String>,
    engine: String,
}

#[wasm_bindgen]
impl HiveAi {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: f64) -> HiveAi {
        HiveAi { ai: Ai::new(seed as u64, 17) }
    }

    #[wasm_bindgen(js_name = loadNetwork)]
    pub fn load_network(&mut self, bytes: &[u8]) -> Result<String, JsError> {
        let net = Network::from_bytes(bytes).map_err(|e| JsError::new(&e))?;
        let name = net.config.name.clone();
        self.ai.network = Some(net);
        Ok(name)
    }

    #[wasm_bindgen(js_name = hasNetwork)]
    pub fn has_network(&self) -> bool {
        self.ai.network.is_some()
    }

    /// Chooses a move for the side to move. `moves` is a ';'-separated list of
    /// UHP move strings. `level`: easy | medium | hard | expert.
    pub fn choose(&mut self, rules: JsValue, moves: &str, level: &str, time_ms: f64) -> Result<JsValue, JsError> {
        let mut g = game_from_moves(parse_rules(rules)?, moves)?;
        let level = Level::parse(level).ok_or_else(|| JsError::new("Unknown level"))?;
        let t = if time_ms > 0.0 { Some(time_ms) } else { None };
        let r = self.ai.choose(&mut g, level, t);
        Ok(self.view(&mut g, r))
    }

    pub fn analyze(&mut self, rules: JsValue, moves: &str, time_ms: f64) -> Result<JsValue, JsError> {
        let mut g = game_from_moves(parse_rules(rules)?, moves)?;
        let r = self.ai.analyze(&mut g, time_ms);
        Ok(self.view(&mut g, r))
    }

    fn view(&self, g: &mut Game, r: crate::ai::AiMove) -> JsValue {
        let mut pv = Vec::new();
        let mut played = 0;
        for &m in &r.pv {
            if !g.legal_moves().contains(&m) {
                break;
            }
            pv.push(move_to_string(g, m));
            g.play_unchecked(m);
            played += 1;
        }
        for _ in 0..played {
            g.undo();
        }
        to_js(&AiView {
            best: move_to_string(g, r.best),
            score_white: r.score_white,
            white_win_prob: r.white_win_prob,
            depth: r.depth,
            nodes: r.nodes,
            pv,
            engine: r.engine,
        })
    }
}
