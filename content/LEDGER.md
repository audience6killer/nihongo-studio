# Content ledger

One row per chapter. Updated after every batch, and after every validator run.

| Ch | Title (L2) | Title (L1) | Grammar point | Words | Reading chars | Sentences | Dictation | Drills | Writing | Translations | Tap | Validate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 日本の地理 | The Geography of Japan | あいづちとフィラー | 45 | 267 | 8 | 5 | 2 | 116 chars | sentence-level | ✓ | pass |
| 2 | 日本語のスピーチスタイル | Speech Styles in Japanese | スピーチレベルと終助詞① | 54 | 288 | 10 | 5 | 2 | 115 chars | sentence-level | ✓ | pass |
| 3 | 日本のテクノロジー | Technology in Japan | カタカナ語・外来語 | 70 | 242 | 9 | 5 | 2 | 107 chars | sentence-level | ✓ | pass |

Vocabulary-only deck, no lesson JSON:

| Unit | Title (L2) | Title (L1) | Words | Status |
|---|---|---|---|---|
| N2 · 1 (101) | N2 語彙 1 | JLPT N2 vocabulary, set 1 — abstract and workplace nouns | 46 | words only |

Latest run: **215 words across 4 units · 1,938 tokens in 132 texts, 100% resolved ·
633 dictionary entries · 3/3 lessons validated · QA 17/17.**

A vocabulary-only unit carries its titles as `# title_l2:` comments in its TSV header and renders
as a word list, because the words are studyable before the prose exists. N2 unit numbers start at
101 so that a recap chapter and an N2 deck can never collide.

## How to read this

- **Words** — rows in `content/vocab/recap-NN.tsv`, the course vocabulary.
- **Reading chars** — CJK + kana + ー + 々 + digits, excluding punctuation. Target 250–350.
- **Sentences** — `reading.sentences[]` pairs. Must concatenate to exactly `reading.text_l2`.
- **Translations** — `sentence-level` means every sentence carries its own L1 rendering. Any other
  value is a defect.
- **Tap** — 100% means `node tools/check_tap.mjs` resolved every token in every text against the
  dictionary. A `✓` here is a hard gate, not a spot check.
- **Validate** — `python tools/validate_content.py` plus `node tools/check_tap.mjs`, both green.

## Remaining chapters

Chapter titles and topic lists are facts taken from the publisher's public site
(<https://tobiraweb.9640.jp/introduction/book01/>). Every passage, question, drill, explanation
and model answer in `content/` was written for this app.

| Ch | Title (L2) | Planned grammar point | Status |
|---|---|---|---|
| 4 | 日本のスポーツ | 数字と助数詞 | next batch (also needs an N2 unit with reading + grammar) |
| 5 | 日本の食べ物 | が・けれども | next batch |
| 6 | 日本人と宗教 | もの・こと | not started |
| 7 | 日本のポップカルチャー | 連濁 | not started |
| 8 | 日本の伝統芸能 | ノ形容詞 | not started |
| 9 | 日本の教育 | という | not started |
| 10 | 日本の便利な店 | 自動詞・他動詞 (the book lists no language note for this chapter) | not started |
| 11 | 日本の歴史 | 多い + 副詞の名詞修飾 | not started |
| 12 | 日本の伝統工芸 | 大きい vs 大きな / 無助詞 | not started |
| 13 | 日本人と自然 | 終助詞② | not started |
| 14 | 日本の政治 | んです | not started |
| 15 | 世界と私の国の未来 | たとえ・メタファー | not started |

## Authoring cost, measured

Chapter 1 took one tap-coverage pass. Chapter 2 took two. Chapter 3 took three, and exposed a
tokenizer flaw: greedy longest-match picked the longer-but-wrong はい inside はいなくなる and
stranded く. `L.segment` now maximises dictionary coverage with dynamic programming, which fixed
that class of bug for every chapter at once. Expect roughly 30–45 new dictionary rows per chapter,
mostly inflected surfaces of words already taught.
