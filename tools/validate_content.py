#!/usr/bin/env python3
"""Validate authored lesson content against CONTENT_SPEC.md.

Usage:
    python tools/validate_content.py                 # every lesson
    python tools/validate_content.py --lessons 1     # one chapter
    python tools/validate_content.py --lessons 1-3   # a range

Checks are structural. Editorial quality — natural Japanese, honest glosses,
workplace-safe topics — still needs a human. Anything uncertain goes in
content/REVIEW.md.
"""
from __future__ import annotations

import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _common import (  # noqa: E402
    CONTENT, Report, lesson_json_files, read_json, read_tsv, VOCAB_DIR,
    utf8_stdout,
)

# Japanese character counters, matching core/lang.js countUnits().
CJK = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]")
KANA = re.compile(r"[\u3040-\u309F\u30A0-\u30FF]")
MARK = re.compile(r"[\u3005\u30FC]")
DIGIT = re.compile(r"[0-9]")
KANA_ONLY = re.compile(r"^[\u3041-\u3096\u30A1-\u30FA\u30FC\u309D\u309E\u30FD\u30FE\u3001\u3002\uFF01\uFF1F\u2026\u30FB\u300C\u300D\u300E\u300F\uFF08\uFF09]+$")

READING_MIN, READING_MAX = 240, 360   # spec says 250-350; allow a small margin
MIN_SENTENCES = 3


def count_units(text: str, unit: str) -> int:
    if unit == "words":
        return len(text.split())
    return sum(1 for ch in text if CJK.match(ch) or KANA.match(ch) or MARK.match(ch) or DIGIT.match(ch))


def near_duplicate(a: str, b: str) -> bool:
    """True when two translations are the same text (the §4.12 bug signature)."""
    na = re.sub(r"\s+", " ", a or "").strip().lower()
    nb = re.sub(r"\s+", " ", b or "").strip().lower()
    return bool(na) and na == nb


def parse_range(spec: str | None) -> set[int] | None:
    if not spec:
        return None
    out: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            out.update(range(int(lo), int(hi) + 1))
        else:
            out.add(int(part))
    return out


