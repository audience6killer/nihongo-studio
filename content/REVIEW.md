# Review buffer

Entries the agent is less than fully certain about, or decisions worth a second opinion. Nothing
here is known-bad: the validators pass and every chapter is 100% tappable. This is where human
judgement adds what a validator cannot. Clear a row by confirming it, or correct the source file
and rebuild.

## Chapters 4–15 — readings and glosses to spot-check

| Chapter | Entry | Question for the reviewer |
|---|---|---|
| 4 | 稽古 | Reading けいこ correct for martial-arts practice? |
| 4 | 数え方 in the grammar | Are the counter examples (一本 ippon, 三本 sanbon) all correct? |
| 5 | the が・けれども contrast | Is けれども really described as the more formal one throughout? |
| 6 | お盆 | Is it right to gloss this as the mid-August memorial season without mentioning regional variation? |
| 7 | 連濁 rules | ライマンの法則 is stated plainly — is the simplification honest enough? |
| 8 | 狂言 | Is きょうげん glossed as comic theatre in a way a learner will not misread? |
| 9 | the education reading | Bullying and school refusal are mentioned factually; is the tone right? |
| 10 | transitivity pairs | 開く/開ける, 閉まる/閉める, 落ちる/落とす, 消える/消す — all tagged with the correct transitivity? |
| 11 | 多い | The "container noun" contrast is the hardest explanation in the course; does it land? |
| 12 | 漉く | Reading すく, gloss "to make (paper)" — right register for a craft text? |
| 13 | 終助詞② | The gender-association caveat is deliberate; is it phrased carefully enough? |
| 14 | the politics reading | Deliberately institutional and non-partisan. Nothing reads as advocacy? |
| 15 | もったいない | Treated as a habit, not a moral instruction. Acceptable? |
| all | N2 decks | 134 formal-register words with no readings or grammar yet — is the gloss level right? |

## Decisions worth confirming

1. **Alternate forms in `alt`.** Chapter 1 vocabulary accepts conjugated forms as correct
   production answers (位置する also accepts 位置しています); chapters 2–15 do not. Pick one policy
   and I will apply it everywhere.
2. **Katakana ↔ hiragana.** An all-katakana word accepts its hiragana rendering; kanji words need an
   explicit `alt`.
3. **Recognition alternates.** Every second `rec` review asks for the reading instead of the
   meaning. Both are recognition, and kanji→reading decays fastest.
4. **A new word is tested immediately** — card → recognition → production → listening in one group.
   That makes the first session heavier.
5. **Dictation tolerance.** One character of error per ten is forgiven (Levenshtein, substitution
   costs one edit).
6. **Chapter sizes vary from 44 to 70 words.** Chapter 3 is the outlier. At 15 new words a day that
   is four to five sessions per chapter; say if you would rather they were evened out.
7. **Writing tasks require three or four of the chapter's own words.** Where a word moved to an
   earlier chapter during the collision pass, it was dropped from `required` rather than left
   claiming to be "this chapter's word". The model answers still use it.

## What the parallel authoring cost

Twelve chapters were written at once. The mechanical consequences are fixed, but they are worth
knowing about because they shape what a reviewer should look for:

- 122 vocabulary terms collided across chapters and were resolved by precedence (earliest chapter
  keeps the word). A chapter may therefore recycle a word rather than teach it — check that its
  reading still makes sense as a *recap* of earlier material rather than a first introduction.
- Four writing tasks asked for words that had moved; they were repaired mechanically. Read them for
  whether the replacement word still fits the prompt.
- Chapters 6 and 10 arrived without tap files and needed their dictionaries written from scratch.
  Their prose is unaudited beyond the automated checks.

## Prose to read once

Every `reading.text_l2` is original and 242–309 characters. If you read only five, read 4 (sports,
counters), 7 (manga, rendaku), 9 (education), 14 (politics) and 15 (the closing chapter) — those
carry the most editorial risk.

Also worth a look: `lesson-10.json`'s writing model is 182 characters, far longer than the 100 it
requires. Deliberate, but it makes the task look harder than it is.
