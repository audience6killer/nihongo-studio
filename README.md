# Nihongo Studio

A static, local-first Japanese study app. One learner, one browser, no server.

**Instance:** Japanese (L2) for an English-speaking learner (L1).
**Recap anchor:** [_Tobira: Gateway to Advanced Japanese_](https://tobiraweb.9640.jp/) — 15 chapters.
**Forward anchor:** JLPT N2.

This app is not affiliated with Kurosio Publishers, the JLPT administrators, or any exam board.
Chapter titles and topic lists are facts taken from the publisher's public site; every passage,
question, drill, explanation and model answer in this repository is original prose.

## What it does

- **Recap units, one per Tobira chapter** — vocabulary, one grammar point, an original reading
  with sentence-paired translations, five dictation sentences, and an optional writing task.
- **Three scheduled skills per word** — recognition, production (typed with your IME), listening.
  Each has its own interval, ease and due date.
- **SM-2-style spaced repetition** with binary grading. No self-rating buttons.
- **A plan, not a content dump** — the app computes a target-date plan and cuts new words when
  the review queue grows. It shows pace honestly, including when the six-month target is short.
- **Tap-to-define** on every word of every passage, with a furigana toggle.
- **Local-first.** All progress lives in `localStorage` under `nihongo.v1`. No analytics, no
  third-party scripts, no network calls except optional sync (not in v1).

Speaking and handwriting are deliberately absent. Production is typed, never scored for
pronunciation.

## Run it

```powershell
python serve.py
# open http://127.0.0.1:8765
```

Requires Python 3.10+ or any static file server. No build step, no `npm install`, no bundler.
The generated data files are committed, so a fresh clone runs immediately.

Rebuild generated data after editing `content/`:

```powershell
python tools/make_icons.py      # app icons, no image library needed
python tools/build_vocab.py     # content/vocab/*.tsv -> vocab.js
python tools/build_content.py   # content/lesson-NN.json -> lessons.js
python tools/build_tapdata.py   # merged dictionary -> tap.js
```

Check everything:

```powershell
node tools/test_lang.mjs        # language adapter, 50 checks
node tools/check_tap.mjs        # tap coverage must be 100%
node tools/smoke.mjs            # every module loads; every screen renders
python tools/validate_content.py
```

## State of the build

Chapter 1 is complete and end to end: onboarding, plan, new-word cards, recognition,
production, listening, dictation, reading with tap-to-define, the writing task, stats,
settings and export/import.

Chapters 2–15 are not authored yet. The engine, schema and validators already handle them —
`content/LEDGER.md` tracks what exists and what does not.

Not yet built: calibration/refresh deck, checkpoints, the N2 deck, sync, and deploy.
Those are Phases 3–8 in `PLAN.md`.

## Audio needs a Japanese voice

The listening skill uses the browser's speech synthesis. **If your device has no `ja-JP` voice,
the app runs in silent mode**: listening cards are deferred rather than lost, and a setup card
explains the fix.

On Windows: Settings → Time & Language → Language & region → Add a language → 日本語 →
Language features → **Speech**. Then reload the app.

Microsoft Edge additionally exposes cloud `ja-JP` natural voices even without the system pack.

## Files

| Path | Role |
|---|---|
| `index.html` | App shell and script load order |
| `assets/js/core/` | `util`, `lang` (Japanese adapter), `data`, `storage`, `srs`, `plan`, `session`, `tts` |
| `assets/js/ui/` | Screens |
| `assets/js/data/` | Generated `vocab.js`, `lessons.js`, `tap.js`, plus build-injected `config.js` |
| `content/vocab/` | Authored vocabulary, one TSV per chapter |
| `content/lesson-NN.json` | Authored chapter content |
| `tools/` | Build, validate, test, serve |
| `PLAN.md` | The approved build plan and its decisions |
| `INSTANCE.md` | The filled instance brief (PORTING.md §1) |
| `CONTENT_SPEC.md` | Japanese content schema and authoring rules |
| `STUDY_PLAN.md` | The learning rationale behind the recap + N2 ramp |

## Data and licences

- **Vocabulary, readings, glosses, passages, exercises:** authored for this project. No
  dictionary data is downloaded or redistributed.
- **Tobira chapter titles and topic lists:** public facts from the publisher's site, used for
  syllabus anchoring only.
- **JLPT:** the exam does not publish official word lists. Any level counts in the plan are
  community approximations, not official figures.
- **Audio:** generated at runtime by browser speech synthesis. No audio files are bundled.

## Development notes

- Interface HTML is `lang="en"`; every piece of Japanese content carries `lang="ja"`.
- All state is in one object. Export it from Settings before switching origins —
  `localStorage` is per origin, so `http://127.0.0.1:8765` and a deployed site do not share
  progress.
- The service worker is skipped on `localhost`/`127.0.0.1` and when the URL contains `?nosw`,
  so development never fights the cache.
