//! Evaluates a network on the first N records of a self-play file and prints
//! JSON lines, so training/hive_train/check.py can verify the Rust and PyTorch
//! implementations agree.
//!
//! cargo run --release --features native --bin nncheck -- <net.bin> <records.bin> [N]

use hive_engine::features::{Encoded, Source, NUM_GLOBALS};
use hive_engine::nn::Network;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let net = Network::from_bytes(&std::fs::read(&a[1]).unwrap()).unwrap();
    let buf = std::fs::read(&a[2]).unwrap();
    let n: usize = a.get(3).map(|s| s.parse().unwrap()).unwrap_or(20);
    let mut pos = 0;
    let u16_at = |p: usize| u16::from_le_bytes([buf[p], buf[p + 1]]);
    let f32_at = |p: usize| f32::from_le_bytes([buf[p], buf[p + 1], buf[p + 2], buf[p + 3]]);
    for _ in 0..n {
        if pos >= buf.len() {
            break;
        }
        let ns = u16_at(pos) as usize;
        pos += 2;
        let mut sparse = Vec::with_capacity(ns);
        for _ in 0..ns {
            sparse.push((buf[pos], u16_at(pos + 1), buf[pos + 3]));
            pos += 4;
        }
        let mut globals = [0f32; NUM_GLOBALS];
        for g in globals.iter_mut() {
            *g = f32_at(pos);
            pos += 4;
        }
        let nm = u16_at(pos) as usize;
        pos += 2;
        let mut moves = Vec::with_capacity(nm);
        for _ in 0..nm {
            let (kind, bug, src, dst) = (buf[pos], buf[pos + 1], u16_at(pos + 2), u16_at(pos + 4));
            let s = match kind {
                0 => Source::Hand(bug),
                1 => Source::Cell(src, bug),
                _ => Source::Pass,
            };
            moves.push((s, dst));
            pos += 10;
        }
        pos += 4; // value target
        let out = net.forward(&Encoded { sparse, globals, moves });
        println!("{}", serde_json::json!({ "value": out.value, "logits": out.logits }));
    }
}
