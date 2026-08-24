# W11 Day 1（8/24）技术英语口语稿

> 建立：2026-08-24（Asia/Shanghai）
> 来源：当天学习内容（`day1-contract-freeze.md`、`day1-release-contract.md`）——发布契约冻结：凭据模型、回滚判据、部署后验证

## Topic

Freezing a release contract for a one-machine CI/CD rollout.

## Speaking Script

Today I froze a release contract before we touch the server. This week we are adding a Jenkins pipeline to deploy a small Node.js service to a single production box, and the contract answers three questions: who runs the deployment, what commands that identity is allowed to execute, and what counts as failure.

We chose polling instead of webhooks because the controller sits behind NAT with no inbound route. Deployment is a five-stage pipeline: checkout, install, test on the controller, then a restricted SSH wrapper on the server, then post-deploy verification.

The wrapper only accepts three whitelisted commands, read from `SSH_ORIGINAL_COMMAND`. Rollback targets the last verified commit, not the last attempt. Post-deploy checks include a public curl, because the existing health check proves the process is alive but not that the reverse proxy can reach it.

## Speaking Check

- 词数：约 135 词（目标 120–150 ✅）
- 预计时长：约 60 秒 @ 135 词/分钟
- 口语感：对话式陈述，无论文/文档语气；使用了当天建立的工程术语（polling / NAT / SSH_ORIGINAL_COMMAND / post-deploy verification）
- 事实边界：所有内容均为当天冻结的契约结论，无超出笔记的推断
- 发音提示（必要项）：`SSH_ORIGINAL_COMMAND` 逐字母读 `S-S-H-underscore-original-command`；`NAT` 读 `n-a-t`（network address translation）
