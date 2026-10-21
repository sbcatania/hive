"""Runs the full self-play / train / evaluate loop.

python -m hive_train.loop --generations 10 --games 400 [--start 1]

Generation 0 is bootstrapped from alpha-beta self-play. Each later generation
plays games with the previous network (MCTS), trains on a sliding window of
recent generations, and is compared against the previous network. Networks
that don't lose the match are promoted to runs/best/hive-net.bin; use
`--install` to copy the best network into web/public/models.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TRAINING = os.path.join(ROOT, "training")
BIN = os.path.join(ROOT, "target", "release")


def run(cmd, **kw):
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def build_engine():
    run(["cargo", "build", "--release", "--features", "native", "--bin", "selfplay", "--bin", "arena", "--bin", "nncheck"], cwd=ROOT)


def match(net_a, net_b, games, ms):
    out = subprocess.run(
        [os.path.join(BIN, "arena"), "expert", "expertb", str(games), str(ms), "--net", net_a, "--net-b", net_b],
        capture_output=True, text=True, check=True, cwd=ROOT,
    ).stdout
    print(out.strip())
    m = re.search(r"\+(\d+) -(\d+) =(\d+)", out)
    w, l, d = map(int, m.groups())
    return (w + d / 2) / max(w + l + d, 1)


def install(best):
    models = os.path.join(ROOT, "web", "public", "models")
    os.makedirs(models, exist_ok=True)
    shutil.copy(best, os.path.join(models, "hive-net.bin"))
    with open(os.path.join(models, "manifest.json"), "w") as f:
        json.dump({"file": "hive-net.bin", "name": "trained"}, f)
    print("installed", best, "->", models)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--generations", type=int, default=10)
    ap.add_argument("--start", type=int, default=0, help="first generation to run (resume)")
    ap.add_argument("--games", type=int, default=400, help="self-play games per generation")
    ap.add_argument("--sims", type=int, default=200, help="MCTS simulations per move")
    ap.add_argument("--window", type=int, default=4, help="generations of data to train on")
    ap.add_argument("--epochs", type=float, default=4)
    ap.add_argument("--match-games", type=int, default=40)
    ap.add_argument("--match-ms", type=int, default=400)
    ap.add_argument("--channels", type=int, default=32)
    ap.add_argument("--blocks", type=int, default=4)
    ap.add_argument("--threads", type=int, default=0)
    ap.add_argument("--install", action="store_true", help="only copy runs/best into the website")
    args = ap.parse_args()

    runs = os.path.join(TRAINING, "runs")
    data = os.path.join(TRAINING, "data")
    best = os.path.join(runs, "best", "hive-net.bin")
    if args.install:
        install(best)
        return

    build_engine()
    threads = ["--threads", str(args.threads)] if args.threads else []
    for gen in range(args.start, args.start + args.generations):
        gdir = os.path.join(data, f"gen{gen}")
        if not os.path.isdir(gdir) or not os.listdir(gdir):
            cmd = [os.path.join(BIN, "selfplay"), "--games", str(args.games), "--out", gdir, "--seed", str(gen + 1)] + threads
            if gen > 0 and os.path.exists(best):
                cmd += ["--net", best, "--sims", str(args.sims)]
            run(cmd, cwd=ROOT)
        window = [os.path.join(data, f"gen{g}") for g in range(max(0, gen - args.window + 1), gen + 1)]
        out = os.path.join(runs, f"gen{gen}")
        cmd = [sys.executable, "-m", "hive_train.train", "--data", *window, "--out", out, "--epochs", str(args.epochs),
               "--channels", str(args.channels), "--blocks", str(args.blocks), "--name", f"gen{gen}"]
        prev = os.path.join(runs, f"gen{gen - 1}", "model.pt")
        if os.path.exists(prev):
            cmd += ["--init", prev]
        run(cmd, cwd=TRAINING)
        candidate = os.path.join(out, "hive-net.bin")
        if not os.path.exists(best):
            promote = True
        else:
            score = match(candidate, best, args.match_games, args.match_ms)
            promote = score >= 0.5
            print(f"gen{gen} scored {score:.2f} against the current best")
        if promote:
            os.makedirs(os.path.dirname(best), exist_ok=True)
            shutil.copy(candidate, best)
            print(f"gen{gen} promoted to best")
    print("done; run `python -m hive_train.loop --install` to put the best network on the website")


if __name__ == "__main__":
    main()
