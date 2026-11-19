# Content spec — Japanese recap units

Authoring rules for `content/`. The validator (`tools/validate_content.py`) enforces the
mechanical parts; the rest is editorial judgement.

## 1. Files

| Path | Purpose |
|---|---|
| `content/vocab/recap-NN.tsv` | Vocabulary for chapter NN, tab-separated, one row per word |
| `content/vocab/tap-extra.tsv` | Function words, proper nouns and inflected forms needed for tap coverage |
| `content/lesson-NN.json` | The chapter's grammar, reading, listening and writing content |
| `content/LEDGER.md` | Content ledger: chapter, grammar point, word count, translation status |
| `content/REVIEW.md` | Entries that need a human read before they can be trusted |

Generated, never hand-edited: `assets/js/data/vocab.js`, `lessons.js`, `tap.js`,
`content/vocab-by-lesson.json`.

## 2. Vocabulary TSV

Tab-separated, header row required, `#` for comments.

```
term	reading	gloss	pos	alt
気候	きこう	climate	n.	
恵まれる	めぐまれる	to be blessed with; to be favoured with	v.i.	恵まれた
```

| Column | Rule |
|---|---|
| `term` | The lookup key. Kanji, kana or katakana. Unique across the whole course. |
| `reading` | Kana only (hiragana, katakana, ー, ゝ). Required. |
| `gloss` | English, semicolon-separated senses. Lowercase unless a proper noun. |
| `pos` | One of `n.`, `い-adj.`, `な-adj.`, `v.i.`, `v.t.`, `v.suru`, `adv.`, `conj.`, `exp.` |
| `alt` | Optional, `;`-separated alternative accepted answers (curated only, never generated) |

Rules:

- **Original curation.** Do not transcribe the textbook's word list. Choose words at N3/N2
  frequency that a learner needs for the chapter's topic.
- One row per distinct written form. Inflections belong in `alt` or in `tap-extra.tsv`.
- No duplicate `term` anywhere in the course; the validator fails on collision.
- If a reading or gloss is uncertain, still ship it but add the term to `content/REVIEW.md`.

## 3. Lesson JSON

```json
{
  "schema": 2,
  "l2": "ja",
  "l1": "en",
  "chapter": 1,
  "title": { "l2": "日本の地理", "l1": "The Geography of Japan" },
  "grammar": {
    "point_l2": "あいづちとフィラー",
    "point_l1": "Backchannels and fillers",
    "explain_l1": "…",
    "common_mistake_l1": "…",
    "examples": [
      { "l2": "…", "reading": "…", "l1": "…" }
    ],
    "drills": [
      { "q_l2": "…", "options_l2": ["…"], "answer": 0, "explain_l1": "…" }
    ]
  },
  "reading": {
    "text_l2": "…",
    "sentences": [ { "l2": "…", "l1": "…" } ],
    "questions": [
      { "q_l2": "…", "options_l2": ["…"], "answer": 0, "explain_l1": "…" }
    ]
  },
  "listening": {
    "dictation": [ { "l2": "…", "l1": "…" } ]
  },
  "writing": {
    "prompt_l1": "…",
    "required": ["…"],
    "min_units": 100,
    "unit": "chars",
    "model_l2": "…",
    "tips_l1": "…"
  }
}
```

### Rules per section

**Grammar** — exactly one point per chapter. `explain_l1` is 2–4 sentences and assumes the learner
has met the point before: this is a recap, so remind and contrast rather than introduce.
`common_mistake_l1` names one specific error an English speaker makes. Exactly 3 examples with a
kana `reading` and a full English `l1`. Exactly 2 drills, each with 4 options and one correct
`answer` index.

**Reading** — 250–350 CJK + kana characters of original prose on the chapter's topic.
`sentences` is mandatory and is the **only** place sentence translations live:
`text_l2` must equal the concatenation of `sentences[].l2`. Never attach a whole-passage
translation to a single sentence (this is the bug PORTING.md §4.12 records). Exactly 3 questions:
main idea, detail, inference/attitude. Every character of `text_l2` must resolve to a tap entry.

**Listening** — exactly 5 dictation sentences. Unambiguous when heard; typeable on a Japanese IME;
built from the chapter's words where natural. No homophone traps unless the chapter is about them.
Each has its own `l1`.

**Writing** — 3–6 `required` terms, all appearing in `model_l2`. `min_units` counts characters
(CJK + kana) for Japanese. `prompt_l1` and `tips_l1` are English. The stage is labelled output
practice in the UI: JLPT does not test writing.

## 4. Editorial rules that no validator can check

- **Original prose only.** Do not copy or paraphrase the textbook's passages, dialogues, or
  exercises. Chapter titles and topic lists are facts and may be used.
- Workplace-safe and adult. No politics, no graphic content, no romance beyond mild mention.
  Avoid anime/manga clichés and "cool Japan" stereotyping.
- Recycle earlier chapters' vocabulary; keep new-word density manageable.
- Natural Japanese, not textbook dialogue. Prefer concrete detail over abstraction.
- Every Japanese sentence that appears alone on a card needs its own English translation.
- The writing score is a heuristic (length, required-word coverage, sentence count). Say so in the
  UI and tell the learner to have a human check style.

## 5. Validation

```powershell
python tools/validate_content.py --lessons 1
python tools/check_tap.mjs
node tools/test_lang.mjs
```

`validate_content.py` checks: schema shape, sentence-pair completeness and concatenation equality,
option counts and answer indices, required-words in the model, character counts, `reading` being
kana-only, duplicate terms, and duplicate grammar ids.

`check_tap.mjs` proves that tap coverage is total: for every passage, the segments must
reconstruct the source exactly and every segment must resolve to a dictionary entry with a reading
and a gloss. Segmentation maximises dictionary coverage with dynamic programming (`L.segment`), not
greedy longest-match — greedy picks the longer-but-wrong はい inside はいなくなる and strands a
character. If the check fails it names the exact uncovered run and its context; add it to
`tap-extra.tsv` and rebuild.

Most gaps are inflected surfaces of words already taught (使います, 変わってくる, 任せられる).
That is expected: the dictionary is surface-based, so a verb needs one row per form that appears in
the content. Check the report before writing new words — usually you are adding a form, not a word.

## 6. Adding a chapter

A single chapter can be written and checked on its own, without rebuilding the
generated bundle and without touching other chapters' files.

1. Write `content/vocab/recap-NN.tsv`.
2. Write `content/lesson-NN.json`.
3. Run `node tools/check_chapter.mjs NN`. It reads the source files directly and reports:
   schema problems, counts, reading length, sentence-pair alignment, writing constraints, and
   every token of every text that has no dictionary entry, with its surrounding context.
4. Add the missing tokens to `content/vocab/tap-NN.tsv` — a per-chapter dictionary file, merged
   automatically with `tap-extra.tsv` and every other `tap-*.tsv`. Repeat until it prints PASS.
5. `npm run build` (or the individual build tools) to regenerate the bundle, then `npm test`.
6. Add rows to `content/LEDGER.md` and `content/REVIEW.md`.
7. Spot-check the rendering of the passage, every question, and the writing model answer.

### Why a per-chapter tap file

The tap dictionary is surface-based: every inflected form that appears in the prose needs its
own row. Two writers touching one shared file conflict, so each chapter owns `tap-NN.tsv` and
`tools/build_tapdata.py` merges them in order (`tap-extra.tsv` first, so shared glosses win).

`node tools/used_terms.mjs` prints every term the course has already claimed. Vocabulary terms are
global keys — a term taught in chapter 2 cannot be taught again in chapter 11 — so check it before
finalising a TSV.
