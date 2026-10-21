"""Trains the network on self-play data and exports it for the engine.

python -m hive_train.train --data data/gen0 data/gen1 --out runs/gen1 [--init runs/gen0/model.pt]
"""

from __future__ import annotations

import argparse
import os
import time

import numpy as np
import torch

from .data import Dataset, find_files
from .model import HiveNet, loss_fn


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", nargs="+", required=True, help="directories of self-play .bin files")
    ap.add_argument("--out", required=True)
    ap.add_argument("--init", help="checkpoint to continue from")
    ap.add_argument("--epochs", type=float, default=4)
    ap.add_argument("--batch", type=int, default=256)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--channels", type=int, default=32)
    ap.add_argument("--blocks", type=int, default=4)
    ap.add_argument("--value-weight", type=float, default=1.0)
    ap.add_argument("--name", default="")
    ap.add_argument("--threads", type=int, default=0)
    args = ap.parse_args()
    if args.threads:
        torch.set_num_threads(args.threads)

    device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
    files = find_files(args.data)
    t0 = time.time()
    ds = Dataset(files)
    print(f"{len(ds)} positions from {len(files)} files in {time.time() - t0:.1f}s; device {device}")

    if args.init:
        ck = torch.load(args.init, map_location="cpu")
        net = HiveNet(**ck["config"])
        net.load_state_dict(ck["state"])
    else:
        net = HiveNet(channels=args.channels, blocks=args.blocks)
    net.to(device)

    rng = np.random.default_rng(0)
    perm = rng.permutation(len(ds))
    n_val = min(2000, len(ds) // 20)
    val_idx, train_idx = perm[:n_val], perm[n_val:]
    steps = int(args.epochs * len(train_idx) / args.batch)
    opt = torch.optim.AdamW(net.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=max(steps, 1), pct_start=0.1)

    def to_dev(b):
        return [torch.from_numpy(a).to(device) for a in b]

    def evaluate():
        net.eval()
        tot = np.zeros(2)
        n = 0
        with torch.no_grad():
            for i in range(0, len(val_idx), 512):
                x, kind, bug, src, dst, target, mask, z = to_dev(ds.batch(val_idx[i : i + 512]))
                v, logits = net(x, kind, bug, src, dst, mask)
                pl, vl = loss_fn(v, logits, target, z)
                tot += np.array([pl.item(), vl.item()]) * len(z)
                n += len(z)
        net.train()
        return tot / max(n, 1)

    print(f"training {steps} steps; initial val policy/value loss {evaluate()}")
    t0 = time.time()
    for step in range(steps):
        idx = rng.choice(train_idx, args.batch, replace=False)
        x, kind, bug, src, dst, target, mask, z = to_dev(ds.batch(idx))
        v, logits = net(x, kind, bug, src, dst, mask)
        pl, vl = loss_fn(v, logits, target, z)
        loss = pl + args.value_weight * vl
        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(net.parameters(), 5.0)
        opt.step()
        sched.step()
        if step % 200 == 0 or step == steps - 1:
            print(f"step {step}/{steps}  policy {pl.item():.3f}  value {vl.item():.3f}  {time.time() - t0:.0f}s", flush=True)
    print(f"final val policy/value loss {evaluate()}")

    os.makedirs(args.out, exist_ok=True)
    net.cpu()
    torch.save({"config": net.config, "state": net.state_dict()}, os.path.join(args.out, "model.pt"))
    with open(os.path.join(args.out, "hive-net.bin"), "wb") as f:
        f.write(net.export_bytes(args.name or os.path.basename(os.path.normpath(args.out))))
    print("saved", args.out)


if __name__ == "__main__":
    main()
