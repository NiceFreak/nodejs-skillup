// 由 scripts/export-w13-rag-data.mjs 从 week13-rag 的产物生成；不要手改，改产物后重跑脚本。
// 来源：corpus/rules-c0a4b85/manifest.json、evidence/serialization/{registry,evidence-context,criteria-report,frozen}-rules-c0a4b85.*、tests/*.py。
// 数值全部是脚本复算结果（chars 是字符数，不是 token 也不是 bytes）；脚本内的恒等式断言保证各分项相加闭合。

// 不加 as const：这是每次重跑覆盖的构建产物，字面量类型会让消费端与某一次的具体取值耦合
// （TS 会推出「标题栈长度只可能是 1 或 2」这类结论，语料一变就编译不过）。
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
      "sha256Prefix": "19844cca",
      "gitBlobPrefix": "b1efa197",
      "checks": {
        "bytes": true,
        "sha256": true,
        "gitBlob": true
      }
    },
    {
      "sourcePath": "DAILY-LEARNING-REPORT-PROTOCOL.md",
      "bytes": 8666,
      "chars": 4398,
      "lines": 172,
      "nonBlankLines": 117,
      "sha256Prefix": "72bca419",
      "gitBlobPrefix": "89654587",
      "checks": {
        "bytes": true,
        "sha256": true,
        "gitBlob": true
      }
    },
    {
      "sourcePath": "DAILY-SPEAKING-PROTOCOL.md",
      "bytes": 2620,
      "chars": 1174,
      "lines": 70,
      "nonBlankLines": 48,
      "sha256Prefix": "f02d24e3",
      "gitBlobPrefix": "8dc49f1b",
      "checks": {
        "bytes": true,
        "sha256": true,
        "gitBlob": true
      }
    },
    {
      "sourcePath": "LEARNING-PROTOCOL.md",
      "bytes": 12324,
      "chars": 5551,
      "lines": 263,
      "nonBlankLines": 189,
      "sha256Prefix": "3bc252b8",
      "gitBlobPrefix": "c6823a97",
      "checks": {
        "bytes": true,
        "sha256": true,
        "gitBlob": true
      }
    },
    {
      "sourcePath": "SHOWCASE-DEPLOY-PROTOCOL.md",
      "bytes": 11659,
      "chars": 5566,
      "lines": 143,
      "nonBlankLines": 94,
      "sha256Prefix": "b93dd2f3",
      "gitBlobPrefix": "6bbdfdeb",
      "checks": {
        "bytes": true,
        "sha256": true,
        "gitBlob": true
      }
    },
    {
      "sourcePath": "SHOWCASE-VISUAL-PROTOCOL.md",
      "bytes": 12669,
      "chars": 5343,
      "lines": 211,
      "nonBlankLines": 152,
      "sha256Prefix": "e6349727",
      "gitBlobPrefix": "e4c89100",
      "checks": {
        "bytes": true,
        "sha256": true,
        "gitBlob": true
      }
    },
    {
      "sourcePath": "TECHNICAL-WRITING-PROTOCOL.md",
      "bytes": 11438,
      "chars": 4547,
      "lines": 225,
      "nonBlankLines": 157,
      "sha256Prefix": "7671cd8e",
      "gitBlobPrefix": "fd08fcb2",
      "checks": {
        "bytes": true,
        "sha256": true,
        "gitBlob": true
      }
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
  "integrity": {
    "checkedFiles": 7,
    "allMatch": true,
    "fields": [
      "bytes",
      "sha256",
      "gitBlob"
    ],
    "manifestSha256": "d141cfae98088b097719b75dd9a6b3ae086265ab42111aaa25f7ccc848bc8805"
  },
  "tokens": {
    "total": 18697,
    "concatenatedTotal": 18697,
    "classification": "estimate",
    "byDoc": [
      {
        "sourcePath": "AGENTS.md",
        "bytes": 16867,
        "chars": 7775,
        "estimatedTokens": 4174
      },
      {
        "sourcePath": "DAILY-LEARNING-REPORT-PROTOCOL.md",
        "bytes": 8666,
        "chars": 4398,
        "estimatedTokens": 2032
      },
      {
        "sourcePath": "DAILY-SPEAKING-PROTOCOL.md",
        "bytes": 2620,
        "chars": 1174,
        "estimatedTokens": 649
      },
      {
        "sourcePath": "LEARNING-PROTOCOL.md",
        "bytes": 12324,
        "chars": 5551,
        "estimatedTokens": 3076
      },
      {
        "sourcePath": "SHOWCASE-DEPLOY-PROTOCOL.md",
        "bytes": 11659,
        "chars": 5566,
        "estimatedTokens": 2994
      },
      {
        "sourcePath": "SHOWCASE-VISUAL-PROTOCOL.md",
        "bytes": 12669,
        "chars": 5343,
        "estimatedTokens": 3086
      },
      {
        "sourcePath": "TECHNICAL-WRITING-PROTOCOL.md",
        "bytes": 11438,
        "chars": 4547,
        "estimatedTokens": 2686
      }
    ],
    "accepted": {
      "transformers": "4.57.6",
      "tokenizers": "0.22.2",
      "tokenizerClass": "LlamaTokenizerFast",
      "roundTripsPassed": 7,
      "roundTripsTotal": 7
    },
    "rejected": {
      "transformers": "5.16.1",
      "tokenizers": "0.23.2",
      "estimatedTotal": 3800,
      "reason": "AutoTokenizer dropped Chinese text and spaces; encode/decode round trips failed."
    }
  },
  "pipeline": {
    "sourcePath": "AGENTS.md",
    "docLines": 262,
    "rows": [
      {
        "no": 1,
        "text": "# AGENTS.md",
        "role": "heading"
      },
      {
        "gap": 26
      },
      {
        "no": 28,
        "text": "## 2. 黑白名单",
        "role": "heading"
      },
      {
        "gap": 10
      },
      {
        "no": 39,
        "text": "### 白名单：可由 AI 直接实现",
        "role": "heading"
      },
      {
        "gap": 1
      },
      {
        "no": 41,
        "text": "- Docker / docker-compose、`.env.example`、`.gitignore`",
        "role": "core"
      }
    ],
    "coreLine": 41,
    "sourceId": "rules/AGENTS.md#L41-L41",
    "contextRoles": [
      {
        "role": "heading",
        "line": 1
      },
      {
        "role": "heading",
        "line": 28
      },
      {
        "role": "heading",
        "line": 39
      }
    ],
    "modelContent": "# AGENTS.md\n## 2. 黑白名单\n### 白名单：可由 AI 直接实现\n- Docker / docker-compose、`.env.example`、`.gitignore`\n",
    "serialized": "<source id=\"rules/AGENTS.md#L41-L41\">\n# AGENTS.md\n## 2. 黑白名单\n### 白名单：可由 AI 直接实现\n- Docker / docker-compose、`.env.example`、`.gitignore`\n</source>",
    "blockIndex": 13,
    "blockTotal": 572,
    "contextChars": 89854
  },
  "citationSample": {
    "sourceId": "rules/AGENTS.md#L41-L41",
    "modelContent": "# AGENTS.md\n## 2. 黑白名单\n### 白名单：可由 AI 直接实现\n- Docker / docker-compose、`.env.example`、`.gitignore`\n",
    "contentSha256": "b4e772b83eaf9a534727cbbb3b646be853345806412618f751d96b9d4ce2e3a7",
    "inEvidenceContext": true
  },
  "scan": {
    "sourcePath": "LEARNING-PROTOCOL.md",
    "from": 1,
    "to": 16,
    "lines": [
      {
        "no": 1,
        "text": "# 学习状态与 AI 协作规范",
        "kind": "heading",
        "headingLevel": 1,
        "headingStack": [
          1
        ],
        "tableHeader": null,
        "emitsBlock": null
      },
      {
        "no": 2,
        "text": "",
        "kind": "blank",
        "headingLevel": null,
        "headingStack": [
          1
        ],
        "tableHeader": null,
        "emitsBlock": null
      },
      {
        "no": 3,
        "text": "本文件定义如何在每天开始、结束以及新开 AI 对话时恢复学习上下文。目标是让进度由仓库中的事实驱动，不依赖某一段聊天记录是否仍在上下文中。",
        "kind": "core",
        "headingLevel": null,
        "headingStack": [
          1
        ],
        "tableHeader": null,
        "emitsBlock": "rules/LEARNING-PROTOCOL.md#L3-L3"
      },
      {
        "no": 4,
        "text": "",
        "kind": "blank",
        "headingLevel": null,
        "headingStack": [
          1
        ],
        "tableHeader": null,
        "emitsBlock": null
      },
      {
        "no": 5,
        "text": "本规范、状态文件、周计划、每日笔记和 AI 辅助记录统一使用中文书写。代码标识符、命令、协议名和无法自然翻译的技术术语可以保留英文。",
        "kind": "core",
        "headingLevel": null,
        "headingStack": [
          1
        ],
        "tableHeader": null,
        "emitsBlock": "rules/LEARNING-PROTOCOL.md#L5-L5"
      },
      {
        "no": 6,
        "text": "",
        "kind": "blank",
        "headingLevel": null,
        "headingStack": [
          1
        ],
        "tableHeader": null,
        "emitsBlock": null
      },
      {
        "no": 7,
        "text": "---",
        "kind": "thematic-break",
        "headingLevel": null,
        "headingStack": [
          1
        ],
        "tableHeader": null,
        "emitsBlock": null
      },
      {
        "no": 8,
        "text": "",
        "kind": "blank",
        "headingLevel": null,
        "headingStack": [
          1
        ],
        "tableHeader": null,
        "emitsBlock": null
      },
      {
        "no": 9,
        "text": "## 1. 文件职责",
        "kind": "heading",
        "headingLevel": 2,
        "headingStack": [
          1,
          9
        ],
        "tableHeader": null,
        "emitsBlock": null
      },
      {
        "no": 10,
        "text": "",
        "kind": "blank",
        "headingLevel": null,
        "headingStack": [
          1,
          9
        ],
        "tableHeader": null,
        "emitsBlock": null
      },
      {
        "no": 11,
        "text": "| 文件 | 职责 | 更新时机 |",
        "kind": "table-header",
        "headingLevel": null,
        "headingStack": [
          1,
          9
        ],
        "tableHeader": {
          "lineStart": 11,
          "lineEnd": 11
        },
        "emitsBlock": null
      },
      {
        "no": 12,
        "text": "|---|---|---|",
        "kind": "table-delim",
        "headingLevel": null,
        "headingStack": [
          1,
          9
        ],
        "tableHeader": {
          "lineStart": 11,
          "lineEnd": 12
        },
        "emitsBlock": null
      },
      {
        "no": 13,
        "text": "| `AGENTS.md` | AI 协作边界、黑白名单、辅助阶梯和 review 规则 | 协作原则发生变化时 |",
        "kind": "core",
        "headingLevel": null,
        "headingStack": [
          1,
          9
        ],
        "tableHeader": {
          "lineStart": 11,
          "lineEnd": 12
        },
        "emitsBlock": "rules/LEARNING-PROTOCOL.md#L13-L13"
      },
      {
        "no": 14,
        "text": "| `TECHNICAL-WRITING-PROTOCOL.md` | 每日笔记、周计划、复盘、runbook 摘要和学习展板的技术文案规则 | 暴露可迁移的事实表达或可读性问题时 |",
        "kind": "core",
        "headingLevel": null,
        "headingStack": [
          1,
          9
        ],
        "tableHeader": {
          "lineStart": 11,
          "lineEnd": 12
        },
        "emitsBlock": "rules/LEARNING-PROTOCOL.md#L14-L14"
      },
      {
        "no": 15,
        "text": "| `SHOWCASE-VISUAL-PROTOCOL.md` | 学习展板的视觉设计、信息层级、图标/动效边界和验收证据 | 展板视觉目标、开工门槛或验收方法变化时 |",
        "kind": "core",
        "headingLevel": null,
        "headingStack": [
          1,
          9
        ],
        "tableHeader": {
          "lineStart": 11,
          "lineEnd": 12
        },
        "emitsBlock": "rules/LEARNING-PROTOCOL.md#L15-L15"
      },
      {
        "no": 16,
        "text": "| `DAILY-SPEAKING-PROTOCOL.md` | 每日技术英语口语稿的内容来源、格式、校验和移动端口令 | 口语稿要求发生变化时 |",
        "kind": "core",
        "headingLevel": null,
        "headingStack": [
          1,
          9
        ],
        "tableHeader": {
          "lineStart": 11,
          "lineEnd": 12
        },
        "emitsBlock": "rules/LEARNING-PROTOCOL.md#L16-L16"
      }
    ],
    "blocks": [
      {
        "sourceId": "rules/LEARNING-PROTOCOL.md#L3-L3",
        "coreStart": 3,
        "coreEnd": 3,
        "contextSpans": [
          {
            "role": "heading",
            "lineStart": 1,
            "lineEnd": 1
          }
        ],
        "modelContentChars": 86
      },
      {
        "sourceId": "rules/LEARNING-PROTOCOL.md#L5-L5",
        "coreStart": 5,
        "coreEnd": 5,
        "contextSpans": [
          {
            "role": "heading",
            "lineStart": 1,
            "lineEnd": 1
          }
        ],
        "modelContentChars": 83
      },
      {
        "sourceId": "rules/LEARNING-PROTOCOL.md#L13-L13",
        "coreStart": 13,
        "coreEnd": 13,
        "contextSpans": [
          {
            "role": "heading",
            "lineStart": 1,
            "lineEnd": 1
          },
          {
            "role": "heading",
            "lineStart": 9,
            "lineEnd": 9
          },
          {
            "role": "table_header",
            "lineStart": 11,
            "lineEnd": 12
          }
        ],
        "modelContentChars": 119
      },
      {
        "sourceId": "rules/LEARNING-PROTOCOL.md#L14-L14",
        "coreStart": 14,
        "coreEnd": 14,
        "contextSpans": [
          {
            "role": "heading",
            "lineStart": 1,
            "lineEnd": 1
          },
          {
            "role": "heading",
            "lineStart": 9,
            "lineEnd": 9
          },
          {
            "role": "table_header",
            "lineStart": 11,
            "lineEnd": 12
          }
        ],
        "modelContentChars": 153
      },
      {
        "sourceId": "rules/LEARNING-PROTOCOL.md#L15-L15",
        "coreStart": 15,
        "coreEnd": 15,
        "contextSpans": [
          {
            "role": "heading",
            "lineStart": 1,
            "lineEnd": 1
          },
          {
            "role": "heading",
            "lineStart": 9,
            "lineEnd": 9
          },
          {
            "role": "table_header",
            "lineStart": 11,
            "lineEnd": 12
          }
        ],
        "modelContentChars": 146
      },
      {
        "sourceId": "rules/LEARNING-PROTOCOL.md#L16-L16",
        "coreStart": 16,
        "coreEnd": 16,
        "contextSpans": [
          {
            "role": "heading",
            "lineStart": 1,
            "lineEnd": 1
          },
          {
            "role": "heading",
            "lineStart": 9,
            "lineEnd": 9
          },
          {
            "role": "table_header",
            "lineStart": 11,
            "lineEnd": 12
          }
        ],
        "modelContentChars": 135
      }
    ]
  },
  "eval": {
    "evalVersion": "w13-eval-v1",
    "totalItems": 20,
    "dev": {
      "count": 10,
      "byBehavior": [
        {
          "behaviorType": "direct_answer",
          "count": 2,
          "expectedBranch": "answered",
          "evidenceRequirements": 2
        },
        {
          "behaviorType": "cross_document",
          "count": 2,
          "expectedBranch": "answered",
          "evidenceRequirements": 4
        },
        {
          "behaviorType": "paraphrase",
          "count": 2,
          "expectedBranch": "answered",
          "evidenceRequirements": 4
        },
        {
          "behaviorType": "priority_conflict_exception",
          "count": 2,
          "expectedBranch": "answered",
          "evidenceRequirements": 5
        },
        {
          "behaviorType": "no_answer",
          "count": 2,
          "expectedBranch": "abstained",
          "evidenceRequirements": 3
        }
      ],
      "evidenceKinds": {
        "source_span": 16,
        "corpus_absence": 2
      },
      "answered": 8,
      "abstained": 2
    },
    "protected": {
      "count": 10,
      "behaviorTypes": 5,
      "frozen": true
    },
    "answeredConditions": [
      "响应分支可解析且为 `answered`。",
      "返回 1 至 10 条 claims；每条 claim 都是 atomic claim。",
      "claims 合起来按语义等价完整覆盖该题的 `expected_rule_conclusion`，不要求逐字一致。",
      "每条 claim 至少关联一个 citation identifier。",
      "每个 citation identifier 都能解析到冻结 source span，且该 span 实际进入本次 context。",
      "每个 citation 至少支持对应 claim 的一个必要部分；同一 claim 的 citations 合起来支持完整 claim。",
      "每项 `evidence_requirements` 都由至少一条 claim 及其有效 citations 覆盖。",
      "不包含冻结 corpus 无法支持的额外 claim。"
    ],
    "abstainedConditions": [
      "响应分支可解析且为 `abstained`。",
      "不返回 answered claims。",
      "不返回 citation。",
      "reason code 必须为 `insufficient_corpus_evidence`。",
      "简短 reason text 与 reason code 及该题冻结的 `corpus_absence` 一致。"
    ],
    "splitConditions": [
      "运行有效。",
      "没有预期 `abstained` 的 item 返回 `answered`。",
      "`citation_precision = 1.0`；没有返回 citation 时按本契约的 item failure 处理，不以 `N/A` 代替门禁。",
      "`item_pass_rate >= 0.9`，即至少 9/10 items 通过。",
      "五类 behavior type 分别至少 1/2 items 通过。"
    ],
    "metrics": [
      {
        "metric": "branch_accuracy",
        "formula": "正确分支的 items / 10",
        "purpose": "诊断",
        "gate": false,
        "threshold": null
      },
      {
        "metric": "item_pass_rate",
        "formula": "满足全部 item-level 条件的 items / 10",
        "purpose": "门禁，必须 `>= 0.9`",
        "gate": true,
        "threshold": ">= 0.9"
      },
      {
        "metric": "claim_correctness",
        "formula": "语义正确的 returned claims / 全部 returned claims",
        "purpose": "诊断；分母为零时 `N/A`",
        "gate": false,
        "threshold": null
      },
      {
        "metric": "citation_precision",
        "formula": "有效且支持对应 claim 的 citations / 全部 returned citations",
        "purpose": "门禁；有返回 citation 时必须为 `1.0`",
        "gate": true,
        "threshold": "1.0"
      },
      {
        "metric": "citation_completeness",
        "formula": "至少有一个有效 citation 的 claims / 需要证据的 returned claims",
        "purpose": "诊断；分母为零时 `N/A`",
        "gate": false,
        "threshold": null
      },
      {
        "metric": "abstention_accuracy",
        "formula": "正确 abstained 的 items / 预期 abstained 的 items",
        "purpose": "诊断；当前每个 split 的分母为 2",
        "gate": false,
        "threshold": null
      }
    ]
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
};
