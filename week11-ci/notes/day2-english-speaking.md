# W11 Day 2（8/25）技术英语口语稿

> 建立：2026-08-27（W11 D4 收口时补记；D2 当日未生成，D2/D3 顺延项）
> 来源：当天学习内容（`day2-controller-setup.md`）——Jenkins controller 从零装起 + 第一条只构建与测试的流水线

## Topic

Standing up a Jenkins controller and proving a first build pipeline.

## Speaking Script

On day two I set up a Jenkins controller from scratch and got a first build pipeline green. The controller runs on my dev machine because our production box only has two gigabytes of RAM. I limit the JVM heap to 512 megabytes through a launchd environment file, not a command line flag, because that is the only place Jenkins reads it from.

The pipeline has three stages: checkout, install, and test. Tests run against an in-memory MongoDB instance, so the build does not need a database. Jenkins triggers the build by polling the repository every five minutes; webhooks are not an option because the controller sits behind NAT.

To prove the pipeline actually checks something, I deliberately broke a test, watched the build turn red, then fixed it. Green now means the tests really ran.

## Speaking Check

- 词数：136 词（目标 120–150 ✅）
- 预计时长：约 60 秒 @ 135 词/分钟
- 口语感：对话式陈述，无论文/文档语气；使用了当天建立的工程术语（controller / launchd env file / in-memory MongoDB / polling）
- 事实边界：均为 D2 实测（Jenkins LTS 2.568.2 brew 安装、launchctl 自管、JVM 512M env 注入、三阶段流水线、MMS 测试、Poll SCM 自动触发、变红实验）；「webhook 不可行因 NAT」来自 D1 契约
- 发音提示（必要项）：`launchd` 读 `launch-dee`；`MMS` 逐字母 `M-M-S`（MongoDB Memory Server）