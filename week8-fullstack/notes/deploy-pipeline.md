# 展板是怎么上线的 · 双仓部署链路

> 这是**工程化事实的可视化**（白名单展示资产）：只呈现「零后端学习展板发布到 GitHub Pages」
> 的双仓链路本身。取舍决策的走查与协作复盘属**对外表达**，放在讲稿里由本人讲，不铺在展板上
> （见 `notes/deploy-pipeline-talk.md`，该文件不进展板）。

## 一句话

同一份 `week8-fullstack` 前端，用一个构建开关切出**零后端的学习展板**，发布到
`nicefreak.github.io` 的子路径 `/skillup-week8/`；需要后端的管理后台被排除在外。

## 双仓链路

```
源码仓 nodejs-skillup
  ① 前端源码   week8-fullstack/src/frontend
       │
  ② 构建开关   VITE_SHOWCASE_ONLY=1  --base=/skillup-week8/
       │
  ③ 构建产物   vite build → dist/（纯静态 HTML/JS/CSS）
       │
       └──④ 拷贝 dist ──►  Pages 仓 nicefreak.github.io ： skillup-week8/
                                  │
                            ⑤ PR 合并进 main（推分支不上线，合并才触发）
                                  │
                            ⑥ Pages 构建（约 1 分钟）→ 上线
                                  ▼
                   https://nicefreak.github.io/skillup-week8/
```

①–③ 在源码仓，④–⑥ 到 Pages 仓；**编号对应讲稿里的逐句提词**（走查怎么讲见讲稿，不铺在展板上）。

| 仓库 | 角色 | 装什么 |
|---|---|---|
| `nodejs-skillup` | 源码 + 构建脚手架 | 前端源码、`VITE_SHOWCASE_ONLY` 开关、`deploy-showcase-pages` 技能 |
| `nicefreak.github.io` | 发布载体（用户站，从 `main` 根目录发布） | 构建产物 `skillup-week8/` + 首页入口链接 |

## 沉淀为可复用技能

这条链路没有停在「做过一次」，而是固化成了 `deploy-showcase-pages` 技能（`.claude/skills/`）：
下次说「更新展板 / 把某周传到 Pages」即可复用，技能里带了构建命令、子路径 base、以及
「Pages 从 main 发布、合并后才上线」这个坑。
