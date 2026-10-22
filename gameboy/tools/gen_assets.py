#!/usr/bin/env python3
"""Generates src/assets.c and src/assets.h: hex tiles, bug glyphs, a 5x7 font,
big title letters and the cursor sprite, as Game Boy 2bpp tile data.

Colour indices in BG tiles: 0 board, 1 tile fill / grid line, 2 tile edge,
3 ink (bug glyph or text). Palettes in main.c give these their colours."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Rounded hexagon, pointy top, 16x16: (first, last) filled column per row.
HEX_ROWS = [(4, 11), (2, 13), (1, 14)] + [(0, 15)] * 10 + [(1, 14), (2, 13), (4, 11)]

GLYPHS = {
    "queen": """
..##....##..
.#..#..#..#.
.#...##...#.
..#.####.#..
...######...
....####....
...######...
....####....
...######...
.....##.....
""",
    "spider": """
#....##....#
.#...##...#.
..#.####.#..
#..######..#
.##.####.##.
...######...
.##.####.##.
#..######..#
..#..##..#..
.#........#.
""",
    "beetle": """
.#.......#.
..#.###.#..
...#####...
..###.###..
.####.####.
.####.####.
.####.####.
..###.###..
...##.##...
""",
    "hopper": """
..........#.
.........#..
....######..
..#########.
.###########
..#######...
....#..#.#..
...#..#...#.
..#..#.....#
""",
    "ant": """
