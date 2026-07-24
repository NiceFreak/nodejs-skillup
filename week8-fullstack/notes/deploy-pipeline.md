# 展板是怎么上线的 · 双仓部署链路

> 定位：这是**工程化事实的沉淀**（白名单展示资产），记录「零后端学习展板怎么构建并发布到
> GitHub Pages 供移动端复习」。最后一节「复盘 · 我是怎么驾驭 AI 的」是**本人任务**，
> 按 `AGENTS.md` 与 `plan/w5-display-board.md §3.3`：AI 只搭事实骨架，复盘叙事本人写。

## 一句话

同一份 `week8-fullstack` 前端，用一个构建开关切出**零后端的学习展板**，发布到
`nicefreak.github.io` 的子路径 `/skillup-week8/`；需要后端的管理后台被排除在外。

## 双仓链路（事实）

```
nodejs-skillup（源码仓）                     nicefreak.github.io（Pages 仓）
──────────────────────────                   ──────────────────────────────
week8-fullstack/src/frontend                 skillup-week8/
   │  VITE_SHOWCASE_ONLY=1                       ▲   index.html + assets/
   │  --base=/skillup-week8/                     │
   └── vite build ──► dist/ ───── 拷贝 ──────────┘
                                                │  PR 合并进 main
                                                ▼
                                 GitHub Pages 构建（约 1 分钟）
                                                ▼
                     https://nicefreak.github.io/skillup-week8/
```

| 仓库 | 角色 | 装什么 |
|---|---|---|
| `nodejs-skillup` | 源码 + 构建脚手架 | 前端源码、`VITE_SHOWCASE_ONLY` 开关、`deploy-showcase-pages` 技能 |
| `nicefreak.github.io` | 发布载体（用户站，从 `main` 根目录发布） | 构建产物 `skillup-week8/` + 首页入口链接 |

## 关键决策点（人做的判断）

事实链路能自动跑，但每个岔路口是**人拍的板**——这些才是这条链路的信息量所在。

| 决策 | 为什么 | 证据 / 落点 |
|---|---|---|
| 只发布**零后端展板**，排除管理后台 | GitHub Pages 是纯静态托管，跑不了 Express/Mongo；后台真链路上不了 | `VITE_SHOWCASE_ONLY` 隐藏 `#/admin`、导航、页脚 |
| 放在**子路径** `/skillup-week8/` | 与已有 `/viz/`、`/screenplay/` 并列，语义清晰 | `--base=/skillup-week8/` |
| 用 **hash 路由** | 子路径静态托管下，hash 路由天然无 SPA 刷新 404 问题 | `App.tsx` 的 `#/showcase` |
| 笔记链接**改为板内跳转** | 相对 `.md` 链接在静态站点点不动；改成切板对移动端最顺手 | `MarkdownNotes.tsx` 的 `a` 渲染器 |
| CORS **本地被 dev proxy 隐藏** | 本地 Vite proxy 同源转发，所以本期后端「零改动」；一旦跨域部署才需 CORS | `vite.config.ts` proxy；后端上线属 backlog |

## AI 协作分工（白名单 vs 核心）

| 部分 | 归属 | 谁做 |
|---|---|---|
| 构建开关、部署产物、构建/拷贝脚本 | 白名单脚手架 / 胶水 | AI 搭 |
| 关键决策（发什么、放哪、隐藏什么） | 判断 | 本人拍板，AI 执行 |
| `deploy-showcase-pages` 技能 | 白名单工具沉淀 | AI 搭，本人定范围 |
| 端到端链路的验收讲解 / 复盘叙事 | 核心表达 | **本人**（见下节） |

## 沉淀：一次性流程 → 可复用技能

这条链路没有停在「做过一次」，而是固化成了 `deploy-showcase-pages` 技能
（`.claude/skills/`）：下次说「更新展板 / 把某周传到 Pages」即可复用，技能里带了构建命令、
子路径 base、以及「Pages 从 main 发布、合并后才上线」这个坑。**把过程变成能力，本身就是
「驾驭 AI」的一种体现。**

## 复盘 · 我是怎么驾驭 AI 的（待本人填写）

> 这一节留给本人写，AI 不代笔。几个可选的切入问题：
>
> - 这条链路里，哪些是我**主动定方向**、哪些是 AI 提出我否决/采纳的？
> - 我在哪一步靠**追问**把 AI 的默认方案纠偏了（例：子路径 / 隐藏后台 / 链接修法）？
> - 「让 AI 搭脚手架、核心判断我来」这条 `AGENTS.md` 红线，在这次协作里是怎么守住的？
> - 如果脱离这次对话，我能独立把这条链路**从空白重建**吗？卡点在哪？
>
> _（正文待补）_
