//! Small residual hex-convolution network, evaluated in pure Rust so the same
//! code runs in the browser (WASM) and in native self-play.
//!
//! Weight file: `HIVENN01`, u32 LE header length, JSON header, then f32 LE
//! tensors in the order documented in `training/hive_train/model.py`.

use crate::features::{dense, Encoded, Source, GRID, GRID_CELLS, IN_CHANNELS};
use crate::hex::DIRS;
use serde::{Deserialize, Serialize};

pub const TAPS: usize = 7;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NetConfig {
    pub channels: usize,
    pub blocks: usize,
    pub policy_dim: usize,
    pub value_hidden: usize,
    #[serde(default)]
    pub in_channels: usize,
    #[serde(default)]
    pub grid: usize,
    #[serde(default)]
    pub name: String,
}

struct Conv {
    w: Vec<f32>, // [TAPS][cout][cin]
    b: Vec<f32>,
    cin: usize,
    cout: usize,
}

pub struct Network {
    pub config: NetConfig,
    conv_in: Conv,
    blocks: Vec<(Conv, Conv)>,
    pd_w: Vec<f32>, // [P][C]
    pd_b: Vec<f32>,
    ps_w: Vec<f32>,
    ps_b: Vec<f32>,
    hand_emb: Vec<f32>, // [8][P]
    bug_emb: Vec<f32>,  // [8][P]
    v1_w: Vec<f32>,     // [H][2C]
    v1_b: Vec<f32>,
    v2_w: Vec<f32>, // [H]
    v2_b: f32,
    nbr: Vec<[i32; TAPS]>,
}

pub struct NetOutput {
    pub value: f32,
    pub logits: Vec<f32>,
}

fn neighbor_table() -> Vec<[i32; TAPS]> {
    let mut t = vec![[-1i32; TAPS]; GRID_CELLS];
    for y in 0..GRID as i32 {
        for x in 0..GRID as i32 {
            let i = (y * GRID as i32 + x) as usize;
            t[i][0] = i as i32;
            for (d, &(dq, dr)) in DIRS.iter().enumerate() {
                let (nx, ny) = (x + dq, y + dr);
                if nx >= 0 && ny >= 0 && nx < GRID as i32 && ny < GRID as i32 {
                    t[i][d + 1] = ny * GRID as i32 + nx;
                }
            }
        }
    }
    t
}

struct Reader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<Vec<f32>, String> {
        let bytes = n * 4;
        if self.pos + bytes > self.data.len() {
            return Err("Weight file is truncated".into());
        }
        let v = self.data[self.pos..self.pos + bytes]
            .chunks_exact(4)
            .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect();
        self.pos += bytes;
        Ok(v)
    }
    fn conv(&mut self, cin: usize, cout: usize) -> Result<Conv, String> {
        Ok(Conv { w: self.take(TAPS * cout * cin)?, b: self.take(cout)?, cin, cout })
    }
}

#[inline]
fn dot(a: &[f32], b: &[f32]) -> f32 {
    // Four accumulators so the compiler can vectorise.
    let mut acc = [0f32; 4];
    let chunks = a.len() / 4;
    for i in 0..chunks {
        for k in 0..4 {
            acc[k] += a[i * 4 + k] * b[i * 4 + k];
        }
    }
    let mut s = acc[0] + acc[1] + acc[2] + acc[3];
    for i in chunks * 4..a.len() {
        s += a[i] * b[i];
    }
    s
}

impl Network {
    pub fn from_bytes(data: &[u8]) -> Result<Network, String> {
        if data.len() < 12 || &data[..8] != b"HIVENN01" {
            return Err("Not a Hive network file".into());
        }
        let hlen = u32::from_le_bytes([data[8], data[9], data[10], data[11]]) as usize;
        let header: NetConfig = serde_json::from_slice(&data[12..12 + hlen]).map_err(|e| e.to_string())?;
        if header.in_channels != 0 && header.in_channels != IN_CHANNELS {
            return Err(format!("Network expects {} input channels, engine has {}", header.in_channels, IN_CHANNELS));
        }
        if header.grid != 0 && header.grid != GRID {
            return Err(format!("Network expects grid {}, engine has {}", header.grid, GRID));
        }
        let mut r = Reader { data, pos: 12 + hlen };
        let c = header.channels;
        let p = header.policy_dim;
        let h = header.value_hidden;
        let conv_in = r.conv(IN_CHANNELS, c)?;
        let mut blocks = Vec::new();
        for _ in 0..header.blocks {
            let a = r.conv(c, c)?;
            let b = r.conv(c, c)?;
            blocks.push((a, b));
        }
        let net = Network {
            conv_in,
            blocks,
            pd_w: r.take(p * c)?,
            pd_b: r.take(p)?,
            ps_w: r.take(p * c)?,
            ps_b: r.take(p)?,
            hand_emb: r.take(8 * p)?,
            bug_emb: r.take(8 * p)?,
            v1_w: r.take(h * 2 * c)?,
            v1_b: r.take(h)?,
            v2_w: r.take(h)?,
            v2_b: r.take(1)?[0],
            nbr: neighbor_table(),
            config: header,
        };
        if r.pos != data.len() {
            return Err("Weight file has trailing data".into());
        }
        Ok(net)
    }

