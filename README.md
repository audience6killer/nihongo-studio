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
  third-party scripts, and no network calls at all unless you connect optional cloud sync.

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
npm test                        # the whole suite, in order
```

| Command | What it proves |
|---|---|
| `node tools/test_lang.mjs` | Language adapter: normalisation, kana acceptance, segmentation |
| `node tools/check_tap.mjs` | Every token of every passage resolves to a dictionary entry |
| `node tools/smoke.mjs` | Every module loads, every screen renders, SRS and plan behave |
| `node tools/qa.mjs` | Asset wiring, service-worker parity, instance isolation, data integrity, no secrets |
| `python tools/validate_content.py` | Lesson schema, sentence pairs, option counts, writing constraints |
| `node tools/check_chapter.mjs NN` | One chapter, from source files: schema plus 100% tap coverage |
| `node tools/used_terms.mjs` | Every vocabulary term the course has already claimed |

## Build and deploy

```powershell
npm run build          # regenerate data, then assemble deploy/
npm run deploy:preview # serve deploy/ at http://127.0.0.1:8770
```

`npm run build` runs the content pipeline and then `tools/prepare_deploy.mjs`, which:

1. wipes `deploy/` and copies the app plus its generated data,
2. writes `assets/js/data/config.js` from `SUPABASE_URL` / `SUPABASE_ANON_KEY` (empty when unset),
3. hashes every deployed file and stamps that digest into the service worker's cache name,
4. fails the build if the service worker's `CORE` list names a file that was not shipped, or if
   anything secret-shaped reached the output.

Netlify: connect the repository, leave the base directory empty, build `npm run build`, publish
`deploy`, Node 20 (pinned in `.nvmrc` and `netlify.toml`). `deploy/` is gitignored — it is a build
artefact, never a source of truth.

**Cloud sync is optional.** The build writes `SUPABASE_URL` and `SUPABASE_ANON_KEY` into
`config.js`; with neither set the app is purely local and Settings accepts a project by hand
instead. `supabase/schema.sql` creates the table, the RLS policy and the atomic `save_progress`
function; `setup.html` is the step-by-step walkthrough, with the SQL injected at build time.

Local-first is the invariant, not a slogan: every answer is written to this browser first, the
cloud holds a sanitised mirror, and no session token is ever uploaded. Conflicts merge the two
snapshots field by field, so a session on the phone and a session on the laptop do not
erase each other.


## State of the build

Everything in the plan is built: onboarding, calibration with a refresh deck, the daily session
(recognition, production, listening, dictation), reading with tap-to-define, writing tasks,
scheduled and practice checkpoints, phase switching between the recap and the N2 decks, stats,
settings, export/import, a deploy build and a service worker.

Content:

| Deck | Units | Words | Content |
|---|---|---|---|
| Tobira recap | 15 of 15 | 773 | full chapters: reading, grammar, dictation, writing |
| N2 vocabulary | 3 | 134 | words only — readings and grammar still to come |

15 lessons · 10,602 passage tokens, every one tappable · 1,980 dictionary entries.
`content/LEDGER.md` is the authority on what exists and `content/REVIEW.md` lists what still wants
a human read.

Optional cloud sync ships with the app. It needs its own Supabase project — see `setup.html`.

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

| Material | Source | Licence |
|---|---|---|
| Vocabulary, readings, glosses, passages, drills, model answers | Written for this project | © the project author |
| Chapter titles and topic lists | Public pages of the Tobira publisher site | Facts, used for syllabus anchoring only |
| Interface code, build tools | This repository | © the project author |
| Icons | Generated by `tools/make_icons.py` | © the project author |
| Audio | Browser speech synthesis at runtime | Provided by the device; no audio files are bundled |

**No dictionary data is downloaded or redistributed.** JMdict, KANJIDIC2 and KANJIDIC were
deliberately not used: they were unreachable from the build environment (see `PLAN.md`), so the
vocabulary and every reading are authored here and validated by `check_tap.mjs`. If that changes,
record the licence above before committing derived data.

**JLPT** does not publish official word lists. Level counts in `STUDY_PLAN.md` are community
approximations, and the app's checkpoints are practice instruments, not official papers.

**Textbooks.** The app follows Tobira's chapter order and topic sequence, which are facts. It does
not reproduce the book's readings, dialogues or exercises: every passage, question and model
answer here was written for this app. Vocabulary was curated against N3/N2 frequency for each
topic, not transcribed from the book's lists.

This project is not affiliated with Kurosio Publishers, the Japanese-Language Proficiency Test
administrators, or any exam board.

## Development notes

- Interface HTML is `lang="en"`; every piece of Japanese content carries `lang="ja"`.
- All state is in one object. Export it from Settings before switching origins —
  `localStorage` is per origin, so `http://127.0.0.1:8765` and a deployed site do not share
  progress.
- The service worker is skipped on `localhost`/`127.0.0.1` and when the URL contains `?nosw`,
  so development never fights the cache.
