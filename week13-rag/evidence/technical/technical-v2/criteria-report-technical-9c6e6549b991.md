# W13 serialization implementation — evidence report (technical-9c6e6549b991)

> This report records executed facts only.  The wording of criteria #1-#7
> below is reconstructed from day3 §6.2.2 / §3.3 mappings and must be
> confirmed by the learner before the criteria are accepted (ownership per
> W13 plan §9).

## Run facts

- corpus_id: `technical`
- snapshot_id: `technical-9c6e6549b991`
- blocks: 1502
- Evidence Context chars: 369333
- Evidence Context sha256: `255d6705c702f7627abdcacb90f82bc6db4b11ab3e954c677a626dd5d2107192`
- two-pass byte-identical rerun: True

## Audit (per document)

| source_path | line_count | blocks | uncovered_candidates | duplicated_core_lines |
|---|---|---|---|---|
| AGENTS.md | 321 | 129 | 0 | 0 |
| TECHNICAL-WRITING-PROTOCOL.md | 238 | 94 | 0 | 0 |
| SHOWCASE-VISUAL-PROTOCOL.md | 211 | 100 | 0 | 0 |
| DAILY-SPEAKING-PROTOCOL.md | 70 | 32 | 0 | 0 |
| SHOWCASE-DEPLOY-PROTOCOL.md | 143 | 78 | 0 | 0 |
| LEARNING-PROTOCOL.md | 281 | 104 | 0 | 0 |
| DAILY-LEARNING-REPORT-PROTOCOL.md | 174 | 71 | 0 | 0 |
| week13-rag/notes/day1-corpus-freeze-and-baseline.md | 558 | 288 | 0 | 0 |
| week13-rag/notes/day4-full-context-baseline-and-bm25.md | 1043 | 427 | 0 | 0 |
| week13-rag/notes/day5-dense-langchain-wiring.md | 304 | 123 | 0 | 0 |
| week13-rag/notes/day6-modular-rag-plan.md | 127 | 56 | 0 | 0 |

## Block kinds

- code: 32
- list_item: 740
- paragraph: 344
- quote_list: 3
- quote_para: 27
- table_row: 356

## Wrapper precondition (per-entry check)

- entries checked: 1502 (build fails on violation)
- every `model_content` free of literal `<source` / `</source>`: enforced

