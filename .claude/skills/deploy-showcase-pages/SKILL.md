---
name: deploy-showcase-pages
description: >-
  【2026-08-14 起已冻结，不要主动触发】把 Node.js Skillup 学习展板发布到
  nicefreak.github.io 的 /skillup-week8/ GitHub Pages 子路径的历史链路。展板的当前
  发布目标已改为自建服务器 8081，Pages 上传处于冻结状态。因此“更新展板”“重新构建
  复习页”“同步笔记到线上”这类请求**不再**由本 skill 承接。仅当用户在当次会话中明确
  说“解冻 Pages”或等价指令时才读取本文件；届时它提供 SHOWCASE_ONLY 构建标志、
  子路径 base、复制 Pages 产物、双仓库边界，以及“Pages 从 main 发布、功能分支必须
  合并后才会上线”的完整操作链。
---

# 将 Skillup 学习展板部署到 GitHub Pages（已冻结）

## 停止条款（先读这一段）

**GitHub Pages 上传自 2026-08-14 起冻结。** 冻结的是「上传 / 复制产物 / 提交 Pages 仓库 / 推送」，不冻结构建。

在本人于当次会话中明确解冻之前：

- **不要**向 `nicefreak.github.io` 复制产物、提交或推送。
- **不要**把「更新展板 / 部署展板 / 同步到线上」默认理解为 Pages——当前发布目标是服务器 `http://43.128.154.242:8081`（`shop-showcase` 站点，`dist-showcase/`，带登录门禁）。
- 收到指向 Pages 的请求时**先停下确认**，不自行解冻，也不默认改道 8081。

冻结理由与解冻条件写在 `SHOWCASE-DEPLOY-PROTOCOL.md` §0，以那里为准。本文件保留下面的完整链路是为了解冻时不必重建它——**它是参考资料，不是当前的执行指令**。

另有一条与冻结同源的硬边界，任何时候都成立：`reviewOnly` 资产（W9「部署上线」板、W9 七份笔记、面试材料）不进任何公开无门禁的发布目标。

## 执行前提（解冻后适用）

先完整读取仓库根目录的 `SHOWCASE-DEPLOY-PROTOCOL.md`，并遵守其中的权限、验证和完成口径。本 skill 只补充当前项目的路径、命令和稳定约束；发生冲突时，以根级协议和 `AGENTS.md` 为准。

## 项目结构

`week8-fullstack/src/frontend` 是一个 Vite + React SPA，包含两个 hash route：

- `#/showcase`：**学习展板**。当前包含认证与授权、OAuth2 流程、数据库聚合、Node.js 运行时和前端笔记等 tab。topic 数据在 `*Topics.ts` 中，笔记通过 `?raw` 在构建时内联；运行时不需要后端。这是移动端发布目标。
- `#/admin`：**管理后台**。包含真实 login / JWT / RBAC / reports，需要 `week2-express` 后端，不进入 Pages 构建。

目标仓库是用户站点仓库 `nicefreak.github.io`，从 `main` 根目录发布；展板地址为 `https://nicefreak.github.io/skillup-week8/`。

两个仓库都在当前任务指定的功能分支上开发。不得直接推送 `main`；只有用户明确要求时才提交、推送或创建 PR。

## 静态发布不变量

showcase 必须在结构上保持无后端依赖。当前唯一实时调用是 `api.ts` 中供 admin `Dashboard` 使用的 `probe`。

`OAuth2FlowPanel` 已从 `Dashboard.tsx` 抽到独立的 `OAuth2Panel.tsx`，`Dashboard` 也改成懒加载，因此管理后台的报表视图和 `charts.tsx` 不再进入 showcase 入口 chunk——「展板无后端依赖」现在由模块边界保证，下面的 grep 只是二次确认。

发布前在前端源码目录检查 showcase 组件是否新增网络依赖：

```bash
cd week8-fullstack/src/frontend/src
rg -n "from ['\"]\\./api['\"]|fetch\\(" AuthBoard.tsx Showcase.tsx OAuth2Panel.tsx W3Board.tsx W5Board.tsx W6Board.tsx MarkdownNotes.tsx
```

预期无匹配。若出现匹配，停止部署并指出哪个 showcase 组件开始依赖后端。

## 构建

`VITE_SHOWCASE_ONLY=1` 由 `App.tsx` 读取，用于隐藏 admin 导航、`#/admin` 路由、“打开管理后台实验”按钮并替换页脚，避免手机用户进入不存在的后端。

`--base` 必须与 Pages 子路径一致，因为 assets 使用绝对路径；hash router 不需要额外的 SPA fallback。

