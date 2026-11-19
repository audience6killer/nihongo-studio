# Nihongo Studio — Build Plan

**Instance:** Japanese (L2) for an English-speaking learner (L1), anchored on **Tobira** as a recap and **JLPT N2** as the forward target.
**Status:** Phases 0–4 built and green, plus the first content batch (chapters 1–3 of 15). Phases 5 (rest of the content), 6 (N2 deck), 7 (deploy) and 8 (QA freeze) remain.

### Approved decisions (recorded)

| Question | Answer |
|---|---|
| Forward anchor | **JLPT N2** |
| Daily rhythm | **35 min × 5 weekdays**, 24-week target |
| Listening module | **Built in full**; learner installs a `ja-JP` voice. Setup card ships with the app (R3). |
| First release scope | **Phases 0–2** — engine + chapter 1 complete, then review before scaling content |

### Build progress

| Phase | State | Evidence |
|---|---|---|
| 0 — shell, PWA scaffolding, docs, dev server | done | serves at `127.0.0.1:8765`; icons generated with no image library |
| 1 — language adapter | done | `node tools/test_lang.mjs` → **55/55** |
| 2 — chapter 1 end to end | done | validate pass · tap 100% · `node tools/smoke.mjs` → **51/51** across 22 modules |
| 3 — engine completeness | done as part of Phase 2 | SRS, plan, stats, settings, export/import all covered by smoke |
| 4 — calibration, refresh deck, checkpoints | done | 9 new smoke checks; adaptive branch and JLPT-shaped exams verified |
| 5 — content scale | **3 of 15 chapters** | 169 words · 1,938 tokens in 132 texts, 100% tap coverage · 587 entries |
| 6 — N2 deck and scheduled checkpoints | not started | |
| 7 — PWA deploy and optional sync | not started | |
| 8 — QA matrix and freeze | not started | |

Bugs found and fixed by these tests, rather than by the user:

1. Router mapped `#/today` and `#/chapters` to a screen name that does not exist, so both fell back
   to Today — the Chapters list was unreachable.
2. New words were queued with their immediate checks built without options, which would have shown
   an unanswerable multiple-choice card and soft-locked the session.
3. `SRS.grade` treated an explicit `now = 0` as "no timestamp", making the scheduler untestable.
4. The catch-up bonus was capped at the daily setting, nullifying `+3` when behind.
5. Dictation tolerance counted a substitution as two edits, so one mistyped character failed.
6. **Greedy longest-match segmented はいなくなる as はい + なく, stranding a character.** Now
   maximum-coverage DP; this fixed a whole class of tap gaps across every chapter.
7. A finished session from a previous day blocked the next one on `#/session`.

**Not verified:** visual layout. No browser automation is possible in this environment — headless
Edge cannot start under the file sandbox (its mojo channel is denied). The screens are exercised
headlessly against a DOM shim, but the first real look at pixels is yours. Start at
`#/today`, then `#/chapters` → chapter 1 → all four section tabs, then a session.

---

## 1. What I verified before planning

