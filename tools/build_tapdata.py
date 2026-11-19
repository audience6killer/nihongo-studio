#!/usr/bin/env python3
"""Build assets/js/data/tap.js — the tap-to-define dictionary.

Usage:
    python tools/build_tapdata.py

Merges every vocabulary TSV plus content/vocab/tap-extra.tsv into one lookup
table. Segmentation happens at runtime (core/lang.js) and is verified against
exactly the same code path by tools/check_tap.mjs, so there is only one
implementation of the tokenizer and no chance of build/runtime drift.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _common import (  # noqa: E402
    VOCAB_DIR, Report, deck_lesson_files, read_tsv, utf8_stdout, write_js,
)

EXTRA = os.path.join(VOCAB_DIR, "tap-extra.tsv")


def main() -> int:
    utf8_stdout()
    report = Report("build_tapdata")

    rows: list[dict] = []
    for _deck, _chapter, path in deck_lesson_files():
        rows.extend(read_tsv(path, report))
    extra = read_tsv(EXTRA, report)
    rows.extend(extra)

    entries: dict[str, dict] = {}
    origin: dict[str, str] = {}
    for row in rows:
        term = row["w"]
        where = f"{row['file']}:{row['line']}"
        if term in entries:
            prev = entries[term]
            if prev["r"] != row["reading"] or prev["g"] != row["gloss"]:
                report.warn(
                    f"{where}: {term} already defined as "
                    f"({prev['r']} / {prev['g']}) at {origin[term]}; keeping the first"
                )
            continue
        if term != term.strip():
            report.error(f"{where}: term has leading/trailing whitespace")
            continue
        if " " in term or "\t" in term:
            report.error(f"{where}: term {term!r} contains whitespace")
            continue
        entries[term] = {"r": row["reading"], "g": row["gloss"], "p": row["pos"]}
        origin[term] = where

    if not entries:
        report.error("no tap entries produced")
    if not report.emit():
        return 1

    payload = {
        "meta": {
            "schema": 1,
            "l2": "ja",
            "count": len(entries),
        },
        "entries": dict(sorted(entries.items())),
    }
    write_js("assets/js/data/tap.js", "NJ_TAP", payload,
             "Nihongo Studio tap-to-define dictionary — window.NJ_TAP")
    longest = max(entries, key=len)
    print(f"  {len(entries)} entries; longest term {longest!r} ({len(longest)} chars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