```bash
cd week8-fullstack/src/frontend
node .yarn/releases/yarn-3.2.0.cjs install --immutable
node .yarn/releases/yarn-3.2.0.cjs typecheck
VITE_SHOWCASE_ONLY=1 VITE_API_BASE="" node .yarn/releases/yarn-3.2.0.cjs build --base=/skillup-week8/
```

构建输出位于 `dist/`。该目录在源码仓库中被忽略，只复制并提交到 Pages 仓库。

## 同步到 Pages 仓库

先解析并验证两个仓库与构建产物，再删除旧的生成文件：

```bash
SKILLUP_ROOT="$(git rev-parse --show-toplevel)"
PAGES_ROOT="$(dirname "$SKILLUP_ROOT")/nicefreak.github.io"
DEPLOY_SOURCE="$SKILLUP_ROOT/week8-fullstack/src/frontend/dist"
DEPLOY_TARGET="$PAGES_ROOT/skillup-week8"

test "$(basename "$SKILLUP_ROOT")" = "nodejs-skillup"
test "$(basename "$PAGES_ROOT")" = "nicefreak.github.io"
test -d "$PAGES_ROOT/.git"
test -f "$DEPLOY_SOURCE/index.html"

mkdir -p "$DEPLOY_TARGET"
rm -rf "$DEPLOY_TARGET/assets"
rm -f "$DEPLOY_TARGET/index.html"
cp -R "$DEPLOY_SOURCE"/. "$DEPLOY_TARGET"/
```

保留已有的 `skillup-week8/README.md`，它用于说明该目录是生成产物。主页 `index.html` 中指向 `./skillup-week8/` 的入口已经存在，不要改动；只有发布新的独立周目录时才新增对应入口。

复制后验证：

```bash
rg -o '<title>.*</title>' "$DEPLOY_TARGET/index.html"
rg -o "/skillup-week8/assets/[^\"']*" "$DEPLOY_TARGET/index.html"
git -C "$PAGES_ROOT" status --short
git -C "$PAGES_ROOT" diff --stat
```

标题应为 `Node.js Skillup · 学习展板`，asset 路径应位于 `/skillup-week8/assets/`。

标题和 favicon 现在由 `vite.config.ts` 的 `transformIndexHtml` 在构建期写入（由 `VITE_SHOWCASE_ONLY` 决定），产物本身就是对的，不再需要复制后改写 `index.html`。上面这条检查是验证，不是修复步骤：如果标题不对，说明构建环境变量没设对，应重新构建而不是就地改产物。

按根级协议本地预览最终发布目录。内容或布局有变化时，用桌面和移动视口检查默认入口及本次涉及的深链。

## 双仓库提交、推送与 PR

只有用户明确授权对应外部操作时才执行。分别检查并暂存与本次任务相关的文件，不使用覆盖整个仓库的宽泛暂存命令。

源码仓库保存源文件和内容变更，不保存 `dist/`；Pages 仓库保存 `skillup-week8/` 下的生成产物及本次确有需要的主页变更。

```bash
git -C "$SKILLUP_ROOT" status --short
git -C "$PAGES_ROOT" status --short

git -C "$SKILLUP_ROOT" push -u origin <branch>
git -C "$PAGES_ROOT" push -u origin <branch>
```

需要 PR 时，每个仓库分别创建一个 PR。使用 GitHub MCP 工具，并按现有 Claude Code 约定在 PR body 末尾保留 attribution footer。

## 必须说明的上线条件

Pages 从 **`main`** 发布。推送功能分支不会让线上地址更新；只有 Pages 仓库的功能分支合并进 `main`，并等待约一分钟完成 Pages 构建后，内容才会上线。

交付时始终区分：

- 源码仓库 PR 只用于代码 review，不直接影响线上站点。
- Pages 仓库 PR 才包含发布产物。
- PR 未合并时，只能说“功能分支已更新”，不能说“已上线”。

## 当前移动端边界

现有 CSS 已包含 `@media (max-width: 720px)`、viewport、dark mode 和 reduced-motion。Markdown 表格设置了 `min-width: 520px`，窄屏下在自身容器内横向滚动；除非用户明确反馈，不把它当作发布阻断。

## Markdown 链接行为

保持 `MarkdownNotes.tsx` 的现有链接规则：

- 外部链接在新 tab 打开。
- 能映射到 board note 的仓库内 `.md` 引用通过 `onTopicChange` 在应用内切换。
- 其他本地路径回退到 GitHub blob URL。
- `#` anchor 在当前页面滚动。

新增笔记时必须为每个 `NoteSource` 配置 `file` 和 `repoPath`，确保移动端链接仍然有效。
