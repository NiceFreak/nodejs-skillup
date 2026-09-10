"""Parser segmentation fixtures (D4 追加).

`parse_blocks` 此前没有任何单元级用例：fixture A/B/C/D 直接构造 spans，不经过 parser。
本文件按 D2 §6.1 的各条切分规则手推预期，再与实现比对后固化。全部为内存文档，
不进入 corpus / registry / Evidence Context / eval。
"""
from __future__ import annotations

from w13rag.parser import parse_blocks
from w13rag.registry import build_entries
from w13rag.source import SourceDoc


def _doc(path: str, lines: list[str]) -> SourceDoc:
    return SourceDoc(
        corpus_id="fixture",
        source_path=path,
        snapshot_path=path,
        lines=tuple(lines),
        has_lf=tuple([True] * len(lines)),
    )


DOC_MERGE = _doc("doc-merge.md", [
    "## 小节",       # L1 heading
    "",              # L2
    "段落说明。",     # L3 前置说明
    "",              # L4
    "```text",       # L5 fence
    "code line",     # L6
    "```",           # L7
])

DOC_LIST_THEN_FENCE = _doc("doc-list-fence.md", [
    "## 小节",       # L1
    "",              # L2
    "- 列表项",      # L3 非段落的前一块
    "",              # L4
    "```text",       # L5
    "x",             # L6
    "```",           # L7
])

DOC_HR_BOUNDARY = _doc("doc-hr.md", [
    "## 小节",       # L1
    "",              # L2
    "段落",          # L3
    "",              # L4
    "---",           # L5 thematic break（硬边界）
    "",              # L6
    "```text",       # L7
    "code",          # L8
    "```",           # L9
])

DOC_HEADING_CHAIN = _doc("doc-head.md", [
    "# 标题",        # L1
    "",              # L2
    "## A",          # L3
    "",              # L4
    "### A1",        # L5
    "",              # L6
    "正文1",         # L7
    "",              # L8
    "### A2",        # L9 同级标题应把 A1 出栈
    "",              # L10
    "正文2",         # L11
])

DOC_UNBALANCED = _doc("doc-unbalanced.md", [
    "## 小节",           # L1
    "",                  # L2
    "段落",              # L3
    "",                  # L4
    "```text",           # L5 无闭合围栏
    "no closing fence",  # L6
])


def test_paragraph_then_fence_merges_into_one_code_block():
    blocks, code_lines = parse_blocks(DOC_MERGE)
    assert len(blocks) == 1
    b = blocks[0]
    assert b.kind == "code"
    assert (b.core_start, b.core_end) == (3, 7)
    assert b.code_spans == [(5, 7)]
    assert b.headings == [1]
    assert code_lines == {5, 6, 7}

    entries = build_entries([(DOC_MERGE, blocks, code_lines)])
    assert entries[0]["source_id"] == "fixture/doc-merge.md#L3-L7"
    assert entries[0]["model_content"] == "## 小节\n段落说明。\n\n```text\ncode line\n```\n"


def test_fence_after_non_paragraph_stays_standalone():
    blocks, code_lines = parse_blocks(DOC_LIST_THEN_FENCE)
    assert [b.kind for b in blocks] == ["list_item", "code"]
    assert (blocks[0].core_start, blocks[0].core_end) == (3, 3)
    assert (blocks[1].core_start, blocks[1].core_end) == (5, 7)
    assert blocks[1].code_spans == [(5, 7)]
    assert code_lines == {5, 6, 7}


def test_thematic_break_blocks_the_merge():
    blocks, _ = parse_blocks(DOC_HR_BOUNDARY)
    assert [b.kind for b in blocks] == ["paragraph", "code"]
    assert (blocks[0].core_start, blocks[0].core_end) == (3, 3)
    assert (blocks[1].core_start, blocks[1].core_end) == (7, 9)


def test_same_level_heading_replaces_inner_heading():
    blocks, _ = parse_blocks(DOC_HEADING_CHAIN)
    assert [b.kind for b in blocks] == ["paragraph", "paragraph"]
    assert blocks[0].headings == [1, 3, 5]
    assert blocks[1].headings == [1, 3, 9]


def test_unbalanced_fence_is_treated_as_verbatim_to_eof():
    blocks, code_lines = parse_blocks(DOC_UNBALANCED)
    assert len(blocks) == 1
    assert blocks[0].kind == "code"
    assert (blocks[0].core_start, blocks[0].core_end) == (3, 6)
    assert code_lines == {5, 6}
