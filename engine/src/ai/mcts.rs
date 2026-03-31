/// Monte Carlo Tree Search (MCTS) for Hive.
///
/// MCTS works by repeatedly:
/// 1. Selecting a promising node (UCB1)
/// 2. Expanding it with a random child
/// 3. Simulating a random game from that child
/// 4. Backpropagating the result
///
/// This approach is good for Hive because the branching factor is high
/// and it doesn't need a perfect evaluation function.

use crate::ai::eval::EvalWeights;
use crate::game::{GameState, GameStatus};
use crate::moves::{Move, all_legal_moves};
use crate::piece::Color;
use rand::seq::SliceRandom;
use rand::thread_rng;
use std::time::Duration;

/// Result of an MCTS search.
pub struct MctsResult {
    pub best_move: Move,
    pub visit_count: u32,
    pub win_rate: f64,
    pub simulations: u32,
}

/// A node in the MCTS tree.
struct MctsNode {
    action: Option<Move>,  // The move that led to this node (None for root).
    state: GameState,
    children: Vec<MctsNode>,
    visits: u32,
    wins: f64,             // From the perspective of the player who made `action`.
    untried_moves: Vec<Move>,
    player: Color,         // The player who just moved to reach this node.
}

impl MctsNode {
    fn new(state: GameState, action: Option<Move>, player: Color) -> Self {
        let untried = if state.status == GameStatus::InProgress {
            all_legal_moves(&state)
        } else {
            Vec::new()
        };

        MctsNode {
            action,
            state,
            children: Vec::new(),
            visits: 0,
            wins: 0.0,
            untried_moves: untried,
            player,
        }
    }

    /// UCB1 score for child selection.
    fn ucb1(&self, parent_visits: u32, exploration: f64) -> f64 {
        if self.visits == 0 {
            return f64::INFINITY;
        }
        let exploitation = self.wins / self.visits as f64;
        let explore = exploration * ((parent_visits as f64).ln() / self.visits as f64).sqrt();
        exploitation + explore
    }

    /// Is this node fully expanded (all moves tried)?
    fn is_fully_expanded(&self) -> bool {
        self.untried_moves.is_empty()
    }

    /// Is this a terminal node?
    fn is_terminal(&self) -> bool {
        self.state.status != GameStatus::InProgress
    }
}

/// Run MCTS search for the given number of simulations.
/// The time_limit parameter is accepted for API compatibility but not enforced
/// (std::time::Instant doesn't work in WASM). The simulation count is the real limit.
pub fn search(
    state: &GameState,
    max_simulations: u32,
    _time_limit: Duration,
    _weights: &EvalWeights,
) -> MctsResult {
    let player = state.current_player;
    let mut root = MctsNode::new(state.clone(), None, player.opponent());

    let mut sim_count = 0u32;

    while sim_count < max_simulations {
        // 1. Selection + 2. Expansion
        let mut node_path = vec![0usize]; // Indices into the tree.
        let leaf = select_and_expand(&mut root, &mut node_path);

        // 3. Simulation
        let result = simulate(leaf, player);

        // 4. Backpropagation
        backpropagate(&mut root, &node_path, result, player);

        sim_count += 1;
    }

    // Pick the child with the most visits.
    let best_child = root
        .children
        .iter()
        .max_by_key(|c| c.visits);

    match best_child {
        Some(child) => MctsResult {
            best_move: child.action.clone().unwrap_or(Move::Pass),
            visit_count: child.visits,
            win_rate: if child.visits > 0 {
                child.wins / child.visits as f64
            } else {
                0.0
            },
            simulations: sim_count,
        },
        None => MctsResult {
            best_move: Move::Pass,
            visit_count: 0,
            win_rate: 0.0,
            simulations: sim_count,
        },
    }
}

/// Select the most promising leaf node, expanding if needed.
fn select_and_expand<'a>(
    node: &'a mut MctsNode,
    _path: &mut Vec<usize>,
) -> &'a mut MctsNode {
    // If not fully expanded, expand a random untried move.
    if !node.is_fully_expanded() && !node.is_terminal() {
        let mut rng = thread_rng();
        let idx = rand::Rng::gen_range(&mut rng, 0..node.untried_moves.len());
        let action = node.untried_moves.swap_remove(idx);

        let mut child_state = node.state.clone();
        let player = child_state.current_player;
        let _ = child_state.apply_move(action.clone());

        let child = MctsNode::new(child_state, Some(action), player);
        node.children.push(child);

        let last_idx = node.children.len() - 1;
        return &mut node.children[last_idx];
    }

    // If terminal, return this node.
    if node.is_terminal() || node.children.is_empty() {
        return node;
    }

    // Select best child by UCB1.
    let parent_visits = node.visits;
    let best_idx = node
        .children
        .iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| {
            a.ucb1(parent_visits, 1.414)
                .partial_cmp(&b.ucb1(parent_visits, 1.414))
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(i, _)| i)
        .unwrap_or(0);

    _path.push(best_idx);
    select_and_expand(&mut node.children[best_idx], _path)
}

/// Simulate a random game from the given node and return the result.
/// Returns 1.0 for a win for `player`, 0.0 for a loss, 0.5 for a draw.
fn simulate(node: &MctsNode, player: Color) -> f64 {
    let mut state = node.state.clone();
    let mut rng = thread_rng();
    let max_turns = 200; // Safety limit.
    let mut turns = 0;

    while state.status == GameStatus::InProgress && turns < max_turns {
        let moves = all_legal_moves(&state);
        if moves.is_empty() {
            break;
        }
        let action = moves.choose(&mut rng).unwrap().clone();
        let _ = state.apply_move(action);
        turns += 1;
    }

    match state.status {
        GameStatus::WhiteWins => {
            if player == Color::White { 1.0 } else { 0.0 }
        }
        GameStatus::BlackWins => {
            if player == Color::Black { 1.0 } else { 0.0 }
        }
        GameStatus::Draw => 0.5,
        GameStatus::InProgress => 0.5, // Reached turn limit — treat as draw.
    }
}

/// Backpropagate the simulation result up the tree.
fn backpropagate(
    root: &mut MctsNode,
    path: &[usize],
    result: f64,
    player: Color,
) {
    // Update root.
    root.visits += 1;
    if root.player == player {
        root.wins += result;
    } else {
        root.wins += 1.0 - result;
    }

    // Walk down the path updating each node.
    let mut current = root;
    for &idx in path.iter().skip(1) {
        if idx < current.children.len() {
            current = &mut current.children[idx];
            current.visits += 1;
            if current.player == player {
                current.wins += result;
            } else {
                current.wins += 1.0 - result;
            }
        }
    }
}
