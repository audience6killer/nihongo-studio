# Review buffer

Entries the agent is less than fully certain about, or decisions worth a second opinion. Nothing
here is known-bad; the validators pass. This is where human judgement adds what a validator
cannot. Clear a row by confirming it or correcting the source file and rebuilding.

## Readings and glosses to spot-check (chapter 1)

| Entry | Reading / gloss given | Question for the reviewer |
|---|---|---|
| 恵まれる | めぐまれる · "to be blessed with; to be favoured with" · `v.i.` | Marked intransitive. Correct? |
| 富む | とむ · "to be rich in; to abound in" · `v.i.` | Natural gloss for N2? Alternative: "to be abundant in". |
| 占める | しめる · "to account for; to occupy" · `v.t.` | Both senses needed, or is "account for" enough? |
| 位置する | いちする · "to be located; to be situated" · `v.suru` | Usually used in the 〜ている form; gloss reads oddly without it. |
| 名物 | めいぶつ · "local specialty; famous product" | Spelling of "specialty" — US vs UK preference? |
| 独特 | どくとく · "unique; distinctive" · `な-adj.` | Correctly tagged な-adjective (独特な)? |
| 自然 | しぜん · "nature; natural" · tagged `n.` in `tap-extra.tsv` | One tag for a noun/adverb/な-adj triple. Acceptable for a tap popover? |
| 約 | やく · "approximately" · tagged `adv.` | It is a prefix (約三十分). Tag is approximate. |
| 七割 | ななわり · "seventy percent" | ななわり vs しちわり — which is the common reading here? |
| 一億人 | いちおくにん · "one hundred million people" | Kept as one number+counter token so furigana aligns. Fine? |
| あいづち | あいづち · "backchannel; conversational response" | Kana only (no 相槌). Matches textbook practice? |
| 目上 | めうえ · "person of higher status" | Fine as a tap entry for 目上の人? |

## Decisions worth confirming

1. **Alternate forms in `alt`.** Several vocabulary rows accept a conjugated form as a correct
   production answer — for example 位置する accepts 位置しています and 位置した. This is forgiving
   without accepting a different word. Say the word and I will strip `alt` from every verb so only
   the dictionary form passes.
2. **Katakana ↔ hiragana.** An all-katakana word accepts its hiragana rendering
   (コンピューター / こんぴゅーたー) because the phonemes are identical. Kanji words do **not** get this
   treatment; they need an explicit `alt`.
3. **Recognition alternates.** Every second `rec` review of the same card asks for the reading
   instead of the meaning. Both are recognition, and kanji→reading decays fastest. Documented in
   `STUDY_PLAN.md`; easy to disable if you would rather keep meaning-only.
4. **Production is not tested on the very first day of a new word** — it is, actually: a new word
   gets card → recognition → production → listening in one group. That makes the first session
   heavier. Change if it feels like too much.
5. **Dictation tolerance.** One character of error per ten characters is forgiven
   (`max(1, floor(len / 10))`, Levenshtein). A substitution costs one edit, not two.

## Prose to read once

- `content/lesson-01.json` → `reading.text_l2`: 267 characters, original. Check naturalness and
  that the 8 English sentences really are equivalents.
- `reading.questions`: check that question 3 is genuinely an inference question and not a detail
  question in disguise.
- `writing.model_l2`: it hits 116 characters and uses all four required words. Read it for
  naturalness — the app only counts length, required words and sentences.
- `grammar.explain_l1`: written for someone who has already met あいづち. Too basic, or too thin?
- `listening.dictation`: confirm all five are unambiguous when heard, with no homophone traps.
