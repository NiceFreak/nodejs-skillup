# W13 serialization implementation — evidence report (rules-c0a4b85)

> This report records executed facts only.  The wording of criteria #1-#7
> below is reconstructed from day3 §6.2.2 / §3.3 mappings and must be
> confirmed by the learner before the criteria are accepted (ownership per
> W13 plan §9).

## Run facts

- corpus_id: `rules`
- snapshot_id: `rules-c0a4b85`
- blocks: 572
- Evidence Context chars: 89854
- Evidence Context sha256: `8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b`
- two-pass byte-identical rerun: True

## Audit (per document)

| source_path | line_count | blocks | uncovered_candidates | duplicated_core_lines |
|---|---|---|---|---|
| AGENTS.md | 262 | 104 | 0 | 0 |
| DAILY-LEARNING-REPORT-PROTOCOL.md | 172 | 71 | 0 | 0 |
| DAILY-SPEAKING-PROTOCOL.md | 70 | 32 | 0 | 0 |
| LEARNING-PROTOCOL.md | 263 | 100 | 0 | 0 |
| SHOWCASE-DEPLOY-PROTOCOL.md | 143 | 78 | 0 | 0 |
| SHOWCASE-VISUAL-PROTOCOL.md | 211 | 100 | 0 | 0 |
| TECHNICAL-WRITING-PROTOCOL.md | 225 | 87 | 0 | 0 |

## Block kinds

- code: 23
- list_item: 349
- paragraph: 144
- quote_list: 3
- quote_para: 10
- table_row: 43

## Wrapper precondition (per-entry check)

- entries checked: 572 (build fails on violation)
- every `model_content` free of literal `<source` / `</source>`: enforced

