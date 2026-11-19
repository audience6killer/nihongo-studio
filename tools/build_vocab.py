#!/usr/bin/env python3
"""Build assets/js/data/vocab.js and content/vocab-by-lesson.json from TSVs.

Usage:
    python tools/build_vocab.py

Sources:
    content/vocab/<deck>-NN.tsv   course vocabulary, one file per chapter
    content/lesson-NN.json        chapter titles (used for the lesson index)

The TSV files are the source of truth. Nothing is downloaded.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _common import (  # noqa: E402
    CONTENT, Report, deck_lesson_files, lesson_json_files, read_json, read_tsv,
    read_tsv_meta, utf8_stdout, write_js, write_text,
)

SCHEMA = 2

# Decks share one number line so a chapter id is unique across the course.
# Recap units keep 1..99; N2 decks start at 101.
DECK_OFFSET = {"recap": 0, "n2": 100}


def main() -> int:
    utf8_stdout()
    report = Report("build_vocab")

    titles: dict[tuple[str, int], dict] = {}
    for deck, chapter, path in lesson_json_files():
        data = read_json(path, report)
        if isinstance(data, dict) and isinstance(data.get("title"), dict):
            titles[(deck, chapter)] = {
                "title_l2": data["title"].get("l2", ""),
                "title_l1": data["title"].get("l1", ""),
            }

    lessons: list[dict] = []
    words: list[dict] = []
    seen: dict[str, str] = {}
    decks: list[str] = []

    for deck, chapter, path in deck_lesson_files():
        if deck not in decks:
            decks.append(deck)
        rows = read_tsv(path, report)
        if not rows:
            report.error(f"{os.path.relpath(path, os.path.dirname(path))}: no vocabulary rows")
            continue

        # A vocabulary-only deck carries its title in the TSV header comments.
        tsv_meta = read_tsv_meta(path)
        unit = chapter + DECK_OFFSET.get(deck, 0)

        chapter_terms: list[str] = []
        for row in rows:
            term = row["w"]
            where = f"{row['file']}:{row['line']}"
            if term in seen:
                report.error(f"{where}: duplicate term {term!r}, first defined at {seen[term]}")
                continue
            if len(term) == 1 and term in "はがをにでとのもへやか":
                report.error(f"{where}: {term!r} looks like a particle and should live in tap-extra.tsv")
                continue
            seen[term] = where
            chapter_terms.append(term)
            words.append({
                "w": term,
                "reading": row["reading"],
                "gloss": row["gloss"],
                "pos": row["pos"],
                "alt": row["alt"],
                "lesson": unit,
                "deck": deck,
            })

        meta = titles.get((deck, chapter), {})
        lessons.append({
            "n": unit,
            "deck": deck,
            "title_l2": meta.get("title_l2") or tsv_meta.get("title_l2", ""),
            "title_l1": meta.get("title_l1") or tsv_meta.get("title_l1", ""),
            "has_lesson": (deck, chapter) in titles,
            "count": len(chapter_terms),
            "words": chapter_terms,
        })

    # Every chapter of a deck that has a lesson file must have vocabulary.
    for key in titles:
        if key[0] not in decks:
            report.warn(f"lesson {key[1]} ({key[0]}) has a lesson file but no vocabulary TSV yet")

    if not words:
        report.error("no vocabulary found; nothing to build")

    if not report.emit():
        return 1

    payload = {
        "meta": {
            "schema": SCHEMA,
            "l2": "ja",
            "l1": "en",
            "app": "ja",
            "decks": decks,
            "count": len(words),
            "lessons": len(lessons),
        },
        "lessons": lessons,
        "words": words,
    }
    write_js("assets/js/data/vocab.js", "NJ_VOCAB", payload,
             "Nihongo Studio vocabulary — window.NJ_VOCAB")

    index = [
        {
            "deck": les["deck"],
            "lesson": les["n"],
            "title_l2": les["title_l2"],
            "title_l1": les["title_l1"],
            "items": [
                {
                    "w": w["w"], "reading": w["reading"], "pos": w["pos"],
                    "gloss": w["gloss"], "alt": w["alt"],
                }
                for w in words if w["lesson"] == les["n"] and w["deck"] == les["deck"]
            ],
        }
        for les in lessons
    ]
    import json
    write_text("content/vocab-by-lesson.json", json.dumps(index, ensure_ascii=False, indent=1) + "\n")

    # per-chapter summary
    for les in lessons:
        print(f"    {les['deck']}-{les['n']:02d}  {les['count']:3d} words  {les['title_l2']}")
    print(f"  total: {len(words)} words across {len(lessons)} chapter(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