def validate_lesson(data: dict, path: str, vocabulary: set[str], report: Report) -> None:
    rel = os.path.relpath(path, os.path.dirname(os.path.dirname(path)))
    chapter = data.get("chapter")
    tag = f"{rel} (ch.{chapter})"

    title = data.get("title") or {}
    if not title.get("l2") or not title.get("l1"):
        report.error(f"{tag}: title.l2 and title.l1 are both required")

    # ------------------------------------------------------------- grammar
    g = data.get("grammar") or {}
    for key in ("point_l2", "point_l1", "explain_l1", "common_mistake_l1"):
        if not str(g.get(key, "")).strip():
            report.error(f"{tag}: grammar.{key} is empty")

    examples = g.get("examples") or []
    if len(examples) != 3:
        report.error(f"{tag}: grammar.examples must have exactly 3 entries, found {len(examples)}")
    for i, ex in enumerate(examples):
        for key in ("l2", "reading", "l1"):
            if not str(ex.get(key, "")).strip():
                report.error(f"{tag}: grammar.examples[{i}].{key} is empty")
        reading = str(ex.get("reading", ""))
        if reading and not KANA_ONLY.match(reading):
            report.error(f"{tag}: grammar.examples[{i}].reading must be kana only, got {reading!r}")

    drills = g.get("drills") or []
    if len(drills) != 2:
        report.error(f"{tag}: grammar.drills must have exactly 2 entries, found {len(drills)}")
    for i, d in enumerate(drills):
        opts = d.get("options_l2") or []
        if len(opts) != 4:
            report.error(f"{tag}: grammar.drills[{i}] must have 4 options, found {len(opts)}")
        ans = d.get("answer")
        if not isinstance(ans, int) or not (0 <= ans < max(1, len(opts))):
            report.error(f"{tag}: grammar.drills[{i}].answer out of range ({ans!r})")
        if not str(d.get("q_l2", "")).strip() or not str(d.get("explain_l1", "")).strip():
            report.error(f"{tag}: grammar.drills[{i}] is missing q_l2 or explain_l1")
        if len(set(opts)) != len(opts):
            report.error(f"{tag}: grammar.drills[{i}] has duplicate options")

    # ------------------------------------------------------------- reading
    r = data.get("reading") or {}
    text = r.get("text_l2") or ""
    sents = r.get("sentences") or []
    if not text:
        report.error(f"{tag}: reading.text_l2 is empty")
    if len(sents) < MIN_SENTENCES:
        report.error(f"{tag}: reading.sentences needs at least {MIN_SENTENCES} pairs, found {len(sents)}")

    joined = "".join(str(s.get("l2", "")) for s in sents)
    if text and sents and joined != text:
        report.error(
            f"{tag}: reading.text_l2 must equal the concatenation of sentences[].l2 "
            f"({len(text)} vs {len(joined)} chars)"
        )

    length = count_units(text, "chars")
    if text and not (READING_MIN <= length <= READING_MAX):
        report.error(f"{tag}: reading is {length} characters, expected {READING_MIN}-{READING_MAX}")

    for i, s in enumerate(sents):
        if not str(s.get("l2", "")).strip() or not str(s.get("l1", "")).strip():
            report.error(f"{tag}: reading.sentences[{i}] needs both l2 and l1")
    l1s = [str(s.get("l1", "")) for s in sents if s.get("l1")]
    for i in range(len(l1s)):
        for j in range(i + 1, len(l1s)):
            if near_duplicate(l1s[i], l1s[j]):
                report.error(
                    f"{tag}: reading.sentences[{i}] and [{j}] have identical translations — "
                    "a passage-level translation has probably been pasted onto every sentence"
                )

    questions = r.get("questions") or []
    corpus = (text + " " + " ".join(str(q.get("q_l2", "")) for q in questions)).lower()
    for i, q in enumerate(questions):
        opts = q.get("options_l2") or []
        if len(opts) != 4:
            report.error(f"{tag}: reading.questions[{i}] must have 4 options, found {len(opts)}")
        ans = q.get("answer")
        if not isinstance(ans, int) or not (0 <= ans < max(1, len(opts))):
            report.error(f"{tag}: reading.questions[{i}].answer out of range ({ans!r})")
        if not str(q.get("q_l2", "")).strip() or not str(q.get("explain_l1", "")).strip():
            report.error(f"{tag}: reading.questions[{i}] is missing q_l2 or explain_l1")
        if len(set(opts)) != len(opts):
            report.error(f"{tag}: reading.questions[{i}] has duplicate options")
    del corpus

    # ----------------------------------------------------------- listening
    li = data.get("listening") or {}
    dictation = li.get("dictation") or []
    if len(dictation) != 5:
        report.error(f"{tag}: listening.dictation must have exactly 5 sentences, found {len(dictation)}")
    for i, d in enumerate(dictation):
        l2 = str(d.get("l2", "")).strip()
        if not l2:
            report.error(f"{tag}: listening.dictation[{i}].l2 is empty")
            continue
        if not str(d.get("l1", "")).strip():
            report.error(f"{tag}: listening.dictation[{i}].l1 is empty")
        n = count_units(l2, "chars")
        if not (6 <= n <= 60):
            report.error(f"{tag}: listening.dictation[{i}] is {n} characters; keep dictation 6-60")

    # ------------------------------------------------------------- writing
    w = data.get("writing") or {}
    unit = w.get("unit")
    if unit not in ("chars", "words"):
        report.error(f"{tag}: writing.unit must be 'chars' or 'words', got {unit!r}")
    required = w.get("required") or []
    if not (3 <= len(required) <= 6):
        report.error(f"{tag}: writing.required must list 3-6 words, found {len(required)}")
    model = str(w.get("model_l2", ""))
    if not model:
        report.error(f"{tag}: writing.model_l2 is empty")
    for word in required:
        if word not in model:
            report.error(f"{tag}: required word {word!r} does not appear in writing.model_l2")
        if vocabulary and word not in vocabulary:
            report.warn(f"{tag}: required word {word!r} is not vocabulary in this chapter")
    min_units = w.get("min_units")
    if not isinstance(min_units, int) or min_units <= 0:
        report.error(f"{tag}: writing.min_units must be a positive integer")
    elif model:
        got = count_units(model, unit or "chars")
        if got < min_units:
            report.error(f"{tag}: writing.model_l2 is {got} {unit or 'chars'} but min_units is {min_units}")
    for key in ("prompt_l1", "tips_l1"):
        if not str(w.get(key, "")).strip():
            report.error(f"{tag}: writing.{key} is empty")
    if required and len(required) != len(set(required)):
        report.error(f"{tag}: writing.required has duplicates")


def main() -> int:
    utf8_stdout()
    ap = argparse.ArgumentParser(description="Validate lesson content.")
    ap.add_argument("--lessons", default=None, help="chapter number or range, e.g. 1 or 1-3")
    args = ap.parse_args()
    wanted = parse_range(args.lessons)

    report = Report("validate_content")
    files = lesson_json_files()
    if not files:
        report.error("no content/lesson-NN.json files found")

    vocabulary_by_chapter: dict[int, set[str]] = {}
    for deck, chapter, path in files:
        rows = read_tsv(path.replace(os.path.join("content"), os.path.join("content", "vocab"))
                        .replace(f"lesson-{chapter:02d}.json", f"{deck}-{chapter:02d}.tsv"), Report("vocab"))
        if rows:
            vocabulary_by_chapter[chapter] = {r["w"] for r in rows}

    # tap-extra words also count as known vocabulary for the writing check
    extra = read_tsv(os.path.join(VOCAB_DIR, "tap-extra.tsv"), Report("tap-extra"))
    extra_terms = {r["w"] for r in extra}

    seen_points: dict[str, str] = {}
    checked = 0
    for deck, chapter, path in files:
        if wanted is not None and chapter not in wanted:
            continue
        checked += 1
        data = read_json(path, report)
        if not isinstance(data, dict):
            continue
        vocab = vocabulary_by_chapter.get(chapter, set()) | extra_terms
        validate_lesson(data, path, vocab, report)

        point = str((data.get("grammar") or {}).get("point_l2", "")).strip()
        if point:
            if point in seen_points:
                report.error(f"lesson {chapter}: grammar point {point!r} already used in {seen_points[point]}")
            else:
                seen_points[point] = f"lesson {chapter}"

    if checked == 0:
        report.error(f"no lessons matched --lessons {args.lessons}")

    if not report.emit():
        return 1
    print(f"  {checked} lesson(s) validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
