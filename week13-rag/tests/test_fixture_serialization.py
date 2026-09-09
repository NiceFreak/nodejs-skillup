"""Fixture A/B/C regression per day3 §6.2.1.

These lock the serialization layer byte-for-byte: model_content reprs,
content_sha256, serialized block bytes and the two-block Evidence Context.
"""
from __future__ import annotations

import hashlib

from w13rag.registry import evidence_context_string
from w13rag.serialize import (
    build_model_content,
    content_sha256,
    serialize_source_block,
)
from w13rag.source import SourceDoc


def _doc(path: str, lines: list[str], ends_lf: bool = True) -> SourceDoc:
    return SourceDoc(
        corpus_id="fixture",
        source_path=path,
        snapshot_path=path,
        lines=tuple(lines),
        has_lf=tuple([True] * len(lines)),
    )


DOC_A = _doc("doc-a.md", [
    "### 示例标题",
    "示例正文第一行。",
    "示例正文第二行。  ",
    "",
    "1. 白名单项",
    "2. 例外项",
])

DOC_C = _doc("doc-c.md", [
    "## 示例小节",
    "",
    "| 状态 | 值 |",
    "| --- | --- |",
    "| active | 1 |",
])


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def test_fixture_a_model_content_and_hash():
    model = build_model_content(DOC_A, core_start=1, core_end=3)
    assert model == "### 示例标题\n示例正文第一行。\n示例正文第二行。  \n"
    assert content_sha256(model) == (
        "3ffb72fb332921189ddb6c35d0df11880e638c76d2257f2d6831d113d271cfcb"
    )


def test_fixture_b2_model_content_and_serialized():
    model = build_model_content(DOC_A, core_start=5, core_end=6)
    assert model == "1. 白名单项\n2. 例外项\n"
    assert content_sha256(model) == (
        "46c9d5e2ca6bb18f6e39e3aaa1d17574ae3c09b117b9a738f7551ec0304beaf6"
    )
    serialized = serialize_source_block("fixture/doc-a.md#L5-L6", model)
    assert serialized == (
        '<source id="fixture/doc-a.md#L5-L6">\n'
        "1. 白名单项\n"
        "2. 例外项\n"
        "</source>"
    )


def test_fixture_a_serialized_block():
    model = build_model_content(DOC_A, core_start=1, core_end=3)
    serialized = serialize_source_block("fixture/doc-a.md#L1-L3", model)
    assert serialized == (
        '<source id="fixture/doc-a.md#L1-L3">\n'
        "### 示例标题\n"
        "示例正文第一行。\n"
        "示例正文第二行。  \n"
        "</source>"
    )


def test_fixture_two_block_evidence_context():
    a_model = build_model_content(DOC_A, core_start=1, core_end=3)
    b2_model = build_model_content(DOC_A, core_start=5, core_end=6)
    ctx = evidence_context_string([
        {
            "source_id": "fixture/doc-a.md#L1-L3",
            "model_content": a_model,
        },
        {
            "source_id": "fixture/doc-a.md#L5-L6",
            "model_content": b2_model,
        },
    ])
    assert ctx == (
        '<source id="fixture/doc-a.md#L1-L3">\n'
        "### 示例标题\n"
        "示例正文第一行。\n"
        "示例正文第二行。  \n"
        "</source>\n"
        "\n"
        '<source id="fixture/doc-a.md#L5-L6">\n'
        "1. 白名单项\n"
        "2. 例外项\n"
        "</source>"
    )
    assert _hash(ctx) == "0c274d26d4eb52736ecace33c6f9bfbe20b3db3443a7b2cdb2781a17b6f2a497"


def test_fixture_c_order_heading_then_header_then_core():
    model = build_model_content(
        DOC_C,
        headings=[1],
        headers=[3, 4],
        core_start=5,
        core_end=5,
    )
    assert model == "## 示例小节\n| 状态 | 值 |\n| --- | --- |\n| active | 1 |\n"
    assert content_sha256(model) == (
        "4591b978ad682dd3001f60aaf84fdb92e7d675c6d58188335715ecc89e683293"
    )
    serialized = serialize_source_block("fixture/doc-c.md#L5-L5", model)
    assert serialized == (
        '<source id="fixture/doc-c.md#L5-L5">\n'
        "## 示例小节\n"
        "| 状态 | 值 |\n"
        "| --- | --- |\n"
        "| active | 1 |\n"
        "</source>"
    )
