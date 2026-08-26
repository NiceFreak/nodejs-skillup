# W11 Day 3（8/26）技术英语口语稿

> 建立：2026-08-26（Asia/Shanghai）
> 来源：当天学习内容（`day3-deploy-credentials.md` §4）——V9 反向证明 validate-logs：注入假私钥头暴露 `getLog()` 返回类型 bug，修复后判红/恢复绿闭环

## Topic

Proving a log-scan check actually works — the reverse proof.

## Speaking Script

We added a validate-logs stage to our Jenkins pipeline. It scans every build log for private key patterns, because masking only hides exact strings, and a leaked key is still a leaked key. The check must fail the build if it finds anything.

The hard part: proving the scan actually works. A green result is not evidence. So I injected a fake private key header into the test stage and expected a red build. It stayed green. That exposed a real bug: `getLog()` with no arguments returns the whole log as one String, and Groovy iterates strings character by character, so matching never ran on a full line.

I switched to `getLog(int)`, which returns lines as a List, and the build turned red as expected. Then I removed the injection and the pipeline went green again. Now green means the scan really saw the log and found nothing.

## Speaking Check

- 词数：约 148 词（目标 120–150 ✅）
- 预计时长：约 63 秒 @ 140 词/分钟
- 口语感：对话式陈述，无论文/文档语气；使用了当天建立的工程术语（validate-logs / masking / reverse proof / `getLog(int)`）
- 事实边界：所有内容均为当天实测（构建 33 判红 + 构建 36 恢复绿），根因来自 Jenkins 源码核对；无超出笔记的推断
- 发音提示（必要项）：`getLog(int)` 读 `get-log-int`；`Groovy` 读 `groo-vee`