# 事故复盘 · 2026-07-17 前端 CI 因 lockfile 漂移红灯

> 复盘性质：真实、轻微、自限的 CI 事故（不是生产事故）。对事不对人，只查机制、不追责个人。
>
> 分工：事实时间线与文档结构由 AI 整理；**根因、预防、经验教训由本人分析，AI 只誊抄本人结论**。

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

## 5. 根因分析

- **直接原因**：改 `@types/node` 版本时只更新了 `yarn.lock`，`package-lock.json` 没跟着改；CI 的 `npm ci` 严格比对锁文件与 `package.json`，一对不上就失败。
- **更深的机制原因**：早上引入 yarn 时只做了一半——加了 `yarn.lock`，却没删旧的 `package-lock.json`，CI 也没从 npm 切到 yarn。仓库里于是有了两个"依赖事实源"，平时相安无事，直到只更新其中一个，两者漂移、打架。
- **为什么 run #128 是绿的**：那次是纯文档改动，没动依赖，`package-lock.json` 与 `package.json` 仍一致，`npm ci` 恰好通过——隐患一直在，只是没被触发。
- **归因（对事不对人）**：触发红灯的改动 `bb58d2c` 由 AI 提交；半程迁移发生在白名单工具链（yarn / CI 配置）内。这不是某个人的知识缺口，而是"改构建方式时漏了一个消费者"的机制问题。

---

## 6. 预防措施

- [x]（已做）统一到单一包管理器 yarn：删除 `package-lock.json`，CI 前端任务切到仓库内置 yarn（`install --immutable` + `build`）—— commit `7a934ae`。
- 引入或替换任何构建工具时，把 CI 当作"消费者"一并更新；本地验证尽量走 CI 真正执行的那条命令路径，避免"本地一套、CI 另一套"。
- 同类隐患不新开任务：CI 的 `MONGODB_URI` 服务空转是同一类"CI 配置与真实工程状态脱节"，已在 `LEARNING-STATE.md` 记为 W6 收口项。

---

## 7. 经验教训

> 按 `LEARNING-PROTOCOL.md` §9：一次复盘最多沉淀一条可迁移的问题模式。

改了"依赖的事实源"，这件事没做完，直到两件事都做了：①删掉旧的事实源，不让新旧共存漂移；②更新所有读它的消费者——**CI 是其中一个，还是本地看不见的那个**。关键不是"不懂 GitHub CI"，而是"改构建方式时先把消费者列全"。这条与平台无关，Jenkins 同样成立（Jenkinsfile 也得跟着改）。
