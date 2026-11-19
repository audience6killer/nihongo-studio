#!/usr/bin/env python3
"""Generate the app icons without any image library.

The mark is a vermilion rounded square carrying a white æ—¥ drawn from
rectangles, so it can be rasterised from a few integer primitives. Python
stdlib only (zlib + struct + a hand-rolled PNG writer), which keeps the
"no installable dependencies" promise intact.

Usage:
    python tools/make_icons.py
"""
from __future__ import annotations

import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img")

PAPER = (247, 243, 234)
INK = (31, 27, 22)
VERMILION = (176, 61, 42)
CREAM = (252, 249, 243)


def png_bytes(width: int, height: int, pixels: list[list[tuple[int, int, int, int]]]) -> bytes:
    """Encode RGBA rows as a PNG (8-bit truecolour with alpha)."""
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type: none
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def rounded_rect_cover(x: float, y: float, x0: float, y0: float, x1: float, y1: float, r: float) -> bool:
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1e-9


def render(size: int, *, bg: tuple[int, int, int, int] | None) -> list[list[tuple[int, int, int, int]]]:
    """Draw the mark at `size`. `bg=None` produces a transparent background."""
    s = float(size)
    tile = rounded_rect_cover  # local alias

    # Vermilion tile: inset so a rounded corner reads clearly at any size.
    tx0, ty0t, tx1, ty1t = 0.07 * s, 0.07 * s, 0.93 * s, 0.93 * s
    tr = 0.22 * s

    # æ—¥ built from four strokes: a rectangle (left, right, top, bottom) plus a
    # middle bar. Bounds are the outer edges of each stroke, half-open so the
    # edges stay crisp without anti-aliasing.
    gx0, gx1 = 0.330 * s, 0.670 * s
    gy0, gy1 = 0.265 * s, 0.735 * s
    st = 0.045 * s
    mid_y = (gy0 + gy1) / 2

    rows: list[list[tuple[int, int, int, int]]] = []
    for py in range(size):
        row: list[tuple[int, int, int, int]] = []
        for px in range(size):
            x, y = px + 0.5, py + 0.5
            colour: tuple[int, int, int, int] = bg if bg else (0, 0, 0, 0)

            if tile(x, y, tx0, ty0t, tx1, ty1t, tr):
                colour = (*VERMILION, 255)

                in_x = gx0 <= x <= gx1
                in_y = gy0 <= y <= gy1
                left = gx0 <= x < gx0 + st and in_y
                right = gx1 - st < x <= gx1 and in_y
                top = gy0 <= y < gy0 + st and in_x
                bottom = gy1 - st < y <= gy1 and in_x
                middle = abs(y - mid_y) <= st / 2 and in_x

                if left or right or top or bottom or middle:
                    colour = (*CREAM, 255)

            row.append(colour)
        rows.append(row)
    return rows


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img"
     aria-label="Nihongo Studio">
  <rect width="512" height="512" rx="112" fill="#f7f3ea"/>
  <rect x="36" y="36" width="440" height="440" rx="112" fill="#b03d2a"/>
  <g fill="#fcf9f3">
    <rect x="169" y="136" width="23" height="240"/>
    <rect x="320" y="136" width="23" height="240"/>
    <rect x="169" y="136" width="174" height="23"/>
    <rect x="169" y="245" width="174" height="23"/>
    <rect x="169" y="353" width="174" height="23"/>
  </g>
</svg>
"""


def main() -> int:
    os.makedirs(OUT, exist_ok=True)

    svg_path = os.path.join(OUT, "icon.svg")
    with open(svg_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(SVG)

    for size, opaque in ((180, True), (512, True)):
        pixels = render(size, bg=(*PAPER, 255) if opaque else None)
        path = os.path.join(OUT, f"icon-{size}.png")
        with open(path, "wb") as fh:
            fh.write(png_bytes(size, size, pixels))
        print(f"wrote {os.path.relpath(path, ROOT)}  ({size}x{size})")

    print(f"wrote {os.path.relpath(svg_path, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
