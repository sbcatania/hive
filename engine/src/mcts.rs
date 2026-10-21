//! AlphaZero-style Monte Carlo tree search guided by the policy/value network.

use crate::ai::Rng;
use crate::features::encode;
use crate::game::{Game, GameState, Move};
use crate::hex::*;
use crate::nn::Network;
use crate::pieces::Color;
use crate::time::now_ms;

#[derive(Clone, Debug)]
pub struct MctsConfig {
    pub c_puct: f32,
    pub time_ms: f64,
    pub max_simulations: u32,
    /// Root exploration noise (self-play only).
    pub dirichlet_alpha: f32,
    pub dirichlet_frac: f32,
    /// Unvisited children start at parent value minus this.
    pub fpu_reduction: f32,
    /// Positions this deep are scored as draws.
    pub max_ply: u32,
}

impl Default for MctsConfig {
    fn default() -> Self {
        MctsConfig {
            c_puct: 1.8,
            time_ms: f64::INFINITY,
            max_simulations: 400,
            dirichlet_alpha: 0.3,
            dirichlet_frac: 0.0,
            fpu_reduction: 0.25,
            max_ply: 400,
        }
    }
}

struct Node {
    moves: Vec<Move>,
    priors: Vec<f32>,
    children: Vec<u32>,
    n: Vec<u32>,
    w: Vec<f32>,
    /// Network (or terminal) value for the side to move at this node.
    value: f32,
    terminal: bool,
}

pub struct MctsResult {
    pub best: Move,
    /// Mean value of the root for the side to move, in [-1, 1].
    pub value: f32,
    pub simulations: u32,
    pub visits: Vec<(Move, u32)>,
    pub pv: Vec<Move>,
}

pub struct Mcts {
    pub config: MctsConfig,
    nodes: Vec<Node>,
}

/// Value of a finished position. Repetitions and the ply cap are scored as
/// draws inside the tree, but never at the root (the game isn't over there).
fn terminal_value(g: &Game, max_ply: u32, root: bool) -> Option<f32> {
    match g.state {
        GameState::Draw => Some(0.0),
        GameState::WhiteWins | GameState::BlackWins => {
            let winner = if g.state == GameState::WhiteWins { Color::White } else { Color::Black };
            Some(if winner == g.to_move() { 1.0 } else { -1.0 })
        }
        _ if !root && (g.ply >= max_ply || g.repetitions() >= 3) => Some(0.0),
        _ => None,
    }
}

fn sample_gamma(alpha: f32, rng: &mut Rng) -> f32 {
    // Marsaglia–Tsang, with the alpha < 1 boost.
    let boost = if alpha < 1.0 { rng.next_f64().max(1e-12).powf(1.0 / alpha as f64) } else { 1.0 };
    let a = if alpha < 1.0 { alpha + 1.0 } else { alpha } as f64;
    let d = a - 1.0 / 3.0;
    let c = 1.0 / (9.0 * d).sqrt();
    loop {
        let u1 = rng.next_f64().max(1e-12);
        let u2 = rng.next_f64();
        let x = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
        let v = (1.0 + c * x).powi(3);
        if v <= 0.0 {
            continue;
        }
        let u = rng.next_f64().max(1e-12);
        if u.ln() < 0.5 * x * x + d - d * v + d * v.ln() {
            return (d * v * boost) as f32;
        }
    }
}

impl Mcts {
    pub fn new(config: MctsConfig) -> Mcts {
        Mcts { config, nodes: Vec::new() }
    }

    fn expand(&mut self, g: &mut Game, net: &Network, root_rotation: Option<usize>) -> u32 {
        let idx = self.nodes.len() as u32;
        if let Some(v) = terminal_value(g, self.config.max_ply, root_rotation.is_some()) {
            self.nodes.push(Node { moves: vec![], priors: vec![], children: vec![], n: vec![], w: vec![], value: v, terminal: true });
            return idx;
        }
        let mut moves = g.legal_moves();
        if let (Some(rot), 1) = (root_rotation, g.ply) {
            let c = neighbor(ORIGIN, rot % 6);
            moves.retain(|m| m.to == c);
        }
        let enc = encode(g, &moves);
        let out = net.forward(&enc);
        let max = out.logits.iter().cloned().fold(f32::MIN, f32::max);
        let mut priors: Vec<f32> = out.logits.iter().map(|&l| (l - max).exp()).collect();
        let sum: f32 = priors.iter().sum();
        priors.iter_mut().for_each(|p| *p /= sum);
        let k = moves.len();
        self.nodes.push(Node { moves, priors, children: vec![0; k], n: vec![0; k], w: vec![0.0; k], value: out.value, terminal: false });
        idx
    }