....###....
.#..###..#.
..#..#..#..
...#####...
....###....
.#..###..#.
..#######..
.#.#####.#.
#..#####..#
....###....
""",
}
BUGS = ["queen", "spider", "beetle", "hopper", "ant"]

FONT = {
    " ": "00000,00000,00000,00000,00000,00000,00000",
    "A": "01110,10001,10001,11111,10001,10001,10001",
    "B": "11110,10001,10001,11110,10001,10001,11110",
    "C": "01110,10001,10000,10000,10000,10001,01110",
    "D": "11110,10001,10001,10001,10001,10001,11110",
    "E": "11111,10000,10000,11110,10000,10000,11111",
    "F": "11111,10000,10000,11110,10000,10000,10000",
    "G": "01110,10001,10000,10111,10001,10001,01111",
    "H": "10001,10001,10001,11111,10001,10001,10001",
    "I": "01110,00100,00100,00100,00100,00100,01110",
    "J": "00111,00010,00010,00010,00010,10010,01100",
    "K": "10001,10010,10100,11000,10100,10010,10001",
    "L": "10000,10000,10000,10000,10000,10000,11111",
    "M": "10001,11011,10101,10101,10001,10001,10001",
    "N": "10001,10001,11001,10101,10011,10001,10001",
    "O": "01110,10001,10001,10001,10001,10001,01110",
    "P": "11110,10001,10001,11110,10000,10000,10000",
    "Q": "01110,10001,10001,10001,10101,10010,01101",
    "R": "11110,10001,10001,11110,10100,10010,10001",
    "S": "01111,10000,10000,01110,00001,00001,11110",
    "T": "11111,00100,00100,00100,00100,00100,00100",
    "U": "10001,10001,10001,10001,10001,10001,01110",
    "V": "10001,10001,10001,10001,10001,01010,00100",
    "W": "10001,10001,10001,10101,10101,10101,01010",
    "X": "10001,10001,01010,00100,01010,10001,10001",
    "Y": "10001,10001,10001,01010,00100,00100,00100",
    "Z": "11111,00001,00010,00100,01000,10000,11111",
    "0": "01110,10001,10011,10101,11001,10001,01110",
    "1": "00100,01100,00100,00100,00100,00100,01110",
    "2": "01110,10001,00001,00010,00100,01000,11111",
    "3": "11111,00010,00100,00010,00001,10001,01110",
    "4": "00010,00110,01010,10010,11111,00010,00010",
    "5": "11111,10000,11110,00001,00001,10001,01110",
    "6": "00110,01000,10000,11110,10001,10001,01110",
    "7": "11111,00001,00010,00100,01000,01000,01000",
    "8": "01110,10001,10001,01110,10001,10001,01110",
    "9": "01110,10001,10001,01111,00001,00010,01100",
    "!": "00100,00100,00100,00100,00100,00000,00100",
    "?": "01110,10001,00001,00010,00100,00000,00100",
    ".": "00000,00000,00000,00000,00000,01100,01100",
    ",": "00000,00000,00000,00000,01100,00100,01000",
    ":": "00000,01100,01100,00000,01100,01100,00000",
    "-": "00000,00000,00000,11111,00000,00000,00000",
    ">": "01000,00100,00010,00001,00010,00100,01000",
    "<": "00010,00100,01000,10000,01000,00100,00010",
    "/": "00000,00001,00010,00100,01000,10000,00000",
    "'": "00100,00100,01000,00000,00000,00000,00000",
}


def blank(w, h):
    return [[0] * w for _ in range(h)]


def hex_mask():
    m = blank(16, 16)
    for y, (a, b) in enumerate(HEX_ROWS):
        for x in range(a, b + 1):
            m[y][x] = 1
    return m


def boundary(m):
    """Cells of mask m that touch the outside (4-neighbourhood)."""
    h, w = len(m), len(m[0])
    out = blank(w, h)
    for y in range(h):
        for x in range(w):
            if not m[y][x]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < w and 0 <= ny < h) or not m[ny][nx]:
                    out[y][x] = 1
    return out


def piece_image(bug, stacked):
    m = hex_mask()
    edge = boundary(m)
    img = blank(16, 16)
    for y in range(16):
        for x in range(16):
            if m[y][x]:
                img[y][x] = 2 if edge[y][x] else 1
    rows = [r for r in GLYPHS[bug].strip("\n").split("\n")]
    gh, gw = len(rows), len(rows[0])
    ox, oy = (16 - gw + 1) // 2, (16 - gh + 1) // 2
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "#":
                img[oy + y][ox + x] = 3
    if stacked:
        # Thicker lower rim, like a tile sitting on another one.
        for y in (13, 14):
            a, b = HEX_ROWS[y]
            for x in range(a, b + 1):
                img[y][x] = 2
    return img


def empty_hex_image():
    # Only a centre dot: every cell gets an anchor and the empty board stays quiet.
    img = blank(16, 16)
    for y in (7, 8):
        for x in (7, 8):
            img[y][x] = 1
    return img


def target_hex_image():
    edge = boundary(hex_mask())
    img = blank(16, 16)
    for y in range(16):
        for x in range(16):
            if edge[y][x]:
                img[y][x] = 1
    for y in range(6, 10):
        for x in range(6, 10):
            img[y][x] = 2
    return img


def cursor_image():
    m = hex_mask()
    outer = boundary(m)
    inner_mask = [[m[y][x] and not outer[y][x] for x in range(16)] for y in range(16)]
    inner = boundary(inner_mask)
    img = blank(16, 16)
    for y in range(16):
        for x in range(16):
            if outer[y][x]:
                img[y][x] = 1
            elif inner[y][x]:
                img[y][x] = 2
    return img


def char_image(ch, scale=1):
    rows = FONT[ch].split(",")
    size = 8 * scale
    img = blank(size, size)
    for y, row in enumerate(rows):
        for x, bit in enumerate(row):
            if bit == "1":
                for sy in range(scale):
                    for sx in range(scale):
                        img[y * scale + sy + (1 if scale > 1 else 0)][x * scale + sx + (1 if scale == 1 else 3)] = 3
    return img


def tiles_of(img):
    """Split an image (multiple of 8 in both axes) into 8x8 tiles, row-major."""
    h, w = len(img), len(img[0])
    out = []
    for ty in range(0, h, 8):
        for tx in range(0, w, 8):
            out.append([row[tx:tx + 8] for row in img[ty:ty + 8]])
    return out


def tiles_columns(img):
    """8x16 sprite order: left column top/bottom, then right column."""
    out = []
    for tx in range(0, len(img[0]), 8):
        for ty in range(0, len(img), 8):
            out.append([row[tx:tx + 8] for row in img[ty:ty + 8]])
    return out


def encode(tile):
    data = []
    for row in tile:
        lo = hi = 0
        for x, c in enumerate(row):
            if c & 1:
                lo |= 0x80 >> x
            if c & 2:
                hi |= 0x80 >> x
        data += [lo, hi]
    return data


def main():
    bg = [blank(8, 8)]  # 0: blank
    defs = {"T_BLANK": 0}
    defs["T_HEX"] = len(bg)
    bg += tiles_of(empty_hex_image())
    defs["T_TARGET"] = len(bg)
    bg += tiles_of(target_hex_image())
    defs["T_PIECE"] = len(bg)
    for bug in BUGS:
        for stacked in (False, True):
            bg += tiles_of(piece_image(bug, stacked))
    defs["T_FONT"] = len(bg)
    chars = list(FONT.keys())
    for ch in chars:
        bg += tiles_of(char_image(ch))
    defs["T_BIG"] = len(bg)
    for ch in "HIVE":
        bg += tiles_of(char_image(ch, 2))
    assert len(bg) <= 128, len(bg)
    defs["N_BG_TILES"] = len(bg)
    spr = tiles_columns(cursor_image())
    defs["T_CURSOR"] = 248

    ascii_map = [0] * 96
    for i, ch in enumerate(chars):
        ascii_map[ord(ch) - 32] = i

    def carray(name, values):
        lines = []
        for i in range(0, len(values), 16):
            lines.append("    " + ", ".join(f"0x{v:02X}" for v in values[i:i + 16]) + ",")
        return f"const uint8_t {name}[{len(values)}] = {{\n" + "\n".join(lines) + "\n};\n"

    bg_bytes = [b for t in bg for b in encode(t)]
    spr_bytes = [b for t in spr for b in encode(t)]
    with open(os.path.join(ROOT, "src", "assets.c"), "w") as f:
        f.write("// Generated by tools/gen_assets.py. Do not edit.\n#include \"assets.h\"\n\n")
        f.write(carray("bg_tiles", bg_bytes) + "\n")
        f.write(carray("cursor_tiles", spr_bytes) + "\n")
        f.write(carray("ascii_map", ascii_map))
    with open(os.path.join(ROOT, "src", "assets.h"), "w") as f:
        f.write("// Generated by tools/gen_assets.py. Do not edit.\n#ifndef HIVE_ASSETS_H\n#define HIVE_ASSETS_H\n#include <stdint.h>\n\n")
        for k, v in defs.items():
            f.write(f"#define {k} {v}\n")
        f.write("\nextern const uint8_t bg_tiles[];\nextern const uint8_t cursor_tiles[];\nextern const uint8_t ascii_map[];\n\n#endif\n")
    print(f"{len(bg)} BG tiles, {len(spr)} sprite tiles")


if __name__ == "__main__":
    main()
