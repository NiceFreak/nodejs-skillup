# 事故复盘 · 2026-07-17 前端 CI 因 lockfile 漂移红灯

> 复盘性质：真实、轻微、自限的 CI 事故（不是生产事故）。对事不对人，只查机制、不追责个人。
>
> 分工：本篇的事实时间线与文档结构由 AI 整理；**根因分析、"如果漏到生产"推演、预防措施、经验教训四节由本人填写**（下方已留白并给出提示）。这四节正是这次复盘最该练的推理部分，不代写。

---

## 1. 一句话摘要

前端把一个依赖的版本改小之后，CI 里的 `npm ci` 因为 `package-lock.json` 和 `package.json` 对不上而失败。往上追一层，真正的原因是早上引入 Yarn 时只做了一半：仓库里同时留着 npm 和 yarn 两份 lockfile，而 CI 还钉在过时的 npm 那份上。CI 把有问题的改动挡在了合并之前，没有生产影响。

---

## 2. 影响范围

| 维度 | 事实 |
|---|---|
| 触及范围 | feature 分支 `claude/week-plan-collaboration-review-xb19ix` 的 CI 前端构建任务 |
| 生产影响 | 无 |
| 用户影响 | 无 |
| 数据影响 | 无 |
| 后端测试任务 | 未受影响，全程绿 |
| 红灯窗口 | run #129 失败（约 09:48 UTC）→ run #130 修复（约 11:43 UTC）；其中真正的诊断与修复动作是分钟级，中间是间隔而非持续排障 |

---

## 3. 时间线（事实）

以下均为 2026-07-17：

1. **埋雷** — commit `aab1572`「引入 nvm 与 yarn」：新增 `yarn.lock`、`.yarnrc.yml` 和仓库内置的 yarn 3.2.0；但**没有删除旧的 `package-lock.json`**，CI 的前端任务也**仍然用 `npm ci`**（`cache-dependency-path` 指向 `package-lock.json`）。此刻两份 lockfile 并存，隐患已经埋下，只是还没被触发。

2. **没被触发的一次** — commit `56ea046`（纯文档收口）→ CI run #128 **绿**。因为没动依赖，`package-lock.json` 和 `package.json` 仍然一致，`npm ci` 正常通过。

3. **触发** — commit `bb58d2c`「收尾三处锦上添花」：把 `package.json` 里的 `@types/node` 从 `^26.1.1` 改成 `^24.13.3`，但**只更新了 `yarn.lock`**，`package-lock.json` 还停留在 26.1.1 → CI run #129 **红**。

4. **报错原文**（CI 日志）：
   ```
   npm error `npm ci` can only install packages when your package.json and
   package-lock.json ... are in sync.
   npm error Invalid: lock file's @types/node@26.1.1 does not satisfy @types/node@24.13.3
   npm error Invalid: lock file's undici-types@8.3.0 does not satisfy undici-types@7.18.2
   ```

5. **修复** — commit `7a934ae`「fix(ci)」：删除过时的 `package-lock.json`；CI 前端任务从 `npm ci` 改为直接用仓库内置 yarn 执行 `node .yarn/releases/yarn-3.2.0.cjs install --immutable` + `build` → CI run #130 **绿**（后端测试 + 前端构建两个任务都通过）。

---

## 4. 检测与响应（事实）

- **怎么被发现的**：自动。CI 在 push 后立即触发，约 1 分钟内红灯。
- **谁先注意到**：由本人看到红灯后主动追问「CI 报错是否符合预期」，不是靠告警系统。
- **本地和 CI 的差异（关键事实）**：本地改动时用的是仓库内置 yarn（`typecheck` + `build`），验证通过；而 CI 跑的是 `npm ci`。**同一次改动，两条验证路径给出了相反的结论。**
- **响应动作**：读失败任务的日志 → 定位到 lockfile 不同步 → 决定统一到单一包管理器（yarn）→ 删掉 npm lockfile、切换 CI → 重新跑绿。

---

## 5. 根因分析（本人填写）

> 提示：区分「直接原因」和「更深的机制原因」。不要停在"改了版本没更新 npm lock"这一层，往上追问：
> - 为什么仓库里会有两份 lockfile？
> - 为什么 CI 和本地用了不同的包管理器？
> - 引入 yarn 的那一刻，本该顺手消除哪个隐患却没做？

- 直接原因：
- 诱因 / 更深的机制原因：
- 为什么之前一直没暴露（run #128 为什么是绿的）：

---

## 6. "如果漏到生产会怎样"推演（本人填写）

> 提示：这一节是把一次"被 CI 挡下的小事故"迁移成"生产事故"直觉的关键。围绕三点对比：
> - **检测时延**：CI 是即时红；生产靠什么发现，要多久？
> - **失败形态**：`npm ci` 失败是"响亮"的（直接挡住合并）；同类的依赖/环境漂移进了生产是"响亮"还是"静默"？什么时候才炸？
> - **响应手段**：这次删文件切 CI 就行；生产上同类问题你会回滚还是热修，凭什么判断？

- 检测会有什么不同：
- 失败形态会有什么不同：
- 需要哪些生产侧的防线（换句话说，这次 CI 恰好替你挡下了什么）：

---

## 7. 预防措施（本人填写）

> 提示：至少覆盖「单一事实源」和「验证路径一致性」两类。已经做完的先记为已完成，其余标出打算在哪个周期收口（例如 W6 工程化收口）。

- [x] （已做）统一到单一包管理器 yarn：删除 npm lockfile，CI 切换到仓库内置 yarn —— commit `7a934ae`
- [ ] 让本地验证和 CI 验证走同一条命令路径：
- [ ] 排查同类隐患（提示：W3 遗留的 CI `MONGODB_URI` 服务空转，是不是同一类"CI 配置和真实工程状态脱节"的问题？）：
- [ ] 其他：

---

## 8. 经验教训（本人填写，最多一条可长期迁移的）

> 按 `LEARNING-PROTOCOL.md` §9：每次复盘最多沉淀一条能迁移到其他技术栈的问题模式，没有新洞察就不硬写。

-