    fn conv(&self, conv: &Conv, x: &[f32], out: &mut Vec<f32>, relu: bool, residual: Option<&[f32]>) {
        let (cin, cout) = (conv.cin, conv.cout);
        out.clear();
        out.resize(GRID_CELLS * cout, 0.0);
        for cell in 0..GRID_CELLS {
            let o = &mut out[cell * cout..(cell + 1) * cout];
            o.copy_from_slice(&conv.b);
            for (tap, &nb) in self.nbr[cell].iter().enumerate() {
                if nb < 0 {
                    continue;
                }
                let xin = &x[nb as usize * cin..(nb as usize + 1) * cin];
                let w = &conv.w[tap * cout * cin..(tap + 1) * cout * cin];
                for co in 0..cout {
                    o[co] += dot(&w[co * cin..(co + 1) * cin], xin);
                }
            }
            if let Some(res) = residual {
                for co in 0..cout {
                    o[co] += res[cell * cout + co];
                }
            }
            if relu {
                for v in o.iter_mut() {
                    *v = v.max(0.0);
                }
            }
        }
    }

    pub fn forward(&self, e: &Encoded) -> NetOutput {
        let c = self.config.channels;
        let p = self.config.policy_dim;
        let mut x = Vec::new();
        dense(e, &mut x);
        let mut h = Vec::new();
        self.conv(&self.conv_in, &x, &mut h, true, None);
        let mut t = Vec::new();
        let mut h2 = Vec::new();
        for (a, b) in &self.blocks {
            self.conv(a, &h, &mut t, true, None);
            self.conv(b, &t, &mut h2, true, Some(&h));
            std::mem::swap(&mut h, &mut h2);
        }

        // Value head: mean + max pool -> hidden -> tanh.
        let mut pooled = vec![0f32; 2 * c];
        for ch in 0..c {
            let mut sum = 0.0;
            let mut mx = f32::MIN;
            for cell in 0..GRID_CELLS {
                let v = h[cell * c + ch];
                sum += v;
                mx = mx.max(v);
            }
            pooled[ch] = sum / GRID_CELLS as f32;
            pooled[c + ch] = mx;
        }
        let hid = self.config.value_hidden;
        let mut v = self.v2_b;
        for j in 0..hid {
            let a = (dot(&self.v1_w[j * 2 * c..(j + 1) * 2 * c], &pooled) + self.v1_b[j]).max(0.0);
            v += a * self.v2_w[j];
        }
        let value = v.tanh();

        // Policy head: bilinear score between source and destination embeddings.
        let embed = |w: &[f32], b: &[f32], cell: usize| -> Vec<f32> {
            let hc = &h[cell * c..(cell + 1) * c];
            (0..p).map(|k| dot(&w[k * c..(k + 1) * c], hc) + b[k]).collect()
        };
        let mut dst_cache: Vec<Option<Vec<f32>>> = vec![None; GRID_CELLS];
        let scale = 1.0 / (p as f32).sqrt();
        let mut logits = Vec::with_capacity(e.moves.len());
        for &(src, dst) in &e.moves {
            let s: Vec<f32> = match src {
                Source::Pass => {
                    logits.push(0.0);
                    continue;
                }
                Source::Hand(bug) => self.hand_emb[bug as usize * p..(bug as usize + 1) * p].to_vec(),
                Source::Cell(cell, bug) => {
                    let mut v = embed(&self.ps_w, &self.ps_b, cell as usize);
                    for k in 0..p {
                        v[k] += self.bug_emb[bug as usize * p + k];
                    }
                    v
                }
            };
            let d = dst_cache[dst as usize].get_or_insert_with(|| embed(&self.pd_w, &self.pd_b, dst as usize));
            logits.push(dot(&s, d) * scale);
        }
        NetOutput { value, logits }
    }
}
