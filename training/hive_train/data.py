"""Reads self-play records written by `engine/src/bin/selfplay.rs`.

Record layout (little endian):
    u16 n_sparse, then n_sparse x (u8 plane, u16 cell, u8 value)
    f32 globals[NUM_GLOBALS]
    u16 n_moves, then n_moves x (u8 kind, u8 bug, u16 src_cell, u16 dst_cell, f32 target)
        kind: 0 = place from hand, 1 = move from src_cell, 2 = pass
    f32 value target (from the side to move's point of view)

These constants must match engine/src/features.rs.
"""

from __future__ import annotations

import glob
import os
import struct

import numpy as np

GRID = 18
GRID_CELLS = GRID * GRID
SPARSE_PLANES = 22
ONES_PLANE = 22
NUM_GLOBALS = 20
IN_CHANNELS = SPARSE_PLANES + 1 + NUM_GLOBALS

_SPARSE = np.dtype([("plane", "u1"), ("cell", "<u2"), ("value", "u1")])
_MOVE = np.dtype([("kind", "u1"), ("bug", "u1"), ("src", "<u2"), ("dst", "<u2"), ("p", "<f4")])


class Dataset:
    """All positions from a set of files, stored as flat numpy arrays."""

    def __init__(self, files: list[str]):
        sparse, sp_off, glob_, moves, mv_off, values = [], [0], [], [], [0], []
        for path in files:
            with open(path, "rb") as f:
                buf = f.read()
            pos = 0
            n = len(buf)
            while pos < n:
                try:
                    (ns,) = struct.unpack_from("<H", buf, pos)
                    pos += 2
                    sp = np.frombuffer(buf, _SPARSE, ns, pos)
                    pos += ns * _SPARSE.itemsize
                    g = np.frombuffer(buf, "<f4", NUM_GLOBALS, pos)
                    pos += NUM_GLOBALS * 4
                    (nm,) = struct.unpack_from("<H", buf, pos)
                    pos += 2
                    mv = np.frombuffer(buf, _MOVE, nm, pos)
                    pos += nm * _MOVE.itemsize
                    (z,) = struct.unpack_from("<f", buf, pos)
                    pos += 4
                except (struct.error, ValueError):
                    break  # truncated tail of a file still being written
                sparse.append(sp)
                sp_off.append(sp_off[-1] + ns)
                glob_.append(g)
                moves.append(mv)
                mv_off.append(mv_off[-1] + nm)
                values.append(z)
        self.sparse = np.concatenate(sparse) if sparse else np.zeros(0, _SPARSE)
        self.sp_off = np.array(sp_off, dtype=np.int64)
        self.globals = np.stack(glob_).astype(np.float32) if glob_ else np.zeros((0, NUM_GLOBALS), np.float32)
        self.moves = np.concatenate(moves) if moves else np.zeros(0, _MOVE)
        self.mv_off = np.array(mv_off, dtype=np.int64)
        self.values = np.array(values, dtype=np.float32)

    def __len__(self) -> int:
        return len(self.values)

    def batch(self, idx: np.ndarray):
        """Dense inputs and padded move lists for the given positions."""
        b = len(idx)
        x = np.zeros((b, IN_CHANNELS, GRID, GRID), dtype=np.float32)
        x[:, ONES_PLANE] = 1.0
        x[:, SPARSE_PLANES + 1 :] = self.globals[idx][:, :, None, None]
        for i, k in enumerate(idx):
            sp = self.sparse[self.sp_off[k] : self.sp_off[k + 1]]
            np.add.at(x[i], (sp["plane"], sp["cell"] // GRID, sp["cell"] % GRID), sp["value"].astype(np.float32))
        counts = self.mv_off[idx + 1] - self.mv_off[idx]
        m = int(counts.max())
        kind = np.full((b, m), 2, dtype=np.int64)
        bug = np.zeros((b, m), dtype=np.int64)
        src = np.zeros((b, m), dtype=np.int64)
        dst = np.zeros((b, m), dtype=np.int64)
        target = np.zeros((b, m), dtype=np.float32)
        mask = np.zeros((b, m), dtype=bool)
        for i, k in enumerate(idx):
            mv = self.moves[self.mv_off[k] : self.mv_off[k + 1]]
            c = len(mv)
            kind[i, :c] = mv["kind"]
            bug[i, :c] = mv["bug"]
            src[i, :c] = mv["src"]
            dst[i, :c] = mv["dst"]
            target[i, :c] = mv["p"]
            mask[i, :c] = True
        return x, kind, bug, src, dst, target, mask, self.values[idx]


def find_files(dirs: list[str]) -> list[str]:
    files = []
    for d in dirs:
        files += sorted(glob.glob(os.path.join(d, "*.bin")))
    return files
