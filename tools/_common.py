#!/usr/bin/env python3
"""Shared helpers for the content tools. Python stdlib only."""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
VOCAB_DIR = os.path.join(CONTENT, "vocab")
DATA_DIR = os.path.join(ROOT, "assets", "js", "data")

POS_VALUES = {
    "n.", "い-adj.", "な-adj.", "v.i.", "v.t.", "v.suru", "adv.", "conj.", "exp.",
    # tap-extra only
    "part", "form", "name", "num",
}

DECK_OF_PREFIX = {"recap": "recap", "n2": "n2", "refresh": "refresh"}


def utf8_stdout() -> None:
    """Windows consoles default to a legacy code page; force UTF-8 output."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


class Report:
    """Collects errors and warnings so one run reports everything at once."""

    def __init__(self, label: str):
        self.label = label
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def emit(self) -> bool:
        for w in self.warnings:
            print(f"  ! {w}", file=sys.stderr)
        for e in self.errors:
            print(f"  x {e}", file=sys.stderr)
        if self.errors:
            print(f"\n{self.label}: {len(self.errors)} error(s), {len(self.warnings)} warning(s)", file=sys.stderr)
            return False
        print(f"{self.label}: ok ({len(self.warnings)} warning(s))")
        return True


def read_tsv_meta(path: str) -> dict:
    """Read `# title_l2: ...` style metadata from a vocabulary file header."""
    meta: dict[str, str] = {}
    if not os.path.exists(path):
        return meta
    with open(path, "r", encoding="utf-8-sig") as fh:
        for raw in fh:
            line = raw.strip()
            if not line:
                continue
            if not line.startswith("#"):
                break
            body = line[1:].strip()
            if ":" in body:
                key, value = body.split(":", 1)
                key = key.strip().lower()
                if key in ("title_l2", "title_l1", "deck"):
                    meta[key] = value.strip()
    return meta


def read_tsv(path: str, report: Report) -> list[dict]:
    """Read a tab-separated vocabulary file. Blank lines and # comments skipped."""
    rows: list[dict] = []
    if not os.path.exists(path):
        report.error(f"{os.path.relpath(path, ROOT)}: missing")
        return rows

    with open(path, "r", encoding="utf-8-sig") as fh:
        for lineno, raw in enumerate(fh, start=1):
            line = raw.rstrip("\r\n")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            cells = line.split("\t")
            where = f"{os.path.relpath(path, ROOT)}:{lineno}"
            if len(cells) < 4:
                report.error(f"{where}: expected 4+ tab-separated cells, got {len(cells)}")
                continue
            cells = [c.strip() for c in cells]
            while len(cells) > 5:
                # tolerate a stray tab inside the last column
                cells = cells[:4] + [" ".join(cells[4:])]
            row = {
                "w": cells[0],
                "reading": cells[1],
                "gloss": cells[2],
                "pos": cells[3],
                "alt": [a.strip() for a in cells[4].split(";") if a.strip()] if len(cells) > 4 else [],
                "file": os.path.relpath(path, ROOT),
                "line": lineno,
            }
            if not all(row[k] for k in ("w", "reading", "gloss", "pos")):
                report.error(f"{where}: empty column in {row['w'] or '(blank term)'}")
                continue
            # tap-extra.tsv writes adv/conj/exp without the trailing dot;
            # canonicalise so generated data has one style.
            if row["pos"] not in POS_VALUES and row["pos"] + "." in POS_VALUES:
                row["pos"] = row["pos"] + "."
            if row["pos"] not in POS_VALUES:
                report.error(f"{where}: unknown pos {row['pos']!r} for {row['w']} (allowed: {', '.join(sorted(POS_VALUES))})")
            rows.append(row)
    return rows


def read_json(path: str, report: Report):
    if not os.path.exists(path):
        report.error(f"{os.path.relpath(path, ROOT)}: missing")
        return None
    try:
        with open(path, "r", encoding="utf-8-sig") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        report.error(f"{os.path.relpath(path, ROOT)}: invalid JSON — {exc}")
        return None


def write_js(rel_path: str, var_name: str, payload, header: str) -> None:
    """Write `window.<var_name> = <json>;` with a do-not-edit header."""
    path = os.path.join(ROOT, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    body = json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=False)
    text = (
        f"/* {header}\n"
        f" * GENERATED FILE — do not edit by hand.\n"
        f" * Rebuild with the tools in tools/ (see CONTENT_SPEC.md).\n"
        f" */\n"
        f"window.{var_name} = {body};\n"
    )
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    size = os.path.getsize(path)
    print(f"  wrote {rel_path}  ({size} bytes)")


def write_text(rel_path: str, text: str) -> None:
    path = os.path.join(ROOT, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    print(f"  wrote {rel_path}  ({os.path.getsize(path)} bytes)")


def deck_lesson_files() -> list[tuple[str, int, str]]:
    """Every (deck, chapter, path) triple under content/vocab/, sorted by chapter."""
    found: list[tuple[str, int, str]] = []
    if not os.path.isdir(VOCAB_DIR):
        return found
    for name in sorted(os.listdir(VOCAB_DIR)):
        if not name.endswith(".tsv") or name == "tap-extra.tsv":
            continue
        stem = name[:-4]
        if "-" not in stem:
            continue
        deck, _, num = stem.rpartition("-")
        if not num.isdigit():
            continue
        found.append((deck, int(num), os.path.join(VOCAB_DIR, name)))
    found.sort(key=lambda t: (t[0] != "recap", t[1]))
    return found


def lesson_json_files() -> list[tuple[str, int, str]]:
    found: list[tuple[str, int, str]] = []
    if not os.path.isdir(CONTENT):
        return found
    for name in sorted(os.listdir(CONTENT)):
        if not name.startswith("lesson-") or not name.endswith(".json"):
            continue
        num = name[len("lesson-"):-len(".json")]
        if num.isdigit():
            found.append(("recap", int(num), os.path.join(CONTENT, name)))
    found.sort(key=lambda t: t[1])
    return found
