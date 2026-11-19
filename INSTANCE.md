# Instance brief — Japanese (L2) for English speakers (L1)

Filled version of `PORTING.md` §1. Decisions here are binding for this repository; changes are
recorded with a date and a reason.

## Identity

| Field | Value |
|---|---|
| App name | Nihongo Studio |
| Repository | `dsh_nihongo` |
| App id | `ja` (`window.NJ_APP = { id: "ja", l1: "en", l2: "ja" }`) |
| Storage key | `nihongo.v1` |
| Global prefix | `NJ_` (`NJ_VOCAB`, `NJ_LESSONS`, `NJ_TAP`, `NJ_CONFIG`) |
| Sync | **Optional Supabase mirror**, one project per instance. Local-first: the browser holds the source of truth, the cloud a sanitised snapshot. |
| Deployment | `npm run build` → `deploy/`, Netlify-ready. See `README.md`. |

## Learning design

| Decision | Value | Rationale |
|---|---|---|
| Target language (L2) | Japanese | |
| Learner language (L1) | English | All glosses, explanations, translations, prompts, errors in English. |
| Interface language | English | No i18n layer; the shell is written in English directly. |
| Recap anchor | Tobira: Gateway to Advanced Japanese, **15 chapters** | Completed by the learner; used as the reactivation syllabus. |
| Forward anchor | **JLPT N2** | Approved. JLPT publishes no official word list; level counts are community approximations. |
| Entry level | Post-Tobira ≈ solid N3 | Assumption; calibration measures it rather than asserting it. |
| Units | 15 recap units (1 per chapter) + N2 decks later | Not forced to 36. |
| Daily rhythm | **35 min × 5 weekdays**, 24-week target | Approved. |
| New words/day | 15, adaptive down to 8 / 4 / 0 | PORTING.md §4.5. |
| Review cap | 45 cards/day | Unchanged from the Chinese instance. |
| Review time estimate | **22 s** (Chinese instance: 18 s) | IME production is slower than pinyin typing. |
| Script policy | Kana + kanji. Kana accepted for production when it equals the stored reading. | PORTING.md §8.3 recommended policy. |
| Furigana | Toggle on every passage and example, **default off** | The learner has finished Tobira; full furigana would under-train kanji. |
| Writing | Optional, `unit: "chars"` (CJK + kana), labelled **output practice** | JLPT has no writing section. |
| Speaking | Out of scope | Invariant. |
| Handwriting | Out of scope | Invariant. |

## Technical

| Decision | Value |
|---|---|
| Stack | Plain HTML, CSS, classic JS. No framework, no bundler, no TypeScript. |
| Build tooling | Python 3.13 stdlib and Node 22 stdlib **only** — no installable packages (see PLAN.md R1/R2). |
| Generated data | `assets/js/data/{vocab,lessons,tap}.js`, committed. |
| Tokenization | Longest-match over a curated tap dictionary, precomputed at build time. |
| TTS | Browser `speechSynthesis`, `ja-JP`, preference list configured in `core/tts.js`. |
| Offline | Service worker; skipped on `localhost` and with `?nosw`. |

## Deviations from PORTING.md

1. **Greenfield, not a fork** (§2.1). No HSK repo exists here. The §5.3 target schema is adopted
   immediately instead of in a second rename pass.
2. **No downloaded lexical data** (§5.7). JMdict/KANJIDIC2 are unreachable from this environment;
   vocabulary is authored in-repo. Licence burden is zero, authoring burden is on us.
3. **15 units, not 36** (§4.1 permits this).
4. **Checkpoints are JLPT-shaped with no writing section** (§4.7, §8.1).
5. **Sync is optional and off by default** (§2.8). It ships, but the app is complete and correct
   without a project: no account, no network call, nothing to configure.

## Open items

- N2 deck size and checkpoint rescaling are set in Phase 6, not now.
- Any vocabulary entry flagged in `content/REVIEW.md` still needs a human read.
