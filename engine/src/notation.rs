//! Universal Hive Protocol (UHP) move strings and game strings.
//!
//! `wS1` (first move), `bS1 wS1-` (east of wS1), `wB1 bQ` (on top of bQ), `pass`.
//! Direction marks: `X-` E, `X\` SE, `/X` SW, `-X` W, `\X` NW, `X/` NE.

use crate::game::{Game, GameState, Move, Rules};
use crate::hex::*;
use crate::pieces::*;

/// Formats `m` relative to the current position (call before playing it).
pub fn move_to_string(g: &Game, m: Move) -> String {
    if m.is_pass() {
        return "pass".into();
    }
    let name = piece_name(m.piece);
    if g.ply == 0 {
        return name;
    }
    if g.occupied(m.to) && g.top(m.to) != m.piece {
        return format!("{} {}", name, piece_name(g.top(m.to)));
    }
    for d in 0..6 {
        let n = neighbor(m.to, d);
        let stack = g.stack_at(n);
        // Ignore the moving piece itself when it is next to its destination.
        let reference = match stack.last() {
            Some(&t) if t == m.piece => stack.iter().rev().nth(1).copied(),
            Some(&t) => Some(t),
            None => None,
        };
        if let Some(r) = reference {
            let rn = piece_name(r);
            // Destination lies in direction (d + 3) % 6 of the reference piece.
            return match (d + 3) % 6 {
                0 => format!("{} {}-", name, rn),
                1 => format!("{} {}\\", name, rn),
                2 => format!("{} /{}", name, rn),
                3 => format!("{} -{}", name, rn),
                4 => format!("{} \\{}", name, rn),
                _ => format!("{} {}/", name, rn),
            };
        }
    }
    name
}

/// Parses a move string into a move in the current position. Does not check legality.
pub fn parse_move(g: &Game, s: &str) -> Result<Move, String> {
    let s = s.trim();
    if s.eq_ignore_ascii_case("pass") {
        return Ok(Move::PASS);
    }
    let mut parts = s.split_whitespace();
    let pstr = parts.next().ok_or("Empty move string")?;
    let piece = parse_piece_name(pstr).ok_or_else(|| format!("Unknown piece '{}'", pstr))?;
    let from = g.position(piece);
    let to = match parts.next() {
        None => ORIGIN,
        Some(rs) => {
            let (dir, rname) = if let Some(rest) = rs.strip_prefix('-') {
                (Some(3), rest)
            } else if let Some(rest) = rs.strip_prefix('/') {
                (Some(2), rest)
            } else if let Some(rest) = rs.strip_prefix('\\') {
                (Some(4), rest)
            } else if let Some(rest) = rs.strip_suffix('-') {
                (Some(0), rest)
            } else if let Some(rest) = rs.strip_suffix('/') {
                (Some(5), rest)
            } else if let Some(rest) = rs.strip_suffix('\\') {
                (Some(1), rest)
            } else {
                (None, rs)
            };
            let r = parse_piece_name(rname).ok_or_else(|| format!("Unknown piece '{}'", rname))?;
            let rc = g.position(r);
            if rc == NO_CELL {
                return Err(format!("{} is not on the board", rname));
            }
            match dir {
                Some(d) => {
                    let to = neighbor(rc, d);
                    if g.occupied(to) && g.top(to) != piece {
                        return Err(format!("'{}' points at an occupied cell; climbing is written '{} <piece>'", s, pstr));
                    }
                    to
                }
                None => rc,
            }
        }
    };
    if parts.next().is_some() {
        return Err(format!("Malformed move string '{}'", s));
    }
    Ok(Move { piece, from, to })
}

/// UHP GameString: `Base+MLP;InProgress;White[3];wS1;bS1 wS1-;...`
pub fn game_string(g: &Game) -> String {
    let mut replay = Game::new(g.rules);
    let mut s = format!(
        "{};{};{}[{}]",
        g.rules.game_type_string(),
        g.state.as_str(),
        g.to_move().name(),
        g.turn_number()
    );
    for m in g.moves_played() {
        s.push(';');
        s.push_str(&move_to_string(&replay, m));
        replay.play_unchecked(m);
    }
    s
}

/// Move strings of every move played so far.
pub fn move_history_strings(g: &Game) -> Vec<String> {
    let mut replay = Game::new(g.rules);
    g.moves_played()
        .into_iter()
        .map(|m| {
            let s = move_to_string(&replay, m);
            replay.play_unchecked(m);
            s
        })
        .collect()
}

/// Parses a UHP GameString (or a bare `Base+MLP` game type), validating every move.
pub fn parse_game_string(s: &str, tournament: bool) -> Result<Game, String> {
    let parts: Vec<&str> = s.trim().split(';').collect();
    let rules = Rules::parse_game_type(parts[0], tournament).ok_or_else(|| format!("Unknown game type '{}'", parts[0]))?;
    let mut g = Game::new(rules);
    for (i, ms) in parts.iter().enumerate().skip(3) {
        if ms.trim().is_empty() {
            continue;
        }
        let m = parse_move(&g, ms).map_err(|e| format!("Move {}: {}", i - 2, e))?;
        g.play(m).map_err(|e| format!("Move {} ('{}'): {}", i - 2, ms.trim(), e))?;
    }
    // A finished game may have been decided by resignation or agreement.
    if parts.len() > 1 {
        let st = match parts[1].trim() {
            "Draw" => Some(GameState::Draw),
            "WhiteWins" => Some(GameState::WhiteWins),
            "BlackWins" => Some(GameState::BlackWins),
            _ => None,
        };
        if let Some(st) = st {
            if !g.state.is_over() {
                g.set_result(st);
            }
        }
    }
    Ok(g)
}
