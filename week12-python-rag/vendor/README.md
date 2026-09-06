# Bub 报告源码证据包

本目录用于在离线且只 clone 本仓库时复核 `bub-reading-report.md` 的源码引用，不提供可运行的 Bub
副本，也不承担上游同步。

| 项目 | 值 |
|---|---|
| 上游 | `https://github.com/bubbuild/bub` |
| commit | `33c417ae7acab29222e157ff37dfa680f2d03686` |
| 快照日期 | 2026-09-06 |
| 文件 | `bub-report-evidence-33c417a.tar.gz` |
| 大小 | 37,503 bytes |
| SHA-256 | `7015f207b814dcd6bd2354c83ddb8430ffb31b1795a4c7f4116f67450c55dcd9` |
| 内容 | 报告引用的 11 个 Python 源文件、`pyproject.toml`、上游 `LICENSE` |

离线校验并解压到临时目录：

```bash
shasum -a 256 week12-python-rag/vendor/bub-report-evidence-33c417a.tar.gz
snapshot_dir=$(mktemp -d)
tar -xzf week12-python-rag/vendor/bub-report-evidence-33c417a.tar.gz -C "$snapshot_dir"
find "$snapshot_dir/bub-33c417a" -type f | sort
```

证据包只覆盖报告引用范围。运行 Bub、复核未引用模块或查看 Git 历史仍需完整上游仓库。

在上游 checkout 位于指定 commit 且工作树无改动时，使用以下命令重新生成：

```bash
bub_checkout=/path/to/bub
skillup_repo=/path/to/nodejs-skillup
git -C "$bub_checkout" archive --format=tar.gz --prefix=bub-33c417a/ \
  -o "$skillup_repo/week12-python-rag/vendor/bub-report-evidence-33c417a.tar.gz" \
  33c417a LICENSE pyproject.toml \
  src/bub/__main__.py src/bub/framework.py src/bub/store.py src/bub/tape.py src/bub/turn.py \
  src/bub/builtin/agent.py src/bub/builtin/cli.py src/bub/builtin/context.py \
  src/bub/builtin/hook_impl.py src/bub/builtin/model_runner.py src/bub/builtin/settings.py
```