    fn select(&self, node: &Node) -> usize {
        let total: u32 = node.n.iter().sum();
        let sqrt_total = (total.max(1) as f32).sqrt();
        let fpu = node.value - self.config.fpu_reduction;
        let mut best = 0;
        let mut best_score = f32::MIN;
        for i in 0..node.moves.len() {
            let q = if node.n[i] == 0 { fpu } else { node.w[i] / node.n[i] as f32 };
            let u = self.config.c_puct * node.priors[i] * sqrt_total / (1.0 + node.n[i] as f32);
            if q + u > best_score {
                best_score = q + u;
                best = i;
            }
        }
        best
    }

    pub fn search(&mut self, g: &mut Game, net: &Network, rng: &mut Rng, rotation: usize) -> MctsResult {
        self.nodes.clear();
        let deadline = now_ms() + self.config.time_ms;
        let root = self.expand(g, net, Some(rotation));
        if self.config.dirichlet_frac > 0.0 && !self.nodes[0].terminal {
            let k = self.nodes[0].moves.len();
            let noise: Vec<f32> = (0..k).map(|_| sample_gamma(self.config.dirichlet_alpha, rng)).collect();
            let sum: f32 = noise.iter().sum::<f32>().max(1e-9);
            let f = self.config.dirichlet_frac;
            for (p, n) in self.nodes[0].priors.iter_mut().zip(noise) {
                *p = (1.0 - f) * *p + f * n / sum;
            }
        }

        let mut sims = 0;
        let mut path: Vec<(u32, usize)> = Vec::with_capacity(64);
        while sims < self.config.max_simulations && !self.nodes[root as usize].terminal {
            if sims > 0 && now_ms() > deadline {
                break;
            }
            path.clear();
            let mut node = root;
            let leaf_value;
            loop {
                let n = &self.nodes[node as usize];
                if n.terminal {
                    leaf_value = n.value;
                    break;
                }
                let e = self.select(n);
                let m = n.moves[e];
                let child = n.children[e];
                path.push((node, e));
                g.play_unchecked(m);
                if child != 0 {
                    node = child;
                    continue;
                }
                let c = self.expand(g, net, None);
                self.nodes[node as usize].children[e] = c;
                leaf_value = self.nodes[c as usize].value;
                break;
            }
            let mut v = leaf_value;
            for &(nid, e) in path.iter().rev() {
                g.undo();
                v = -v;
                let n = &mut self.nodes[nid as usize];
                n.n[e] += 1;
                n.w[e] += v;
            }
            sims += 1;
        }

        let r = &self.nodes[root as usize];
        if r.terminal || r.moves.is_empty() {
            return MctsResult { best: Move::PASS, value: r.value, simulations: 0, visits: vec![], pv: vec![] };
        }
        let best_i = (0..r.moves.len())
            .max_by(|&a, &b| {
                r.n[a].cmp(&r.n[b]).then_with(|| {
                    let qa = if r.n[a] > 0 { r.w[a] / r.n[a] as f32 } else { -2.0 };
                    let qb = if r.n[b] > 0 { r.w[b] / r.n[b] as f32 } else { -2.0 };
                    qa.partial_cmp(&qb).unwrap()
                }).then_with(|| r.priors[a].partial_cmp(&r.priors[b]).unwrap())
            })
            .unwrap();
        let total: u32 = r.n.iter().sum();
        let value = if total > 0 { r.w.iter().sum::<f32>() / total as f32 } else { r.value };
        let visits = r.moves.iter().zip(&r.n).map(|(&m, &n)| (m, n)).collect();

        let mut pv = vec![r.moves[best_i]];
        let mut node = r.children[best_i];
        while node != 0 && pv.len() < 8 {
            let n = &self.nodes[node as usize];
            if n.terminal || n.moves.is_empty() {
                break;
            }
            let i = (0..n.moves.len()).max_by_key(|&i| n.n[i]).unwrap();
            if n.n[i] == 0 {
                break;
            }
            pv.push(n.moves[i]);
            node = n.children[i];
        }
        MctsResult { best: r.moves[best_i], value, simulations: sims, visits, pv }
    }
}
