#!/usr/bin/env python3
"""Resolve vocabulary terms claimed by more than one file.

A vocabulary term is a global key: two chapters cannot both teach 世代, and a
tap file cannot re-define a word the course already teaches. When several
authors work in parallel, collisions are normal — this tool settles them by a
fixed precedence and rewrites the losing rows away.

Precedence (highest keeps the row):
  1. recap-NN.tsv, earliest chapter first   — the course teaches it there
  2. n2-NN.tsv, earliest deck first         — the N2 phase teaches it there
  3. tap-extra.tsv                          — the shared dictionary
  4. tap-NN.tsv, lowest chapter first       — a chapter's own surfaces

A row dropped from a tap file is harmless: the term still resolves through the
vocabulary file that owns it. A row dropped from a vocabulary file is reported
so the affected chapter can be re-checked.

Usage:
    python tools/dedupe_vocab.py           # dry run, lists what would go
    python tools/dedupe_vocab.py --write   # apply
"""
from __future__ import annotations

import collections
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB = os.path.join(ROOT, "content", "vocab")


def rank(name: str) -> tuple:
    m = re.match(r"^recap-(\d+)\.tsv$", name)
    if m:
        return (0, int(m.group(1)))
    m = re.match(r"^n2-(\d+)\.tsv$", name)
    if m:
        return (1, int(m.group(1)))
    if name == "tap-extra.tsv":
        return (2, 0)
    m = re.match(r"^tap-(\d+)\.tsv$", name)
    if m:
        return (3, int(m.group(1)))
    return (4, 0)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    write = "--write" in sys.argv

    files = sorted((n for n in os.listdir(VOCAB) if n.endswith(".tsv")), key=rank)

    owners: dict[str, str] = {}
    contents: dict[str, list[str]] = {}
    for name in files:
        with io.open(os.path.join(VOCAB, name), encoding="utf-8") as fh:
            lines = fh.read().split("\n")
        contents[name] = lines
        for line in lines:
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            term = line.split("\t")[0].strip()
            if term and term not in owners:
                owners[term] = name

    dropped: dict[str, list[tuple[str, str]]] = collections.defaultdict(list)
    rewritten: dict[str, list[str]] = {}

    for name in files:
        out: list[str] = []
        for line in contents[name]:
            if not line.strip() or line.lstrip().startswith("#"):
                out.append(line)
                continue
            term = line.split("\t")[0].strip()
            owner = owners.get(term)
            if owner and owner != name:
                dropped[name].append((term, owner))
                continue
            out.append(line)
        while out and not out[-1].strip():
            out.pop()
        rewritten[name] = out

    total = sum(len(v) for v in dropped.values())
    if not total:
        print("dedupe_vocab: nothing to resolve")
        return 0

    for name in files:
        if not dropped[name]:
            continue
        print(f"  {name}: {len(dropped[name])} row(s)")
        for term, owner in dropped[name]:
            print(f"      {term}  ->  keeps its row in {owner}")

    if not write:
        print(f"\ndedupe_vocab: {total} row(s) would move. Re-run with --write to apply.")
        return 0

    for name in files:
        if not dropped[name]:
            continue
        with io.open(os.path.join(VOCAB, name), "w", encoding="utf-8", newline="\n") as fh:
            fh.write("\n".join(rewritten[name]) + "\n")

    vocab_lost = [
        (name, term) for name in files
        if rank(name)[0] in (0, 1)
        for term, owner in dropped[name]
    ]
    print(f"\ndedupe_vocab: {total} row(s) removed.")
    if vocab_lost:
        print("  Vocabulary rows removed — re-check these chapters, their writing tasks may")
        print("  reference a word that now belongs to an earlier chapter:")
        for name, term in vocab_lost:
            print(f"      {name}: {term}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
