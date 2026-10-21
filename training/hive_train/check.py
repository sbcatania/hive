"""Checks that the Rust engine and PyTorch compute the same network outputs.

python -m hive_train.check <records.bin> [--engine ../target/release/nncheck]
Exports a randomly initialised network, evaluates it in both, and compares.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile

import numpy as np
import torch

from .data import Dataset
from .model import HiveNet


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("records")
    ap.add_argument("--engine", default=os.path.join(os.path.dirname(__file__), "..", "..", "target", "release", "nncheck"))
    ap.add_argument("-n", type=int, default=20)
    args = ap.parse_args()

    torch.manual_seed(1)
    net = HiveNet(channels=16, blocks=2, policy_dim=16, value_hidden=24).eval()
    with torch.no_grad():
        for p in net.parameters():
            p.add_(torch.randn_like(p) * 0.05)
    with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as f:
        f.write(net.export_bytes("check"))
        path = f.name
    out = subprocess.run([args.engine, path, args.records, str(args.n)], capture_output=True, text=True, check=True).stdout
    rust = [json.loads(line) for line in out.splitlines()]

    ds = Dataset([args.records])
    worst = 0.0
    for i, r in enumerate(rust):
        x, kind, bug, src, dst, _, mask, _ = (torch.from_numpy(a) for a in ds.batch(np.array([i])))
        with torch.no_grad():
            v, logits = net(x, kind, bug, src, dst, mask)
        lt = logits[0][mask[0]].numpy()
        worst = max(worst, abs(float(v[0]) - r["value"]), float(np.abs(lt - np.array(r["logits"])).max()))
    print(f"compared {len(rust)} positions; max abs difference {worst:.2e}")
    assert worst < 1e-3, "Rust and PyTorch disagree"
    print("OK")


if __name__ == "__main__":
    main()
