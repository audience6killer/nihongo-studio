#!/usr/bin/env python3
"""Build assets/js/data/lessons.js from content/lesson-NN.json.

Usage:
    python tools/build_content.py

Structural validation lives in tools/validate_content.py; this tool only does
the minimum needed to avoid emitting broken data (parse, required keys, unique
chapter numbers).
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _common import Report, lesson_json_files, read_json, utf8_stdout, write_js  # noqa: E402

REQUIRED_TOP = ("schema", "l2", "l1", "chapter", "title", "grammar", "reading", "listening", "writing")


def main() -> int:
    utf8_stdout()
    report = Report("build_content")

    lessons: list[dict] = []
    seen: set[int] = set()

    for deck, chapter, path in lesson_json_files():
        data = read_json(path, report)
        if not isinstance(data, dict):
            continue
        where = os.path.relpath(path, os.path.dirname(os.path.dirname(path)))
        missing = [k for k in REQUIRED_TOP if k not in data]
        if missing:
            report.error(f"{where}: missing top-level key(s): {', '.join(missing)}")
            continue
        if not isinstance(data.get("chapter"), int):
            report.error(f"{where}: chapter must be an integer")
            continue
        if data["chapter"] != chapter:
            report.error(f"{where}: chapter is {data['chapter']} but the filename says {chapter}")
            continue
        if data["schema"] != 2:
            report.error(f"{where}: schema must be 2, got {data['schema']!r}")
        if data.get("l2") != "ja" or data.get("l1") != "en":
            report.error(f"{where}: l2 must be 'ja' and l1 must be 'en'")
        if chapter in seen:
            report.error(f"{where}: duplicate chapter number {chapter}")
            continue
        seen.add(chapter)
        data["deck"] = deck
        lessons.append(data)

    if not lessons:
        report.error("no lesson files found")

    if not report.emit():
        return 1

    lessons.sort(key=lambda d: d["chapter"])
    write_js("assets/js/data/lessons.js", "NJ_LESSONS", lessons,
             "Nihongo Studio lesson content — window.NJ_LESSONS")
    for les in lessons:
        print(f"    lesson {les['chapter']:02d}  {les['title']['l2']} / {les['title']['l1']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
