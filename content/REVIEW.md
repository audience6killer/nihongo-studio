# Review buffer

Entries the agent is less than fully certain about, or decisions worth a second opinion. Nothing
here is known-bad; the validators pass. This is where human judgement adds what a validator
cannot. Clear a row by confirming it or correcting the source file and rebuilding.

## Chapters 2 and 3 — readings and glosses to spot-check

| Entry | Reading / gloss given | Question for the reviewer |
|---|---|---|
| 丁寧 | ていねい · "polite; careful" · `な-adj.` | Correct for both senses (丁寧な言葉 / 丁寧な仕事)? |
| 常体 / 敬体 | *not taught* | I teach です・ます / だ・である without the terms 敬体/常体. Enough, or add them? |
| 大事 | だいじ · "important; precious" · `な-adj.` | Fine for 「大事なのは」? |
| 場 | ば · "place; occasion" | Overlaps 場面 and 場所. Keep all three? |
| 使い分ける | つかいわける · "to use properly; to distinguish in use" | Gloss is clumsy. Better phrasing? |
| 好む | このむ · "to prefer; to like" · `v.t.` | Natural at N3? Or above level? |
| 人工知能 | じんこうちのう | Reading correct? Also AI is often エーアイ in speech. |
| 携帯 | けいたい · "mobile phone; portable" | The phone sense is dated (携帯電話 → スマホ). Keep? |
| 自動 | じどう · `n.` | It behaves as a prefix (自動ドア). Tag ok? |
| 安定 | あんてい · `な-adj.` | Used as noun and な-adj (安定な vs 安定した). Tag ok? |
| 不安 | ふあん · `な-adj.` "anxious; anxiety" | Noun + な-adj dual. Tag ok? |
| マンション | "apartment block; condominium" | The common-mistake drill depends on this gloss. Fine? |
| アルバイト | "part-time job (from German Arbeit)" | Etymology in the explanation is correct? |
| 外来語 vs カタカナ語 | Both used | The chapter title uses カタカナ語; the vocabulary word is 外来語. Deliberate (not all loanwords are katakana, not all katakana is foreign), but worth a second look. |

## Decisions worth confirming

1. **Alternate forms in `alt`.** Several chapter 1 vocabulary rows accept a conjugated form as a
   correct production answer — for example 位置する accepts 位置しています and 位置した. Chapters 2
   and 3 do **not** do this. Pick one policy and I will apply it everywhere.
2. **Katakana ↔ hiragana.** An all-katakana word accepts its hiragana rendering
   (コンピューター / こんぴゅーたー) because the phonemes are identical. Kanji words do **not** get this
   treatment; they need an explicit `alt`.
3. **Recognition alternates.** Every second `rec` review of the same card asks for the reading
   instead of the meaning. Both are recognition, and kanji→reading decays fastest. Documented in
   `STUDY_PLAN.md`; easy to disable if you would rather keep meaning-only.
4. **A new word is tested immediately** — card → recognition → production → listening in one
   group. That makes the first session heavier. Change if it feels like too much.
5. **Dictation tolerance.** One character of error per ten characters is forgiven
   (`max(1, floor(len / 10))`, Levenshtein). A substitution costs one edit, not two.
6. **Chapter 3 is large** (70 words against 45 and 54). It fits the technology topic, but the
   daily load means it will take five sessions to introduce. Split it if that feels long.

## Prose to read once

- `content/lesson-02.json` → `reading.text_l2`: 288 characters on speech levels. Check that the
  three questions really are main idea / detail / inference, and that question 3 is not a
  restatement of question 1.
- `content/lesson-03.json` → `reading.text_l2`: 242 characters on robots. The topic is
  well-worn; check it does not read like a textbook editorial.
- `lesson-02` grammar: the 終助詞 explanation covers よ・ね・な only. Part 2 (chapter 13) has to
  pick up かな・っけ・わ・ぞ — confirm that split is sensible.
- `lesson-03` grammar: the カタカナ explanation claims スマート is usually about slimness and
  テンション about mood. Both are correct as written, but say so if you would rather drop the
  contrasts.
- All three `writing.model_l2` answers: read for naturalness. The app only counts length,
  required words and sentences.
- `listening.dictation` in chapters 2 and 3: confirm each is unambiguous when heard. Chapter 3
  has 安定させる, which is a mouthful for TTS.

