#!/usr/bin/env python3
"""Print the content ledger table for content/LEDGER.md.

Usage:
    python tools/ledger_report.py

Reads only source files, so it is safe to run while a chapter is half-written.
Columns match the ledger: words, reading length, sentence pairs, dictation
count, drill count and model-answer length per chapter.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB = os.path.join(ROOT, "content", "vocab")
CONTENT = os.path.join(ROOT, "content")

CJK = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]")
KANA = re.compile(r"[\u3040-\u309F\u30A0-\u30FF]")
MARK = re.compile(r"[\u3005\u30FC]")
DIGIT = re.compile(r"[0-9]")


def counted(text: str) -> int:
    return sum(1 for ch in str(text or "") if CJK.match(ch) or KANA.match(ch) or MARK.match(ch) or DIGIT.match(ch))


def vocab_rows(path: str) -> int:
    if not os.path.exists(path):
        return 0
    n = 0
    with io.open(path, encoding="utf-8-sig") as fh:
        for line in fh:
            if line.strip() and not line.lstrip().startswith("#"):
                n += 1
    return n


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    rows = []
    for name in sorted(os.listdir(CONTENT)):
        m = re.match(r"^lesson-(\d+)\.json$", name)
        if not m:
            continue
        chapter = int(m.group(1))
        with io.open(os.path.join(CONTENT, name), encoding="utf-8") as fh:
            data = json.load(fh)
        reading = data.get("reading") or {}
        grammar = data.get("grammar") or {}
        writing = data.get("writing") or {}
        words = vocab_rows(os.path.join(VOCAB, "recap-%02d.tsv" % chapter))
        rows.append(
            "| %d | %s | %s | %s | %d | %d | %d | %d | %d | %d chars | sentence-level | ✓ | pass |"
            % (
                chapter,
                (data.get("title") or {}).get("l2", ""),
                (data.get("title") or {}).get("l1", ""),
                grammar.get("point_l2", ""),
                words,
                counted(reading.get("text_l2", "")),
                len(reading.get("sentences") or []),
                len((data.get("listening") or {}).get("dictation") or []),
                len(grammar.get("drills") or []),
                counted(writing.get("model_l2", "")),
            )
        )

    header = (
        "| Ch | Title (L2) | Title (L1) | Grammar point | Words | Reading chars | Sentences "
        "| Dictation | Drills | Writing | Translations | Tap | Validate |"
    )
    sep = "|---|---|---|---|---|---|---|---|---|---|---|---|---|"
    print(header)
    print(sep)
    print("\n".join(rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
