#!/usr/bin/env python3
"""Vocabulary integrity across every TSV source.

Reports, without building anything:

  * a term claimed by more than one file (vocabulary terms are global keys)
  * a reading that is not kana
  * an empty gloss or an unknown part of speech
  * a per-chapter tap file with no matching vocabulary file

Usage:
    python tools/check_vocab.py
"""
from __future__ import annotations

import collections
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB = os.path.join(ROOT, "content", "vocab")

POS = {
    "n.", "い-adj.", "な-adj.", "v.i.", "v.t.", "v.suru", "adv.", "conj.", "exp.",
    "part", "form", "name", "num",
    # tap-*.tsv files are written without the trailing dot for these three;
    # tools/_common.py canonicalises them on read, so accept both here.
    "adv", "conj", "exp",
}
KANA_ONLY = re.compile(r"^[\u3041-\u3096\u30A1-\u30FA\u30FC\u309D\u309E\u30FD\u30FE]+$")


def rows(path: str):
    with io.open(path, encoding="utf-8-sig") as fh:
        for lineno, line in enumerate(fh, 1):
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            cells = [c.strip() for c in line.rstrip("\r\n").split("\t")]
            yield lineno, cells


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    errors: list[str] = []
    warnings: list[str] = []
    where: dict[str, list[str]] = collections.defaultdict(list)
    per_file: dict[str, int] = {}

    for name in sorted(os.listdir(VOCAB)):
        if not name.endswith(".tsv"):
            continue
        path = os.path.join(VOCAB, name)
        count = 0
        for lineno, cells in rows(path):
            at = f"{name}:{lineno}"
            if len(cells) < 4:
                errors.append(f"{at}: expected 4+ columns, got {len(cells)}")
                continue
            term, reading, gloss, pos = cells[0], cells[1], cells[2], cells[3]
            count += 1
            where[term].append(at)
            if not term:
                errors.append(f"{at}: empty term")
            if not KANA_ONLY.match(reading):
                errors.append(f"{at}: {term} reading is not kana only: {reading!r}")
            if not gloss:
                errors.append(f"{at}: {term} has an empty gloss")
            if pos not in POS:
                errors.append(f"{at}: {term} has unknown pos {pos!r}")
        per_file[name] = count

    for term, places in sorted(where.items()):
        if len(places) > 1:
            errors.append(f"{term} claimed by {', '.join(places)}")

    for name in per_file:
        m = re.match(r"^tap-(\d+)\.tsv$", name)
        if m and f"recap-{m.group(1)}.tsv" not in per_file:
            warnings.append(f"{name} exists with no recap-{m.group(1)}.tsv")

    total = sum(per_file.values())
    for e in errors:
        print(f"  x {e}")
    for w in warnings:
        print(f"  ! {w}")
    if errors:
        print(f"\ncheck_vocab: {len(errors)} error(s), {total} rows across {len(per_file)} files")
        return 1
    print(f"check_vocab: ok — {total} rows, {len(where)} unique terms, {len(per_file)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
