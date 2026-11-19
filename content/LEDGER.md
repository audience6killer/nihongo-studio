# Content ledger

One row per chapter, regenerated with `python tools/ledger_report.py` and gated with
`node tools/check_chapter.mjs NN`. Updated after every batch.

| Ch | Title (L2) | Title (L1) | Grammar point | Words | Reading chars | Sentences | Dictation | Drills | Writing | Translations | Tap | Validate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 日本の地理 | The Geography of Japan | あいづちとフィラー | 45 | 267 | 8 | 5 | 2 | 116 chars | sentence-level | ✓ | pass |
| 2 | 日本語のスピーチスタイル | Speech Styles in Japanese | スピーチレベルと終助詞① | 54 | 288 | 10 | 5 | 2 | 115 chars | sentence-level | ✓ | pass |
| 3 | 日本のテクノロジー | Technology in Japan | カタカナ語・外来語 | 70 | 242 | 9 | 5 | 2 | 107 chars | sentence-level | ✓ | pass |
| 4 | 日本のスポーツ | Sports in Japan | 数字と助数詞 | 54 | 254 | 10 | 5 | 2 | 128 chars | sentence-level | ✓ | pass |
| 5 | 日本の食べ物 | Japanese Food | 逆接の「が」と「けれども」 | 55 | 258 | 10 | 5 | 2 | 127 chars | sentence-level | ✓ | pass |
| 6 | 日本人と宗教 | The Japanese and Religion | もの・こと（名詞化） | 55 | 274 | 10 | 5 | 2 | 127 chars | sentence-level | ✓ | pass |
| 7 | 日本のポップカルチャー | Japanese Pop Culture | 連濁 | 52 | 309 | 10 | 5 | 2 | 128 chars | sentence-level | ✓ | pass |
| 8 | 日本の伝統芸能 | Japanese Traditional Performing Arts | ノ形容詞 — 「の」で名詞を修飾する語 | 44 | 276 | 10 | 5 | 2 | 111 chars | sentence-level | ✓ | pass |
| 9 | 日本の教育 | Education in Japan | という — 引用と名づけ | 46 | 306 | 10 | 5 | 2 | 117 chars | sentence-level | ✓ | pass |
| 10 | 日本の便利な店 | Japan's Convenience Stores | 自動詞と他動詞 | 53 | 263 | 10 | 5 | 2 | 182 chars | sentence-level | ✓ | pass |
| 11 | 日本の歴史 | The History of Japan | 「多い」と連体修飾 | 50 | 273 | 10 | 5 | 2 | 114 chars | sentence-level | ✓ | pass |
| 12 | 日本の伝統工芸 | Traditional Japanese Crafts | 大きな・小さな と、助詞を省く話し方 | 47 | 279 | 12 | 5 | 2 | 109 chars | sentence-level | ✓ | pass |
| 13 | 日本人と自然 | The Japanese and Nature | 終助詞② — かな・かしら・っけ・わ・の・さ | 48 | 282 | 10 | 5 | 2 | 117 chars | sentence-level | ✓ | pass |
| 14 | 日本の政治 | Japanese Politics | んです・のです（説明の形） | 51 | 303 | 10 | 5 | 2 | 117 chars | sentence-level | ✓ | pass |
| 15 | 世界と私の国の未来 | The Future of Your Country and the World | たとえ・メタファー | 49 | 265 | 10 | 5 | 2 | 113 chars | sentence-level | ✓ | pass |

**The recap is complete: 15 of 15 chapters.**

Vocabulary-only decks, with no lesson JSON yet:

| Unit | Title (L2) | Title (L1) | Words | Content |
|---|---|---|---|---|
| N2 · 1 (101) | N2 語彙 1 | Abstract and workplace nouns | 46 | words only |
| N2 · 2 (102) | N2 語彙 2 | Formal verbs | 43 | words only |
| N2 · 3 (103) | N2 語彙 3 | Connectives, adverbs and abstract nouns | 45 | words only |

## Latest run

```
907 words across 18 units  ·  10,602 tokens in 674 texts, 100% resolved
1,980 dictionary entries    ·  15/15 lessons validated  ·  59/59 smoke  ·  17/17 QA
```

## How to read this

- **Words** — rows in `content/vocab/recap-NN.tsv`.
- **Reading chars** — CJK + kana + ー + 々 + digits, excluding punctuation. Target 250–350.
- **Sentences** — `reading.sentences[]` pairs; they must concatenate to exactly `reading.text_l2`.
- **Translations** — `sentence-level` means every sentence carries its own L1 rendering. Any other
  value is a defect.
- **Tap** — `✓` means `check_chapter.mjs` resolved every token of every text in that chapter. A hard
  gate, not a spot check.
- **Validate** — schema, counts, option sets, answer indices and writing constraints.

## Authoring cost, measured

| Chapters | Tap passes needed | What was missing |
|---|---|---|
| 1 | 1 | nothing structural |
| 2 | 2 | inflected surfaces of taught verbs |
| 3 | 3 | exposed the greedy-tokenizer flaw — fixed with a DP segmenter |
| 4–15 | 3 in aggregate | parallel authors left little debt; the gaps were mostly auxiliaries |

Two lessons are recorded in `CONTENT_SPEC.md` §6:

1. The dictionary is surface-based, so **every inflected form needs its own row** (使います,
   変わってくる, 任せられる).
2. Maximum-coverage segmentation needs the **common auxiliaries** present (しまう, きた, ておく,
   てみる…) or it will attach them across a word boundary — 増えて + しまう is right, but without
   しまう as an entry the matcher prefers 増 + えて + てしまう because it covers more characters.

Before adding a chapter, run `node tools/used_terms.mjs`. Vocabulary terms are global keys, and
twelve chapters written in parallel collided 122 times before `tools/dedupe_vocab.py` settled them.
