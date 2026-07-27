---
name: deploy-showcase-pages
description: >-
  构建 week8-fullstack 前端中无需后端的“学习展板 / showcase”，并将其部署到
  nicefreak.github.io 的 /skillup-week8/ GitHub Pages 子路径，供移动端复习。用户要求
  发布、重新构建、刷新或更新 Node.js Skillup 学习展板时使用，包括“更新展板”、
  “重新构建复习页”、“把 weekN 传到 GitHub Pages”、“deploy the review board”或
  “同步笔记到线上”。当笔记或 topic 已变化、线上展板需要重建时也应使用。本 skill
  处理 SHOWCASE_ONLY 构建标志、子路径 base、复制 Pages 产物、双仓库边界，以及
  “Pages 从 main 发布，功能分支必须合并后才会上线”的限制。
---

# 将 Skillup 学习展板部署到 GitHub Pages

## 执行前提

先完整读取仓库根目录的 `SHOWCASE-DEPLOY-PROTOCOL.md`，并遵守其中的权限、验证和完成口径。本 skill 只补充当前项目的路径、命令和稳定约束；发生冲突时，以根级协议和 `AGENTS.md` 为准。

## 项目结构

`week8-fullstack/src/frontend` 是一个 Vite + React SPA，包含两个 hash route：

- `#/showcase`：**学习展板**。当前包含认证与授权、OAuth2 流程、数据库聚合、Node.js 运行时和前端笔记等 tab。topic 数据在 `*Topics.ts` 中，笔记通过 `?raw` 在构建时内联；运行时不需要后端。这是移动端发布目标。
- `#/admin`：**管理后台**。包含真实 login / JWT / RBAC / reports，需要 `week2-express` 后端，不进入 Pages 构建。

目标仓库是用户站点仓库 `nicefreak.github.io`，从 `main` 根目录发布；展板地址为 `https://nicefreak.github.io/skillup-week8/`。

两个仓库都在当前任务指定的功能分支上开发。不得直接推送 `main`；只有用户明确要求时才提交、推送或创建 PR。

## 静态发布不变量

showcase 必须在结构上保持无后端依赖。当前唯一实时调用是 `api.ts` 中供 admin `Dashboard` 使用的 `probe`；`OAuth2FlowPanel` 虽从 `Dashboard.tsx` 导出，但本身是静态内容。

发布前在前端源码目录检查 showcase 组件是否新增网络依赖：

```bash
cd week8-fullstack/src/frontend/src
rg -n "from ['\"]\\./api['\"]|fetch\\(" AuthBoard.tsx Showcase.tsx W3Board.tsx W5Board.tsx MarkdownNotes.tsx
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
perl -0pi -e 's#<title>[^<]*</title>#<title>Node.js Skillup · 学习展板</title>#' "$DEPLOY_TARGET/index.html"
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
