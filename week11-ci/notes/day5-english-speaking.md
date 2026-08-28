# W11 Day 5（8/28）技术英语口语稿

> 建立：2026-08-28（Asia/Shanghai，D5 收口）
> 来源：当天学习内容（`day5-wrapup.md` §5 A 对照说明 + §6 口述三问）——与 W9 手工部署的逐步对照：哪几步被自动化替掉、哪几步仍靠人判断

## Topic

What a step-by-step comparison of a manual deploy against the pipeline we built revealed about automation boundaries.

## Speaking Script

We built a pipeline this week that replaces a manual deploy. To make the handoff explicit, I compared every manual step: clone, install dependencies, build, copy artifacts, restart the service, and reload Nginx. The pipeline replaced the middle steps — clone, install, restart — but not the ends.

The build and artifact copy are now done by a separate showcase-publish script, not by the main pipeline. The Nginx reload stays manual on purpose, because changing reverse-proxy config is a W9 boundary we chose not to automate yet. And the biggest judgment call — whether to roll back after a failed verification — is still made by a human, by design.

One honest limitation: the pipeline runs on a controller that lives on a laptop. If that machine goes to sleep, the pipeline simply doesn't exist. Automation replaced the steps, not the machine that runs them.

## Speaking Check

- 词数：145 词（目标 120–150 ✅）
- 预计时长：约 62 秒 @ 140 词/分钟
- 口语感：对话式陈述，无论文/文档语气；使用当天建立的工程术语（handoff / pipeline stages / showcase-publish script / verification / rollback judgment）
- 事实边界：均为 D5 实测对照——「中间几步被替掉（clone/npm ci/restart）」「build/送产物由 showcase 链路替掉（非 Jenkins）」「nginx reload 主动不交（Q7）」「回滚判定不能交（Q12）」「controller 依赖会关机的机器（第三类）」
- 发音提示（必要项）：`Nginx` 读 `en-jin-ex`；`rollback` 读 `roll-back`；`Type=simple` 相关不在本稿主题内