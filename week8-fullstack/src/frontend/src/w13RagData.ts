// 由 scripts/export-w13-rag-data.mjs 从 week13-rag 的产物生成；不要手改，改产物后重跑脚本。
// 来源：corpus/rules-c0a4b85/manifest.json、evidence/serialization/{registry,evidence-context,criteria-report,frozen}-rules-c0a4b85.*、tests/*.py。
// 数值全部是脚本复算结果（chars 是字符数，不是 token 也不是 bytes）；脚本内的恒等式断言保证各分项相加闭合。

export const W13_RAG_DATA = {
  "snapshotId": "rules-c0a4b85",
  "corpusId": "rules",
  "sourceCommit": "c0a4b85c9065cbfb943584c914172d7819339791",
  "docs": [
    {
      "sourcePath": "AGENTS.md",
      "bytes": 16867,
      "chars": 7775,
      "lines": 262,
      "nonBlankLines": 179,
      "sha256Prefix": "19844cca"
    },
    {
      "sourcePath": "DAILY-LEARNING-REPORT-PROTOCOL.md",
      "bytes": 8666,
      "chars": 4398,
      "lines": 172,
      "nonBlankLines": 117,
      "sha256Prefix": "72bca419"
    },
    {
      "sourcePath": "DAILY-SPEAKING-PROTOCOL.md",
      "bytes": 2620,
      "chars": 1174,
      "lines": 70,
      "nonBlankLines": 48,
      "sha256Prefix": "f02d24e3"
    },
    {
      "sourcePath": "LEARNING-PROTOCOL.md",
      "bytes": 12324,
      "chars": 5551,
      "lines": 263,
      "nonBlankLines": 189,
      "sha256Prefix": "3bc252b8"
    },
    {
      "sourcePath": "SHOWCASE-DEPLOY-PROTOCOL.md",
      "bytes": 11659,
      "chars": 5566,
      "lines": 143,
      "nonBlankLines": 94,
      "sha256Prefix": "b93dd2f3"
    },
    {
      "sourcePath": "SHOWCASE-VISUAL-PROTOCOL.md",
      "bytes": 12669,
      "chars": 5343,
      "lines": 211,
      "nonBlankLines": 152,
      "sha256Prefix": "e6349727"
    },
    {
      "sourcePath": "TECHNICAL-WRITING-PROTOCOL.md",
      "bytes": 11438,
      "chars": 4547,
      "lines": 225,
      "nonBlankLines": 157,
      "sha256Prefix": "7671cd8e"
    }
  ],
  "corpus": {
    "files": 7,
    "bytes": 76243,
    "chars": 34354,
    "lines": 1346,
    "nonBlankLines": 936
  },
  "blocks": 572,
  "blockKinds": [
    {
      "kind": "list_item",
      "count": 349
    },
    {
      "kind": "paragraph",
      "count": 144
    },
    {
      "kind": "table_row",
      "count": 43
    },
    {
      "kind": "code",
      "count": 23
    },
    {
      "kind": "quote_para",
      "count": 10
    },
    {
      "kind": "quote_list",
      "count": 3
    }
  ],
  "blocksPerDoc": [
    {
      "sourcePath": "AGENTS.md",
      "blocks": 104
    },
    {
      "sourcePath": "DAILY-LEARNING-REPORT-PROTOCOL.md",
      "blocks": 71
    },
    {
      "sourcePath": "DAILY-SPEAKING-PROTOCOL.md",
      "blocks": 32
    },
    {
      "sourcePath": "LEARNING-PROTOCOL.md",
      "blocks": 100
    },
    {
      "sourcePath": "SHOWCASE-DEPLOY-PROTOCOL.md",
      "blocks": 78
    },
    {
      "sourcePath": "SHOWCASE-VISUAL-PROTOCOL.md",
      "blocks": 100
    },
    {
      "sourcePath": "TECHNICAL-WRITING-PROTOCOL.md",
      "blocks": 87
    }
  ],
  "contextRoles": {
    "heading": 1305,
    "table_header": 43
  },
  "headingDepth": [
    {
      "depth": 1,
      "count": 15
    },
    {
      "depth": 2,
      "count": 391
    },
    {
      "depth": 3,
      "count": 156
    },
    {
      "depth": 4,
      "count": 10
    }
  ],
  "chars": {
    "corpus": 34354,
    "core": 32171,
    "context": 20826,
    "modelContent": 52997,
    "tags": 35715,
    "separators": 1142,
    "evidenceContext": 89854,
    "nonCore": {
      "blank": {
        "lines": 381,
        "chars": 381
      },
      "heading": {
        "lines": 97,
        "chars": 1489
      },
      "thematicBreak": {
        "lines": 33,
        "chars": 132
      },
      "tableHeader": {
        "lines": 12,
        "chars": 181
      }
    }
  },
  "evidenceContextSha256": "8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b",
  "frozenSha256": "8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b",
  "frozenMatches": true,
  "twoPassIdentical": true,
  "audit": [
    {
      "sourcePath": "AGENTS.md",
      "lineCount": 262,
      "blocks": 104,
      "uncovered": 0,
      "duplicated": 0
    },
    {
      "sourcePath": "DAILY-LEARNING-REPORT-PROTOCOL.md",
      "lineCount": 172,
      "blocks": 71,
      "uncovered": 0,
      "duplicated": 0
    },
    {
      "sourcePath": "DAILY-SPEAKING-PROTOCOL.md",
      "lineCount": 70,
      "blocks": 32,
      "uncovered": 0,
      "duplicated": 0
    },
    {
      "sourcePath": "LEARNING-PROTOCOL.md",
      "lineCount": 263,
      "blocks": 100,
      "uncovered": 0,
      "duplicated": 0
    },
    {
      "sourcePath": "SHOWCASE-DEPLOY-PROTOCOL.md",
      "lineCount": 143,
      "blocks": 78,
      "uncovered": 0,
      "duplicated": 0
    },
    {
      "sourcePath": "SHOWCASE-VISUAL-PROTOCOL.md",
      "lineCount": 211,
      "blocks": 100,
      "uncovered": 0,
      "duplicated": 0
    },
    {
      "sourcePath": "TECHNICAL-WRITING-PROTOCOL.md",
      "lineCount": 225,
      "blocks": 87,
      "uncovered": 0,
      "duplicated": 0
    }
  ],
  "tests": [
    {
      "file": "test_fixture_serialization.py",
      "name": "test_fixture_a_model_content_and_hash"
    },
    {
      "file": "test_fixture_serialization.py",
      "name": "test_fixture_b2_model_content_and_serialized"
    },
    {
      "file": "test_fixture_serialization.py",
      "name": "test_fixture_a_serialized_block"
    },
    {
      "file": "test_fixture_serialization.py",
      "name": "test_fixture_two_block_evidence_context"
    },
    {
      "file": "test_fixture_serialization.py",
      "name": "test_fixture_c_order_heading_then_header_then_core"
    },
    {
      "file": "test_registry_real.py",
      "name": "test_real_corpus_build_has_no_uncovered_or_duplicated_lines"
    },
    {
      "file": "test_registry_real.py",
      "name": "test_real_corpus_two_pass_is_byte_identical"
    },
    {
      "file": "test_registry_real.py",
      "name": "test_every_entry_hash_recomputes_and_source_span_matches_source_id"
    },
    {
      "file": "test_registry_real.py",
      "name": "test_evidence_context_has_no_leading_trailing_blank_lines"
    }
  ],
  "sample": {
    "sourceId": "rules/SHOWCASE-VISUAL-PROTOCOL.md#L50-L50",
    "prevSourceId": "rules/SHOWCASE-VISUAL-PROTOCOL.md#L49-L49",
    "nextSourceId": "rules/SHOWCASE-VISUAL-PROTOCOL.md#L51-L51",
    "contextParts": [
      {
        "role": "heading",
        "span": "L1-L1",
        "text": "# 学习展板视觉设计与验收规范\n"
      },
      {
        "role": "heading",
        "span": "L41-L41",
        "text": "## 2. 任务开始前的设计契约\n"
      },
      {
        "role": "table_header",
        "span": "L46-L47",
        "text": "| 列 | 必须回答 | 止步条件 |\n|---|---|---|\n"
      }
    ],
    "core": "| ③ 对象与数据形状 | 比较对象、分类键、量、阶段或状态是什么 | 只有长句、没有可枚举结构，先重塑数据 |\n",
    "modelContent": "# 学习展板视觉设计与验收规范\n## 2. 任务开始前的设计契约\n| 列 | 必须回答 | 止步条件 |\n|---|---|---|\n| ③ 对象与数据形状 | 比较对象、分类键、量、阶段或状态是什么 | 只有长句、没有可枚举结构，先重塑数据 |\n",
    "contentSha256": "229d6f4555475894aa5422351ee53c6fe155690cb4a43fba88a12623aa27e25e",
    "serialized": "<source id=\"rules/SHOWCASE-VISUAL-PROTOCOL.md#L50-L50\">\n# 学习展板视觉设计与验收规范\n## 2. 任务开始前的设计契约\n| 列 | 必须回答 | 止步条件 |\n|---|---|---|\n| ③ 对象与数据形状 | 比较对象、分类键、量、阶段或状态是什么 | 只有长句、没有可枚举结构，先重塑数据 |\n</source>"
  }
} as const;
