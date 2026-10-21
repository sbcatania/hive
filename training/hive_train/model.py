"""PyTorch mirror of the Rust network in engine/src/nn.rs.

Hex convolutions are 3x3 convolutions on the axial grid (rows = r, columns = q)
with the two corners that aren't hex neighbours masked out.

Export order (all little-endian f32), after the `HIVENN01` header:
    conv_in: w[TAPS][C][IN], b[C]
    per block: conv1 w, b; conv2 w, b
    policy_dst w[P][C], b[P]; policy_src w[P][C], b[P]
    hand_emb[8][P]; bug_emb[8][P]
    value1 w[H][2C], b[H]; value2 w[H], b[1]
Tap order: self, then the engine's directions E, SE, SW, W, NW, NE.
"""

from __future__ import annotations

import json
import math
import struct

import torch
import torch.nn as nn
import torch.nn.functional as F

from .data import GRID, IN_CHANNELS

# (dq, dr) for taps after "self", matching hex::DIRS in the engine.
DIRS = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]
TAPS = [(0, 0)] + DIRS


class HexConv(nn.Module):
    def __init__(self, cin: int, cout: int):
        super().__init__()
        self.conv = nn.Conv2d(cin, cout, 3, padding=1)
        mask = torch.zeros(1, 1, 3, 3)
        for dq, dr in TAPS:
            mask[0, 0, dr + 1, dq + 1] = 1.0
        self.register_buffer("mask", mask)
        nn.init.kaiming_normal_(self.conv.weight, nonlinearity="relu")
        with torch.no_grad():
            self.conv.weight *= math.sqrt(9 / 7)
            self.conv.bias.zero_()

    def forward(self, x):
        return F.conv2d(x, self.conv.weight * self.mask, self.conv.bias, padding=1)

    def export(self) -> list[torch.Tensor]:
        w = self.conv.weight.detach()
        taps = torch.stack([w[:, :, dr + 1, dq + 1] for dq, dr in TAPS])  # [TAPS, cout, cin]
        return [taps, self.conv.bias.detach()]


class HiveNet(nn.Module):
    def __init__(self, channels=32, blocks=4, policy_dim=32, value_hidden=64):
        super().__init__()
        self.config = dict(channels=channels, blocks=blocks, policy_dim=policy_dim, value_hidden=value_hidden)
        self.conv_in = HexConv(IN_CHANNELS, channels)
        self.blocks = nn.ModuleList([nn.ModuleList([HexConv(channels, channels), HexConv(channels, channels)]) for _ in range(blocks)])
        for _, second in self.blocks:
            with torch.no_grad():
                second.conv.weight *= 0.3  # start residual blocks near identity
        self.pd = nn.Linear(channels, policy_dim)
        self.ps = nn.Linear(channels, policy_dim)
        self.hand_emb = nn.Parameter(torch.randn(8, policy_dim) * 0.3)
        self.bug_emb = nn.Parameter(torch.randn(8, policy_dim) * 0.3)
        self.v1 = nn.Linear(2 * channels, value_hidden)
        self.v2 = nn.Linear(value_hidden, 1)

    def trunk(self, x):
        h = F.relu(self.conv_in(x))
        for a, b in self.blocks:
            h = F.relu(b(F.relu(a(h))) + h)
        return h

    def forward(self, x, kind, bug, src, dst, mask):
        h = self.trunk(x)
        bsz, c = h.shape[:2]
        pooled = torch.cat([h.mean(dim=(2, 3)), h.amax(dim=(2, 3))], dim=1)
        value = torch.tanh(self.v2(F.relu(self.v1(pooled)))).squeeze(1)

        hf = h.flatten(2).transpose(1, 2)  # [B, cells, C]
        gather = lambda idx: torch.gather(hf, 1, idx.unsqueeze(-1).expand(-1, -1, c))
        d = self.pd(gather(dst))
        s_cell = self.ps(gather(src)) + self.bug_emb[bug]
        s_hand = self.hand_emb[bug]
        s = torch.where((kind == 0).unsqueeze(-1), s_hand, s_cell)
        logits = (d * s).sum(-1) / math.sqrt(d.shape[-1])
        logits = torch.where(kind == 2, torch.zeros_like(logits), logits)
        logits = logits.masked_fill(~mask, float("-inf"))
        return value, logits

    def export_bytes(self, name: str = "") -> bytes:
        header = dict(self.config, in_channels=IN_CHANNELS, grid=GRID, name=name)
        tensors = self.conv_in.export()
        for a, b in self.blocks:
            tensors += a.export() + b.export()
        tensors += [self.pd.weight, self.pd.bias, self.ps.weight, self.ps.bias, self.hand_emb, self.bug_emb]
        tensors += [self.v1.weight, self.v1.bias, self.v2.weight.reshape(-1), self.v2.bias]
        hjson = json.dumps(header).encode()
        out = bytearray(b"HIVENN01")
        out += struct.pack("<I", len(hjson))
        out += hjson
        for t in tensors:
            out += t.detach().float().contiguous().cpu().numpy().astype("<f4").tobytes()
        return bytes(out)


def loss_fn(value, logits, target, z):
    logp = F.log_softmax(logits, dim=1)
    logp = torch.where(torch.isfinite(logp), logp, torch.zeros_like(logp))
    policy_loss = -(target * logp).sum(1).mean()
    value_loss = F.mse_loss(value, z)
    return policy_loss, value_loss
