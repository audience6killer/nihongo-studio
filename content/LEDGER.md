# Content ledger

One row per chapter. Updated after every batch, and after every validator run.

| Ch | Title (L2) | Title (L1) | Grammar point | Words | Reading chars | Sentences | Dictation | Writing | Translations | Tap | Validate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 日本の地理 | The Geography of Japan | あいづちとフィラー | 45 | 267 | 8 | 5 | 116 chars | sentence-level | 308 entries / 643 tokens | pass |

## How to read this

- **Words** — rows in `content/vocab/recap-NN.tsv`, the course vocabulary.
- **Reading chars** — CJK + kana + ー + 々 + digits, excluding punctuation. Target 250–350.
- **Sentences** — `reading.sentences[]` pairs. Must concatenate to exactly `reading.text_l2`.
- **Translations** — `sentence-level` means every sentence carries its own L1 rendering. Any other
  value is a defect.
- **Tap** — total dictionary entries, then the number of passage/example/option tokens the
  coverage checker resolved. Coverage must be 100%.
- **Validate** — the result of `python tools/validate_content.py --lessons NN` plus
  `node tools/check_tap.mjs`.

## Remaining chapters (from the publisher's public chapter list)

| Ch | Title (L2) | Planned grammar point | Status |
|---|---|---|---|
| 2 | 日本語のスピーチスタイル | スピーチレベルと終助詞① | not started |
| 3 | 日本のテクノロジー | カタカナ語・外来語 | not started |
| 4 | 日本のスポーツ | 数字と助数詞 | not started |
| 5 | 日本の食べ物 | が・けれども | not started |
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

Chapter titles and topic lists are facts taken from the publisher's public site
(<https://tobiraweb.9640.jp/introduction/book01/>). Every passage, question, drill, explanation
and model answer in `content/` was written for this app.
