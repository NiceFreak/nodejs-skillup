# W6 测试与 CI 心智模型：从「本地能跑」到「每次 push 可独立验证」

> 日期：2026-07-28  
> 作用：收束 W6 Day 1 / Day 2 的学习主线；详细实现和验证证据仍以两篇每日笔记为准。

## 1. 一句话结论

这两天不是分别学习一套测试 API 和一份 CI YAML，而是在完成同一个工程闭环：

```text
业务代码在本地能运行
→ Day 1：用集成测试证明关键行为可信
→ Day 2：让这份证明在干净环境中可重复
→ 每次 push 都能得到独立的验证结果
```

## 2. 两天分别回答什么问题

| 学习日 | 核心问题 | 本仓库的实际动作 | 最终证据 |
|---|---|---|---|
| Day 1 · 测试 | 代码行为可信吗？ | 使用真实注册 / 登录所得 Token 访问 admin 报表 | admin 链返回 `200`，新用户链返回 `403` |
| Day 2 · CI | 这份验证可以脱离本机重复吗？ | 本地使用临时内存库，CI 使用 job 自己启动的 `mongo:7` | 本地、外部 MongoDB 和 GitHub Actions 均稳定通过 |

Day 1 之前，报表测试由测试代码直接签发 JWT，绕过了真实登录。它能验证报表和部分 RBAC，却不能证明登录签发的 Token 与后续验签契约兼容。

Day 2 之前，GitHub Actions 虽然声明了 `mongo:7` service，两个集成测试却始终自己启动 `MongoMemoryServer`。CI 是绿的，但它没有使用自己声明的数据库，并隐含依赖运行时下载 MongoDB 二进制。

## 3. 三个相对独立的职责层

```text
业务系统              验证系统                 执行系统
Node / Express        Jest / Supertest        GitHub Actions
JWT / RBAC            fixture / assertion     mongo:7 service
MongoDB               suite lifecycle         runner lifecycle

实现正确行为          证明关键行为正确          重复执行这份证明
```

测试与 CI 在思维目标上相对独立于服务端和数据库：场景选择、最小充分断言、证据边界、隔离、资源所有权和快速失败，换成 Java + PostgreSQL 仍然成立。

但它们在执行上不能脱离被测系统。只有理解 Token 在哪里签发、角色从哪里读取、Mongoose 何时初始化模型，才能设计有效测试并正确管理资源。

## 4. 本地 MongoDB 与 GitHub MongoDB 不是同一个实例

### 本地默认测试

```text
npm test
→ 没有 MONGODB_URI
→ 测试代码启动 MongoMemoryServer
→ Mongoose 连接临时数据库
→ tests
→ 断开连接并停止临时服务
```

若本地显式提供合法的 `MONGODB_URI`，测试会改走你自己启动的外部 MongoDB。这个实例由你负责启动和停止。

### GitHub Actions

```text
push / pull request
→ GitHub 创建临时 Ubuntu runner
→ test job 根据 services.mongodb 启动新的 mongo:7 容器
→ health check 通过
→ job 注入 MONGODB_URI
→ 测试连接 runner 的 127.0.0.1:27017
→ job 结束，容器与 runner 一起销毁
```

这里的 `127.0.0.1` 属于 GitHub runner，不是开发者电脑。GitHub 不会连接本机正在运行的 MongoDB，也不会把本机容器上传到远端。

## 5. 是否每次 push 都会创建 MongoDB service

按当前 `.github/workflows/ci.yml`，每次执行 `test` job 都会创建新的 `mongo:7` service container。准确单位是「一次 job 尝试」，不一定等于一个 commit：

- 一次 push 包含多个 commit，通常仍是一次 workflow run。
- 仓库内已有 PR 的分支继续 push，可能同时触发 `push` 与 `pull_request` 两次运行。
- 重新运行 job 会重新创建 service。
- `frontend` job 没有声明 MongoDB service，因此不会创建它。

当前没有路径过滤，只修改 Markdown 也会触发 `test` job。换来的保证是每次测试都从全新数据库服务开始，不继承前一次 CI 的运行状态。

## 6. Day 2 的细节为什么存在

`MONGODB_URI`、逻辑数据库后缀、`Model.init()` 和 teardown 顺序不是四个新主题，它们共同服务于一个目标：

> 测试结果不能被数据库来源、历史数据、suite 竞争或异步资源残留污染。

| 细节 | 解决的问题 |
|---|---|
| `MONGODB_URI` / `CI` 分工 | 明确连接目标，并在 CI 配错时快速失败 |
| `skillup_test_a` / `_b` | 两个 suite 共享 service，但不共享集合、文档和索引命名空间 |
| 等待 `Model.init()` | 防止测试结束清库后，迟到的模型初始化重新创建集合和索引 |
| teardown 所有权顺序 | 先释放 Mongoose 使用者，再停止本地内存数据库提供者 |

因此：

```text
--runInBand 只改变调度顺序，不提供数据隔离
测试全绿只证明断言通过，不自动证明资源已经清理
```

## 7. 与正式后端项目的边界

本仓库已经练习了正式工程中的真实思维模式，但仍是受控缩小版。

| 当前学习项目 | 正式项目还要承担 |
|---|---|
| 临时测试数据可以整体删除 | 真实数据迁移、备份、恢复与旧版本兼容 |
| 单个 Node.js 应用和 MongoDB | 多实例、并发、重试、外部依赖与部分故障 |
| 每次 CI 启动临时 MongoDB | 构建镜像、staging、发布审批、迁移和回滚 |
| 少量关键集成测试 | 契约、E2E、性能、安全及更大的回归矩阵 |
| 人工查看测试结果 | 日志、指标、trace、告警和事故响应 |

Compass 只是开发和排查数据库的图形客户端，不是生产运行链路。正式项目增加的主要是数据治理和运行责任，不是 Compass 操作数量。

## 8. 最小掌握口径

复盘这两天时，能脱离笔记讲清下面两句话即可先抓住主线：

1. Day 1 验证「代码行为可信吗」：真实登录 Token 必须能穿过认证与授权链。
2. Day 2 验证「验证过程可重复吗」：本地和 GitHub 各自获得独立数据库，并在完整生命周期后清理。

对外可以压缩为：

> 我为认证与授权主链补了真实集成测试，并让它在本地和 GitHub Actions 中使用隔离、可控的 MongoDB 环境运行，从而保证每次 push 都能重复验证关键行为。

## 9. 详细证据入口

- Day 1：[`day1-auth-flow-integration-testing.md`](./day1-auth-flow-integration-testing.md)
- Day 2：[`day2-ci-database-contract-and-test-lifecycle.md`](./day2-ci-database-contract-and-test-lifecycle.md)
- 周计划：[`week6-plan.md`](./week6-plan.md)
