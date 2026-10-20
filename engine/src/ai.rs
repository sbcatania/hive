//! CPU opponents: difficulty levels built on the alpha-beta search (and, for
//! Expert with a trained model loaded, neural-network MCTS).

use crate::game::{Game, Move};
use crate::mcts::{Mcts, MctsConfig};
use crate::nn::Network;
use crate::search::{Limits, Searcher, WIN};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Level {
    Easy,
    Medium,
    Hard,
    Expert,
}

impl Level {
    pub fn parse(s: &str) -> Option<Level> {
        Some(match s.to_ascii_lowercase().as_str() {
            "easy" => Level::Easy,
            "medium" => Level::Medium,
            "hard" => Level::Hard,
            "expert" => Level::Expert,
            _ => return None,
        })
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AiMove {
    pub best: Move,
    /// Evaluation from White's point of view, in centi-units (±1_000_000 = forced win).
    pub score_white: i32,
    /// Estimated probability that White wins.
    pub white_win_prob: f64,
    pub depth: u32,
    pub nodes: u64,
    pub pv: Vec<Move>,
    pub engine: String,
}

pub struct Rng(pub u64);

impl Rng {
    pub fn new(seed: u64) -> Rng {
        Rng(seed.max(1))
    }
    pub fn next_u64(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    pub fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }
    pub fn below(&mut self, n: usize) -> usize {
        (self.next_u64() % n as u64) as usize
    }
}

pub fn score_to_prob(score: i32) -> f64 {
    if score >= WIN - 1000 {
        return 1.0;
    }
    if score <= -WIN + 1000 {
        return 0.0;
    }
    1.0 / (1.0 + (-(score as f64) / 250.0).exp())
}

fn to_white(g: &Game, score: i32) -> i32 {
    if g.to_move() == crate::pieces::Color::White {
        score
    } else {
        -score
    }
}

/// Picks among scored moves with a softmax at temperature `t`, always taking a
/// forced win.
fn soft_pick(scores: &[(Move, i32)], t: f64, rng: &mut Rng) -> (Move, i32) {
    let best = *scores.iter().max_by_key(|x| x.1).unwrap();
    if best.1 >= WIN - 1000 {
        return best;
    }
    let max = best.1 as f64;
    let w: Vec<f64> = scores.iter().map(|&(_, s)| ((s as f64 - max) / t).exp()).collect();
    let total: f64 = w.iter().sum();
    let mut r = rng.next_f64() * total;
    for (i, wi) in w.iter().enumerate() {
        r -= wi;
        if r <= 0.0 {
            return scores[i];
        }
    }
    best
}

pub struct Ai {
    pub searcher: Searcher,
    pub rng: Rng,
    pub network: Option<Network>,
}

impl Ai {
    pub fn new(seed: u64, tt_bits: u32) -> Ai {
        Ai { searcher: Searcher::new(tt_bits), rng: Rng::new(seed), network: None }
    }

    pub fn choose(&mut self, g: &mut Game, level: Level, time_ms: Option<f64>) -> AiMove {
        let rotation = self.rng.below(6);
        match level {
            Level::Easy => self.pick_soft(g, 1, 150.0, 0.2, rotation, "Easy"),
            Level::Medium => self.pick_soft(g, 2, 35.0, 0.0, rotation, "Medium"),
            Level::Hard => self.alpha_beta(g, 12, time_ms.unwrap_or(1500.0), rotation, "Hard"),
            Level::Expert => {
                if self.network.is_some() {
                    self.neural(g, time_ms.unwrap_or(3000.0), rotation)
                } else {
                    self.alpha_beta(g, 16, time_ms.unwrap_or(4000.0), rotation, "Expert")
                }
            }
        }
    }

    /// Hint / analysis: the strongest available search for the side to move.
    pub fn analyze(&mut self, g: &mut Game, time_ms: f64) -> AiMove {
        if self.network.is_some() {
            self.neural(g, time_ms, 0)
        } else {
            self.alpha_beta(g, 16, time_ms, 0, "Analysis")
        }
    }

    fn pick_soft(&mut self, g: &mut Game, depth: u32, temp: f64, random_chance: f64, rotation: usize, name: &str) -> AiMove {
        let r = self.searcher.search(g, Limits { max_depth: depth, time_ms: 2000.0 }, true, rotation);
        let (best, score) = if self.rng.next_f64() < random_chance && r.score < WIN - 1000 {
            r.root_scores[self.rng.below(r.root_scores.len())]
        } else {
            soft_pick(&r.root_scores, temp, &mut self.rng)
        };
        let sw = to_white(g, score);
        AiMove { best, score_white: sw, white_win_prob: score_to_prob(sw), depth: r.depth, nodes: r.nodes, pv: vec![best], engine: name.into() }
    }

    fn alpha_beta(&mut self, g: &mut Game, depth: u32, time_ms: f64, rotation: usize, name: &str) -> AiMove {
        let r = self.searcher.search(g, Limits { max_depth: depth, time_ms }, false, rotation);
        let sw = to_white(g, r.score);
        AiMove { best: r.best, score_white: sw, white_win_prob: score_to_prob(sw), depth: r.depth, nodes: r.nodes, pv: r.pv, engine: name.into() }
    }

    fn neural(&mut self, g: &mut Game, time_ms: f64, rotation: usize) -> AiMove {
        let net = self.network.as_ref().unwrap();
        let cfg = MctsConfig { time_ms, max_simulations: 100_000, ..MctsConfig::default() };
        let mut mcts = Mcts::new(cfg);
        let r = mcts.search(g, net, &mut self.rng, rotation);
        // Value in [-1, 1] for side to move -> probability for white.
        let p_me = (r.value as f64 + 1.0) / 2.0;
        let p_white = if g.to_move() == crate::pieces::Color::White { p_me } else { 1.0 - p_me };
        let score_white = (250.0 * (p_white.clamp(0.001, 0.999) / (1.0 - p_white.clamp(0.001, 0.999))).ln()) as i32;
        AiMove { best: r.best, score_white, white_win_prob: p_white, depth: 0, nodes: r.simulations as u64, pv: r.pv, engine: "Expert (neural)".into() }
    }
}