| Fact | Finding | Why it matters |
|---|---|---|
| Workspace state | `C:\Users\ELAB-LAP\Documents\dsh_nihongo` is **empty** — no HSK5/`hanyu` repo to fork | This is a greenfield build, not a copy. `PORTING.md` §2.1 assumes a fork; deviations are in §9 below. |
| Tobira chapter list | Official 15-chapter list with Japanese + English titles and language notes, retrieved from [tobiraweb.9640.jp](https://tobiraweb.9640.jp/introduction/book01/) | Gives a real syllabus spine instead of invented topics. Chapter titles and topic lists are facts; the book's prose and exercises are not. |
| Toolchain | Node 22.23, npm 10.9.8, Python 3.13.7, git 2.51 — all present | Build tooling can be stdlib-only on both runtimes. |
| **Network for packages: blocked** | `pip download` times out; `npm view` fails `EPERM` on the npm cache dir; `curl` to `edrdg.org` and `raw.githubusercontent.com` returns `000` | **No JMdict/KANJIDIC2 download, no `pip install`, no `npm install`.** All tooling must be Node/Python **standard library only**, and Japanese lexicographic data must be authored in-repo. |
| **Japanese TTS: absent** | Installed voices are Spanish (Helena), English (Zira), Chinese (Huihui). **No `ja-JP` voice.** Edge is installed. | The `listen` skill is dead on this device as configured. This is a Phase-0 gate, not a footnote (`PORTING.md` trap 13). |

Both blocked-network facts are constraints I will design *around*, not blockers.

---

## 2. Instance brief (filled — section 1 of `PORTING.md`)

| Decision | Choice | Note |
|---|---|---|
| Target language (L2) | Japanese | |
| Learner language (L1) | English | Reuse the English shell; `en`-style learner fields stay English. |
| Interface language | English | No Spanish-style i18n pass needed (`PORTING.md` §10 does not apply). |
| Anchor — recap | **Tobira: Gateway to Advanced Japanese**, 15 chapters | Already completed by the learner. |
| Anchor — forward | **JLPT N2** *(proposed — see Q1)* | JLPT publishes no official word list; level counts used below are community approximations. |
| Level on entry | Post-Tobira ≈ solid N3, transitioning toward N2 | Assumption to confirm. |
| Lesson count | **15 recap units** + N2 decks in a later phase | Do not force 36. |
| Script | Kana + kanji, with per-passage **furigana toggle** | |
| Production input | Japanese IME, typed kana/kanji. Kana accepted when it equals the stored reading (`PORTING.md` §8.3). | |
| Writing unit | `chars` (CJK + kana); stage labelled **"output practice"** | JLPT has no writing section (§8.1, §4.7). |
| TTS locale | `ja-JP`, preference list Kyoko / Otoya / Nanami / Haruka / Ayumi / Google 日本語 / Microsoft Haruka | Presence on this device must be fixed first (§7 R3). |
| Storage key | `nihongo.v1` | |
| App identity | `window.NJ_APP = { id: "ja", l1: "en", l2: "ja" }` | Globals prefixed `NJ_` to stay clear of `HY_`. |
| Sync backend | **None in v1.** Local-only; Supabase deferred to Phase 7 | Local-first is the invariant; sync is optional (§4.10). |
| Deployment | Deferred to Phase 7 (Netlify + new Supabase project) | |
| Speaking | **Out of scope** | Invariant §4.9. |
| Handwriting | **Out of scope** | Invariant §2.5. |

---

## 3. What "a Tobira recap" means in this app

The failure mode after finishing a textbook is **passive decay**: you still recognise 地理 and 和紙, but you can't produce them, and んです / という / 無助詞 have gone fuzzy. Re-reading the book wastes a month. So the recap is a **reactivation pass, not a re-teach**.

Three mechanisms:

1. **Calibration pins the starting state (day 1, ~10 min, 24 items).**
   Sampled across all 15 chapters: 12 recognition, 6 production, 4 listening, 2 grammar-in-context. Output is a **per-chapter strength estimate**, which decides scheduling:
   - Passed confidently → card seeded at a long interval, `rec` marked done, only `prod` + `listen` scheduled.
   - Missed → goes to the **refresh deck** and is introduced in the first three weeks.
   This is `PORTING.md` §4.6's adaptive branch, with the prior-level pool being *Tobira's own deck* rather than HSK4.

2. **15 recap units, one per chapter, each ~35 minutes.** Content per unit:
   - **Vocabulary** ~40 items (kanji term · kana reading · English gloss · POS · chapter).
   - **Grammar** one point, taken from the book's actual language notes where they exist (§5 below).
   - **Reading** 250–350 characters of *original* prose on that chapter's topic, **sentence-paired** L1 translations from the start (`PORTING.md` §4.12 — this is the bug that bit the Chinese build), 3 questions (main idea / detail / inference), every token tappable.
   - **Listening** 5 dictation sentences drawn from the chapter's words.
   - **Writing** optional, 100+ chars, 3–5 required words, labelled output practice.

3. **Recap items carry a different first interval.** Because the learner has met the word before, a correct first review gives 3 d (`rec`) / 4 d (`prod`) instead of 1 d / 2 d. Documented tuning per §4.4; the SM-2 model itself is unchanged.

**Then the next phase.** The engine is built around **decks** (`recap`, `refresh`, `n2-*`) from day one, so the N2 phase is new data plus a new deck row, not a rewrite. That is the one architectural bet in this plan.

---

## 4. Plan math (honest numbers)

Per `PORTING.md` §5.4, compute before authoring.

```
capacity      = new/day × sessions/week            = 15 × 5 = 75 words/week
recap deck    = 15 chapters × 40 items             = 600 items  (reactivation, not new learning)
6-month new   = 75/week × 16 effective weeks       = ~1,200 new words
N2 gap        ≈ 6,000 − 3,700 (N3 cumulative)      = ~2,250 new words needed in total
```

**Consequence, stated plainly:** six months of 35-minute weekdays covers the recap plus roughly *half* of the N2 vocabulary gap. Year 1 reaches an "N2 vocabulary core", not a finished N2. The dashboard will say this rather than show a fake 100% (invariant §2.7 — "shows pace honestly").

Proposed 24-week shape:

| Weeks | Phase | Load |
|---|---|---|
| 1 | Calibration + onboarding | 24-item adaptive diagnostic |
| 1–6 | **Tobira recap**, 2–3 chapters/week | 600 recap items; no new N2 words yet |
| 5–24 | **N2 ramp**, new words 10→15/day | ~1,100–1,300 new words |
| 6, 11, 15 | Checkpoints, N3-shaped, 30 min | language knowledge / reading / listening |
| 18, 22, 24 | Checkpoints N2-shaped (45 min) + final mock | |

Daily SRS bounds kept from the Chinese instance, tuned once for IME typing (see §6.4).

---

## 5. The recap syllabus (from the official chapter list)

| Ch | Topic | Grammar point to author (anchor: book's own language note) |
|---|---|---|
| 1 | 日本の地理 | あいづちとフィラー |
| 2 | 日本語のスピーチスタイル | スピーチレベルと終助詞① |
| 3 | 日本のテクノロジー | カタカナ語・外来語 |
| 4 | 日本のスポーツ | 数字と助数詞 |
| 5 | 日本の食べ物 | が・けれども |
| 6 | 日本人と宗教 | もの・こと |
| 7 | 日本のポップカルチャー | 連濁 |
| 8 | 日本の伝統芸能 | ノ形容詞 |
| 9 | 日本の教育 | という |
| 10 | 日本の便利な店 | **book lists no note — I will author 自動詞・他動詞** |
| 11 | 日本の歴史 | 多い + 副詞の名詞修飾 |
| 12 | 日本の伝統工芸 | 大きい vs 大きな / 無助詞 |
| 13 | 日本人と自然 | 終助詞② |
| 14 | 日本の政治 | んです |
| 15 | 世界と私の国の未来 | たとえ・メタファー |

**Original-content rule.** Chapter *titles and topic lists* are facts from the publisher's public page. Every passage, question, drill, explanation, and model answer I write will be original prose. I will not reproduce the book's readings, dialogues, or exercises. The vocabulary is **curated by me** against N3/N2 frequency for each topic, not transcribed from the book's word lists — which also sidesteps the licensing question entirely.

---

## 6. Architecture

### 6.1 Shape

Static, local-first, no framework, no bundler, no server — the same contract as the Chinese instance:

```
index.html
  ├─ assets/js/data/config.js     (build-injected, empty by default)
  ├─ assets/js/data/vocab.js      window.NJ_VOCAB
  ├─ assets/js/data/lessons.js    window.NJ_LESSONS
  ├─ assets/js/data/tap.js        window.NJ_TAP
  ├─ assets/js/core/util.js       DOM, dates, diff, random
  ├─ assets/js/core/lang.js       ★ Japanese language adapter (new vs the Chinese build)
  ├─ assets/js/core/data.js       joins, examples, tokenization
  ├─ assets/js/core/storage.js    localStorage, export/import   KEY = "nihongo.v1"
  ├─ assets/js/core/srs.js        three-skill SM-2-style scheduler
  ├─ assets/js/core/plan.js       target-date plan, adaptive new-word load
  ├─ assets/js/core/session.js    queues, grading, dictation, writing, activity log
  ├─ assets/js/core/tts.js        ja-JP voice selection + graceful silent mode
  ├─ assets/js/core/sync.js       stub in v1
  ├─ assets/js/ui/*.js            dashboard, lessons, session, reading, writing, exam, stats, settings, onboarding, diagnostic
  └─ assets/js/app.js             boot, routes, shell
```

### 6.2 Schema decision — generic field names from day one

`PORTING.md` §5.3 recommends starting from the Chinese schema and renaming mechanically in a second pass. With no legacy data there is nothing to migrate, so I take the **target shape immediately**:

```json
{ "schema": 2, "l2": "ja", "l1": "en", "chapter": 1,
  "title": { "l2": "日本の地理", "l1": "The Geography of Japan" },
  "grammar": { "point_l2": "...", "point_l1": "...", "explain_l1": "...",
               "common_mistake_l1": "...",
               "examples": [{ "l2": "...", "reading": "...", "l1": "..." }],
               "drills":   [{ "q_l2": "...", "options_l2": ["..."], "answer": 0, "explain_l1": "..." }] },
  "reading": { "text_l2": "...", "sentences": [{ "l2": "...", "l1": "..." }],
               "questions": [{ "q_l2": "...", "options_l2": ["..."], "answer": 0, "explain_l1": "..." }] },
  "listening": { "dictation": [{ "l2": "...", "l1": "..." }] },
  "writing": { "prompt_l1": "...", "required": ["..."], "min_units": 100, "unit": "chars",
               "model_l2": "...", "tips_l1": "..." } }
```

Vocabulary rows: `term, reading, gloss_l1, pos, chapter, deck, level, alt[]`. `term` is the lookup key and may mix kanji, kana, or katakana.

### 6.3 `lang.js` — the Japanese adapter

This is the file the Chinese build did not have and §6 of `PORTING.md` says to add. Pure functions, no DOM, unit-tested with a Node stdlib harness:

| Function | Behaviour |
|---|---|
| `norm(s)` | NFKC, full-width ASCII → half-width, collapse whitespace, unify punctuation, trim. Never strips ー, ゛, ゜, or small kana. |
| `sameAnswer(input, expected, word)` | Normalised equality; else curated `alt[]`; else **kana reading accepted when the term contains kanji and the input equals the stored reading** (§8.3). Dakuten/handakuten differences are always rejected. |
| `countUnits(s, unit)` | `chars` = CJK + kana + ー; `words` = whitespace split. |
| `splitSentences(s)` | On 。！？ and closing quotes, keeping the terminator. |
| `tokens(passage)` | Longest-match over the tap dictionary, max 8 chars. |
| `furigana(term, reading)` | `<ruby>` markup for the reading toggle. |
| `romaji(kana)` | Optional search aid only. |

**IME handling.** Grade on explicit submit or Enter, never on `input`; guard with `compositionstart`/`compositionend` so intermediate composition text is never scored.

### 6.4 SRS tuning for Japanese

Unchanged model, documented numbers: `rec` 1 d, `prod` 2 d, `listen` 1 d first-correct; recap items start 3 d / 4 d / 3 d; ease 2.5, floor 1.3, lapses −0.2, wrong → 10 min, cap 730 d, mature ≥ 21 d. Review estimate **22 s** (vs 18 s for Chinese) because IME production is slower; review cap 45/day retained; adaptive new-word steps 15 / 8 / 4 / 0 at due > 45 / 70 / 100.

---

## 7. Risks and how the plan absorbs them

| # | Risk | Mitigation |
|---|---|---|
| **R1** | **No lexical data can be downloaded** (JMdict/KANJIDIC2 unreachable, PyPI blocked). | Vocabulary, readings, and glosses are authored in-repo as `content/vocab/*.tsv` — canonical, reviewable in a diff, validated by `check_vocab.py` (reading kana-only, gloss non-empty, no duplicate terms, chapter in 1–15). JMdict enrichment becomes an optional later upgrade if the network opens. **Cost: readings are my responsibility and must be human-spot-checked.** |
| **R2** | No package manager, so no SudachiPy/kuromoji tokenizer. | Longest-match segmentation over the curated tap dictionary + a small function-word table, with a **hard validator gate**: `check_tap.mjs` fails if any character run in any passage does not resolve to a token. Deterministic, dependency-free, and it cannot ship silently broken. |
| **R3** | **No `ja-JP` voice installed** → listening skill unusable. | Phase 0 gate. Two paths, both implemented: (a) detect voices and show a one-screen setup card (Windows: Settings → Time & Language → Language & region → add Japanese → Language features → Speech); (b) detect Edge, where cloud `ja-JP` natural voices are available. If neither is present the app enters **silent mode**: listening cards are deferred, not lost, and audio buttons explain why. Audio is generated by browser TTS only — no bundled files (invariant §2.10). |
| **R4** | Authoring volume: 15 chapters × (40 words + 300-char passage + 5 dictation + 3 questions + grammar + drills) is the bulk of the work. | Batches of 3 chapters, validator after each (`PORTING.md` §7 Phase 5). Vertical slice first — chapter 1 end-to-end before chapters 2–15 exist (Phase 2 below). |
| **R5** | My readings/glosses could contain errors a human would catch. | A `content/REVIEW.md` ledger marking every entry I am less than certain about, plus batch review checkpoints with you. Per §5.5, volume must not outrun review capacity. |
| **R6** | Copyright. | Chapter titles/topics are facts; all prose original; vocabulary curated rather than transcribed. Attribution and a "not affiliated with Kurosio Publishers or JLPT" note in `README.md`. |
| **R7** | Service-worker cache hides a deploy (§13 trap 2). | Content-hashed cache name; documented two-reload procedure. |

---

## 8. Build phases

Each phase has one gate. I do not start a phase before the previous gate passes.

### Phase 0 — Brief + skeleton + TTS reality check
`INSTANCE.md`, `README.md`, `CONTENT_SPEC.md`, `STUDY_PLAN.md`, `package.json` (scripts only, zero deps), `serve.py`, `index.html` shell, `manifest.webmanifest`, `sw.js`, `.gitignore`, `git init`.
**Gate:** serves at `127.0.0.1:8765`, shell renders, `nihongo.v1` created on first load, zero console errors, and a written verdict on the `ja-JP` voice situation (R3) including the exact fix for this machine.

### Phase 1 — Language adapter + tests
`core/lang.js` complete; `tools/test_lang.mjs` with Node stdlib assertions (target ≥ 60 cases: kana acceptance, dakuten rejection, full-width digits, sentence splitting, unit counting, token coverage).
**Gate:** harness green. This is the innermost, most testable layer — it gets tests first because every later bug traces back to it.

### Phase 2 — One vertical chapter, end-to-end
Chapter 1 only: `content/vocab/recap-01.tsv`, `content/lesson-01.json`, then `build_vocab.py`, `build_content.py`, `build_tapdata.py`, `validate_content.py`, `check_tap.mjs`. UI: shell → new-word card (kanji · reading · gloss · **sentence-level** context translation · audio) → `rec` / `prod` / `listen` reviews → dictation with diff → reading with tap-to-define + furigana toggle → optional writing → session summary.
**Gate:** the whole loop works at 1400 px and 390 px, state survives reload, answers grade correctly including kana-for-kanji, no console errors. **This is the review point before any content scaling.**

### Phase 3 — Engine completeness
`srs.js`, `plan.js`, `session.js` queues, dashboard (today's mix, pace vs target date), stats (streak, heatmap, accuracy by skill, forecast), settings (voice, rate, furigana, new/day, review cap, reduce motion), export/import (no tokens in export).
**Gate:** plan math matches `STUDY_PLAN.md` for a simulated 24-week profile; a wrong answer returns in 10 minutes; a correct answer grows the interval; export/import round-trips.

### Phase 4 — Calibration, refresh deck, checkpoints
24-item adaptive diagnostic with per-chapter strength; refresh deck mixed into weeks 1–3; five checkpoints + final mock in **JLPT shape** (文字・語彙 / 文法・読解 / 聴解 — no writing section).
**Gate:** a fresh profile can onboard → calibrate → study → sit a checkpoint with no Chinese/HSK copy anywhere (guaranteed by construction, asserted by a grep gate in CI script).

### Phase 5 — Content scale (the long one)
Chapters 2–15, batches of 3: vocabulary TSV → lesson JSON → build → validate → spot-check. Ledger in `content/LEDGER.md`.
**Gate:** 15/15 validate; `check_tap.mjs` 100% coverage; every passage sentence has its own L1 translation; random 5-chapter render check.

### Phase 6 — N2 phase scaffolding
`deck` abstraction surfaced in plan/UI; N2 vocabulary deck + 6–8 N2 lessons; phase transition and checkpoint rescaling.
**Gate:** switching decks works, recap cards keep maturing through the switch, no cross-deck leakage.

### Phase 7 — PWA + deploy + optional sync
`prepare_deploy.mjs`, Netlify config, `supabase/schema.sql` (separate project, `nihongo.v1`, `app: "ja"` in exports and rejecting foreign backups), `setup.html`.
**Gate:** offline launch, home-screen install, post-deploy update, and two instances provably cannot overwrite each other.

### Phase 8 — QA matrix + freeze
Full §12.4 matrix on desktop and iPhone-sized viewport, licence/credit audit, `v1.0` tag.
**Gate:** the §15 definition of done.

---

## 9. Deliberate deviations from `PORTING.md`

Each is recorded rather than quietly taken.

1. **Greenfield, not a fork** (§2.1 assumes a fork of the HSK5 repo). No source repo exists in this workspace. Consequence: I can adopt the target schema in §5.3 immediately at zero migration cost, and there is no `HY_` global or `hanyu.v1` key to collide with.
2. **No foreign lexical data** (§5.7 anticipates JMdict/KANJIDIC2). Network-blocked. Curated in-repo TSV instead; licence burden drops to zero, authoring burden rises.
3. **15 chapters, not 36** (§4.1 explicitly permits this).
4. **Checkpoints are JLPT-shaped with no writing section**, and the writing stage is labelled output practice (§4.7 and §8.1 both require this).
5. **Sync deferred past v1.** The invariant is local-first with *optional* sync; shipping v1 without it complies.

---

## 10. Defaults I will assume unless you say otherwise

- 35 minutes × 5 weekdays, target date 24 weeks out.
- Writing stage present but optional and clearly labelled output practice.
- Furigana toggle available on every passage and example, **default off** (you have finished Tobira; full furigana by default would under-train kanji).
- English UI, `ja-JP` TTS, no speaking module, no handwriting.
- Local-only storage in v1; Supabase only if you later want the phone to share progress.
- Name "Nihongo Studio" is a placeholder — say the word and I'll rename before Phase 0.

---

## 11. What I need from you

Four decisions, then permission to start. Everything else above I will simply proceed with.

1. **Forward anchor** — is N2 the right "next phase", or do you want N3 consolidation, or no exam at all?
2. **Daily commitment** — 35 min × 5 weekdays, or a different rhythm?
3. **TTS path** — you have no Japanese voice installed today (R3). Install a Japanese speech package / use Edge by default / build silent-mode-first? The plan covers all three; this decides the default.
4. **First release scope** — recommend: Phase 0–2 (engine + chapter 1 complete, fully usable), then you try it and we scale content. Alternative: build the whole engine and all 15 chapters before you see anything running.

Once you approve, Phase 0 starts and I report at each gate rather than at the end.
