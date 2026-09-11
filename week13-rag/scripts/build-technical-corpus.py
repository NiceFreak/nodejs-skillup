#!/usr/bin/env python3
"""Build an explicit, versioned technical corpus snapshot.

The allowlist is deliberately small and reviewable.  A new run writes a new
manifest/snapshot digest and reports added/modified/deleted files relative to
the previous manifest; it never scans eval or holdout directories.
"""
from __future__ import annotations

import argparse, hashlib, json, re, shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ALLOWLIST = [
    ("AGENTS.md", "normative"),
    ("TECHNICAL-WRITING-PROTOCOL.md", "normative"),
    ("SHOWCASE-VISUAL-PROTOCOL.md", "normative"),
    ("DAILY-SPEAKING-PROTOCOL.md", "normative"),
    ("SHOWCASE-DEPLOY-PROTOCOL.md", "normative"),
    ("LEARNING-PROTOCOL.md", "normative"),
    ("DAILY-LEARNING-REPORT-PROTOCOL.md", "normative"),
    ("week13-rag/notes/day1-corpus-freeze-and-baseline.md", "learning-note"),
    ("week13-rag/notes/day4-full-context-baseline-and-bm25.md", "learning-note"),
    ("week13-rag/notes/day5-dense-langchain-wiring.md", "learning-note"),
    ("week13-rag/notes/day6-modular-rag-plan.md", "learning-note"),
]
SENSITIVE = re.compile(r"(?i)(?:sk-[A-Za-z0-9]{16,}|(?:api[_ -]?key|secret|password|token)\s*[:=]\s*['\"]?[A-Za-z0-9_\-/+=]{12,}|/Users/[A-Za-z0-9_.\-/]+)")

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def digest_documents(docs: list[dict]) -> str:
    payload = [{"sourcePath": d["sourcePath"], "sha256": d["sha256"], "bytes": d["bytes"]}
               for d in sorted(docs, key=lambda x: x["sourcePath"])]
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    return sha256(raw)

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, default=ROOT / "week13-rag/corpus/technical-v1")
    args = ap.parse_args()
    out = args.output
    documents: list[dict] = []
    for source_path, category in ALLOWLIST:
        src = ROOT / source_path
        if not src.is_file():
            raise SystemExit(f"allowlisted source missing: {source_path}")
        raw = src.read_bytes()
        if SENSITIVE.search(raw.decode("utf-8", errors="strict")):
            raise SystemExit(f"safety scan failed; redact or remove from allowlist: {source_path}")
        snap = Path("documents") / source_path
        documents.append({"sourcePath": source_path, "snapshotPath": snap.as_posix(),
                          "category": category, "authority": "repository",
                          "status": "active", "bytes": len(raw), "sha256": sha256(raw)})
    digest = digest_documents(documents)
    manifest = {"schemaVersion": 1, "corpusId": "technical", "snapshotId": f"technical-{digest[:12]}",
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "source": {"repository": ".", "contentBasis": "explicit_allowlist_worktree"},
                "normalization": {"id": "repository-content-v1", "sourceLinePositionsPreserved": True},
                "selection": {"mode": "explicit_allowlist", "excludedByConstruction": True,
                               "allowlistRevision": "technical-v1", "safetyScan": "reject-sensitive-patterns"},
                "contentRoot": "documents", "contentDigestAlgorithm": "sha256(canonical sourcePath+sha256+bytes)",
                "contentDigest": digest, "documents": documents,
                "totals": {"files": len(documents), "bytes": sum(d["bytes"] for d in documents)}}
    old = None
    manifest_path = out / "manifest.json"
    if manifest_path.exists():
        old = json.loads(manifest_path.read_text(encoding="utf-8"))
        if old.get("contentDigest") and old["contentDigest"] != digest:
            raise SystemExit("output snapshot is immutable; choose a new --output directory")
    old_map = {d["sourcePath"]: d for d in (old or {}).get("documents", [])}
    new_map = {d["sourcePath"]: d for d in documents}
    changes = {"added": sorted(set(new_map)-set(old_map)),
               "deleted": sorted(set(old_map)-set(new_map)),
               "modified": sorted(k for k in set(new_map)&set(old_map) if new_map[k]["sha256"] != old_map[k]["sha256"]),
               "unchanged": sorted(k for k in set(new_map)&set(old_map) if new_map[k]["sha256"] == old_map[k]["sha256"])}
    (out / "documents").mkdir(parents=True, exist_ok=True)
    for d in documents:
        target = out / d["snapshotPath"]
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / d["sourcePath"], target)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "change-set.json").write_text(json.dumps({"snapshotId": manifest["snapshotId"], **changes}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"snapshotId": manifest["snapshotId"], "files": len(documents), "bytes": manifest["totals"]["bytes"], "changes": {k: len(v) for k,v in changes.items()}}, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
