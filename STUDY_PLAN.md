# Study plan — Tobira recap, then N2

The learning rationale behind the app's defaults. Numbers live in `assets/js/core/plan.js` and
`assets/js/core/srs.js`; this file explains why they are what they are.

## The situation

The learner finished _Tobira: Gateway to Advanced Japanese_. That is roughly a solid N3 — comfortable
with intermediate reading, but with three predictable gaps:

1. **Production lag.** Recognition outran production. Words read fine and cannot be typed.
2. **Grammar fog.** んです, という, 無助詞, もの/こと, 〜一方(で) still feel like separate rules
   instead of one system.
3. **Listening decay.** Nothing decays faster than listening that was never drilled.

So the app does **not** start a new course. It reactivates Tobira once, at speed, and only then
builds forward.

## Phase A — Tobira recap (weeks 1–6)

15 chapters, 2–3 per week. One 35-minute session per weekday.

Each chapter contributes:

- ~40 vocabulary items, each with three independently scheduled skills
- one grammar point from the book's own language notes, recapped rather than introduced
- one original 250–350 character reading, sentence-paired, fully tappable
- five dictation sentences
- one optional writing task

**Why a recap is not a re-teach.** The learner has seen all of this. What the recap must do is
*surface what decayed* and schedule it, not march through the book again. That is why calibration
comes first and why recap items get compressed first intervals.

### Calibration (day 1, ~10 minutes, 24 items)

Sampled across all 15 chapters: 12 recognition, 6 production, 4 listening, 2 grammar-in-context.

Adaptive branch, kept from PORTING.md §4.6:

- Stage A: 14 items drawn from the recap deck across chapters.
- If stage A accuracy ≥ 55%, stage B adds 5 later-chapter items plus the grammar items (23 total).
- Otherwise stage B adds 5 earlier-chapter items and 2 grammar items (21 total).

**Built:** stage A is 10 meaning items and 4 reading items; stage B adds 5 words from whichever
end of the course stage A points at, plus 2 grammar-in-context items drawn from lesson drills.
Stage B shortens itself gracefully when the chapters behind it do not exist yet — it never
invents material.

Output is a **per-chapter strength estimate**, which sets the initial card state:

| Calibration result | Card state |
|---|---|
| Recognised confidently | `rec` seeded at 21 days; `prod` and `listen` due immediately |
| Missed | Refresh deck, all three cards due now |

A word counts as "already solid" only if **every** item that tested it was right. A recognised
meaning with a failed reading does not count, because kanji→reading is the fragile half.

Calibration is optional and skippable; skipping simply starts everything at the front of the deck.
Re-running it from Settings replaces the estimate but leaves existing cards alone.

## Phase B — N2 ramp (weeks 5–24)

New words enter from the N2 deck while recap cards keep maturing.

### The arithmetic, stated honestly

```
daily capacity        = 15 new/day × 5 days/week = 75 new words/week
weeks available       = 20 (weeks 5–24)
new words in 6 months = 75 × 20 = 1,500 max, ~1,200 realistic after review-debt cuts
N3 → N2 vocabulary gap ≈ 6,000 − 3,700 = ~2,300 words (community approximations)
```

So **six months reaches an N2 vocabulary core, not a finished N2**. The dashboard says this.
Year one target: recap solid, ~1,200 new N2 words, grammar through the N2 core list. A second
six-month block completes the deck. Pretending otherwise would produce a plan the learner
cannot keep.

### Adaptive daily load

| Due reviews that day | New words allowed |
|---|---|
| ≤ 45 | 15 |
| > 45 | 8 |
| > 70 | 4 |
| > 100 | 0 |
| Behind plan **and** due < 70 | +3 |

Review debt is the main failure mode of self-study. Cutting new words when reviews pile up
protects the habit and the retention rate (PORTING.md §4.5).

### Session budget

Session length is derived from the target minutes. Item cost estimates:

| Item | Seconds |
|---|---|
| Review, recognition | 12 |
| Review, production (IME typing) | 30 |
| Review, listening | 16 |
| New-word card | 40 |
| Dictation sentence | 45 |

Reviews are cheaper than production; production is the expensive one. The session is filled from
the due queue first, then new words, then the current chapter's dictation sentences.

## Skills

Three per word, scheduled independently (PORTING.md §4.2):

- **Recognition (`rec`)** — see the term, identify the meaning; every second review of the same
  card instead asks for the reading. Both are recognition, and kanji→reading is the skill that
  decays fastest in Japanese.
- **Production (`prod`)** — see the English gloss, type the Japanese. Kanji or kana accepted when
  the kana equals the stored reading. This is the skill the recap exists for.
- **Listening (`listen`)** — hear it, identify the meaning. Deferred rather than lost when no
  `ja-JP` voice exists.

Separate scheduling prevents one strong skill from hiding two weak ones.

## Scheduling model

SM-2-style, binary grading, no self-rating (PORTING.md §4.3–4.4).

| Parameter | Value |
|---|---|
| Skills | `rec`, `prod`, `listen` |
| First correct interval | `rec` 1 d · `prod` 2 d · `listen` 1 d |
| First correct interval, recap items | `rec` 3 d · `prod` 4 d · `listen` 3 d |
| Later correct | `interval × ease` |
| Ease | starts 2.5, floor 1.3, −0.2 per lapse |
| Wrong | 10 minutes, lapse counted |
| Interval cap | 730 days |
| Mature | interval ≥ 21 days |

Recap items skip the 1-day step because the learner has met the word before; the gap between
"recognised" and "produced" is what the recap is closing.

## Checkpoints

Checkpoints sample the same skills at exam section boundaries, in **JLPT shape**: 文字・語彙,
文法・読解, 聴解.

| When | Length | Shape |
|---|---|---|
| After recap chapter 5 | 30 min | N3-level sampling |
| After recap chapter 10 | 30 min | N3-level sampling |
| After recap chapter 15 | 35 min | N3-level sampling |
| Week 18 | 45 min | N2-level sampling |
| Week 22 | 45 min | N2-level sampling |
| Week 24 | 60 min | Final mock |

**Built so far:** the *practice* checkpoint. It is offered as soon as 12 words have actually been
met, is built from that learner's own studied vocabulary, and runs for about 70 seconds per item.
That keeps it honest before the full course exists — it can only test what has been taught.

The **scheduled** checkpoints above (fixed at chapter boundaries and N2 weeks) arrive in Phase 6,
when chapters 2–15 and the N2 deck exist and the timer can mean something. Until then, treat a
practice checkpoint as a self-check, not a milestone.

There is **no writing section**: JLPT does not test writing. The writing stage in a recap unit is
labelled output practice and is scored by a transparent heuristic (length, required-word coverage,
sentence count) that is not an official score and not a teacher.

## What the app deliberately does not do

- No speaking practice. No pronunciation scoring, no recording.
- No handwriting.
- No self-rated Hard/Easy buttons. Answers are graded objectively.
- No FSRS, no adaptive ease beyond SM-2. Predictable beats clever for a six-month plan.
- No analytics, no accounts, no network calls in v1.
