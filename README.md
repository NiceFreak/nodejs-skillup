# `ops/showcase-deploy` 触发分支（种子）

本目录是**触发分支的种子内容**，不是触发分支本身。
`bootstrap-trigger-branch.sh` 用这里的文件在开发机上创建孤儿分支 `ops/showcase-deploy`。

## 这条链路是什么

手机上没有 `admin.pem`、也没有开发机 shell，但手机和开发机**都能出站到达 GitHub**。
于是 GitHub 当会合点：

```
手机 Claude Code                GitHub                    开发机 Jenkins            服务器 8081
  写 trigger.json  ──push──▶  ops/showcase-deploy  ◀──poll(≤5min)──  showcase-deploy job
                                                                          │
                                                        从 origin/main 拉代码 + 构建
                                                                          │
                                                          deploy-showcase-8081.sh ──▶ 落盘 + 线上验证
                                                                          │
  读 receipts/  ◀──push──   receipts/<requestId>.json  ◀────────────  写回执
```

## 两条不变量（改任何东西前先读这两条）

1. **触发权 ≠ 内容权。**
   `trigger.json` 只是一个信号。Jenkins 的 pipeline 定义存在 Jenkins 里（不从本分支读），
   构建内容**固定从 `origin/main` 取**。所以能写本分支的人只能决定「什么时候发」，
   不能决定「发什么」，更不能让开发机执行任意脚本。
   → 推论：**本分支永远不放可执行文件、不放 Jenkinsfile、不放构建脚本。**

2. **回执是唯一的成功判据。**
   手机侧的 Claude 会话**连不到 8081**（容器出站被网络策略挡住，实测 12s 超时）。
   所以「发布成功」只能由 `receipts/<requestId>.json` 证明，不能由「我推了 trigger」证明。
   没有回执 = 没有成功，哪怕线上其实已经更新。

## 目录结构

```
trigger.json          # 唯一的触发信号；每次触发 = 覆盖这个文件
trigger.schema.json   # trigger.json 的字段契约
receipts/             # Jenkins 写回，一次触发一个文件，只增不改
  <requestId>.json
```

## 手机侧怎么用

不用手写。skill `trigger-showcase-deploy`（`.claude/skills/`）负责写 `trigger.json` 和读回执。
本人在手机上只需要说：**「触发展板部署」**。
