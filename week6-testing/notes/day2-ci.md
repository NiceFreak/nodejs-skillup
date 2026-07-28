# W6 Day 2 · CI 数据库契约与测试资源生命周期

> 日期：2026-07-28
>
> 结果：已完成并通过远端 CI 验收
>
> 主线：让 CI 明确使用 `mongo:7` service，同时保持本地测试开箱可跑，并保证两个集成测试套件互不污染。

## 1. 今日目标与范围

### 目标

- 消除 CI 依赖 `mongodb-memory-server` 临时下载二进制的隐患。
- 明确 CI 与本地的数据库来源选择。
- 让两个集成测试套件在共享 MongoDB service 时仍拥有独立数据边界。
- 验证测试结束后没有数据库、集合或索引残留。

### 明确不做

- 不新增测试场景、fixture 或核心断言。
- 不追求覆盖率数字。
- 不抽取全局测试 setup 或共享数据库工厂。
- 不修改业务代码。

## 2. 起点：CI 看似跑绿，但数据库 service 没被使用

### 已验证事实

- Day 1 基线为 `3 suites / 9 tests` 全部通过。
- `.github/workflows/ci.yml` 启动了 `mongo:7`，并注入：

  ```text
  MONGODB_URI=mongodb://127.0.0.1:27017/skillup_test
  ```

- 两个集成测试原本都无条件启动 `MongoMemoryServer`，没有读取 `MONGODB_URI`。
- 因此 CI 中的 MongoDB service 实际空转；测试能通过，是因为 runner 当时可以下载并启动内存库二进制。

### 风险

这不是稳定的 CI 契约。受限网络可能让运行时下载失败，而流水线提供的固定 MongoDB 版本也没有真正参与验证。

## 3. 数据库来源：选择目标与限制回退是两个职责

最终确定三路契约：

| 条件 | 数据库来源 | 预期行为 |
|---|---|---|
| 存在 `MONGODB_URI` | 外部 MongoDB | 使用显式 URI，不启动内存库 |
| 缺少 URI，且 `CI` 为真 | 无 | 连接前快速失败，禁止静默回退 |
| 缺少 URI，且不是 CI | `MongoMemoryServer` | 本地默认路径，无需手动启动 MongoDB |

关键职责区分：

```text
MONGODB_URI：决定连接目标
CI：决定缺少外部 URI 时是否允许回退
```

这也是为什么简单的 `MONGODB_URI || memoryServerUri` 不满足契约：它会在 CI 配置错误时悄悄走回内存库，掩盖问题。

## 4. 为什么 `--runInBand` 不能提供数据隔离

两个集成测试都会创建 `admin@test.com`，而 `users.email` 有唯一索引。若它们共享 `skillup_test`：

- 并行执行可能发生跨套件写入与清理竞争。
- 串行执行只改变调度顺序，不会清除前一个套件留下的用户。
- 任一套件的 `Order.deleteMany({})` 只清理 `orders`，不能恢复整个数据库的初始状态。
- Jest 不保证测试文件顺序，因此不能把失败归因于固定的“第二个文件”。

结论：

```text
串行调度 != 数据隔离
测试通过 != 资源生命周期已经收口
```

## 5. 套件级逻辑数据库隔离

隔离边界最终设在逻辑数据库层：两个 suite 共享一个 MongoDB service，但连接不同的 `dbName`。

| Suite | 基础 URI | 独占数据库 |
|---|---|---|
| `monthly-sales.test.js` | `/skillup_test` | `skillup_test_a` |
| `auth-flow.test.js` | `/skillup_test` | `skillup_test_b` |

这里要精确区分：

- MongoDB service 是共享进程与端口。
- `skillup_test_a` / `skillup_test_b` 是同一 service 内的不同逻辑数据库。
- 集合、文档和索引命名空间彼此隔离，因此相同邮箱 fixture 不再冲突。

没有引入共享连接抽象。两个测试文件继续各自拥有连接、fixture 和清理生命周期，避免为了两个 suite 增加跨文件耦合。

## 6. 连接前安全门：先证明目标属于测试

外部路径不能仅凭“名字里含有 test”就取得写入和删除权限。最终使用的安全契约是：

1. 解析 `MONGODB_URI` 的路径。
2. 基础数据库名必须精确等于 `skillup_test`。
3. 每个 suite 只用自己的固定后缀生成目标 `dbName`。
4. 校验必须发生在 `mongoose.connect()` 之前。
5. 校验失败时不连接、不写 fixture、不清理，也不回退内存库。

为什么校验放在连接前：连接本身通常不会立刻创建数据库，但 Mongoose 连接后可能开始模型、集合和索引初始化。安全门放在所有数据库活动之前，边界更明确。

## 7. 生命周期：提供者晚于使用者关闭

### 外部 MongoDB 路径

```text
解析并校验基础 URI
→ mongoose.connect(..., { dbName })
→ 初始 dropDatabase，清除上次异常残留
→ 等待相关 Model.init()
→ 创建 fixture
→ 执行 tests
→ dropDatabase，删除本 suite 独占库
→ mongoose.disconnect()
```

### 本地内存库路径

```text
MongoMemoryServer.create()
→ mongoose.connect(memory URI)
→ 初始 dropDatabase
→ 等待相关 Model.init()
→ 创建 fixture
→ 执行 tests
→ mongoose.disconnect()
→ MongoMemoryServer.stop()
```

`MongoMemoryServer` 是连接依赖的提供者，Mongoose 是使用者。因此 teardown 必须先释放使用者连接，再停止服务。

## 8. 最难发现的问题：模型初始化晚于测试数据写入完成

第一次修正后，测试结果持续为绿，但重复检查发现 `skillup_test_a` 偶尔会重新出现，内容是空 `users` 集合及 `_id_`、`email_1` 索引。

### 已验证事实

- 外部并行测试连续运行时，曾在第 4 轮出现数据库残留。
- 残留不是业务文档，而是 Mongoose 模型对应的集合和索引。
- 增加明确初始化等待后，连续 5 轮外部测试均通过且无残留。

### 根因推断

```text
代码调用顺序：connect → 初始清库 → Model.init → fixture → tests → 最终清库 → disconnect
职责归属：Mongoose 根据 Schema 初始化集合与索引
返回值边界：fixture 写入 Promise 完成，不代表所有模型初始化任务都已完成
```

因此，测试套件必须在 fixture 之前等待本进程已注册且会参与测试的模型完成初始化：

- `auth-flow.test.js`：等待 `User.init()`。
- `monthly-sales.test.js`：等待 `User.init()` 与 `Order.init()`。

这里选择 `Model.init()`，因为生命周期责任是等待模型初始化整体完成；`ensureIndexes()` 只表达索引同步，语义更窄。

## 9. 验证证据

### 本地与模拟外部路径

- 本地默认并行：`3 suites / 9 tests` 通过。
- ESLint：`0 errors`，9 个既有 warnings。
- 外部 MongoDB 分支连续 5 轮：每轮 `3 suites / 9 tests` 通过。
- 每轮结束后均无 `skillup_test_a`、`skillup_test_b` 残留。
- CI 缺少 URI：连接前快速失败。
- 外部 URI 指向 `/production`：连接前快速失败。

### 远端 CI

- commit：`cd03cd230f22463c67bdf27009e44813b915043f`
- GitHub Actions：[CI run #257](https://github.com/NiceFreak/nodejs-skillup/actions/runs/30342990043)
- 结果：`completed / success`
- 后端 `test` job：成功。
- 前端 `frontend` job：成功。

## 10. 结论与剩余风险

### 今日完成

- CI 真正使用固定的 `mongo:7` service，不再依赖测试运行时下载 MongoDB 二进制。
- 本地仍可默认使用 `MongoMemoryServer`。
- 两个 suite 通过独占逻辑数据库消除 fixture 和清理冲突。
- 写入、模型初始化、清库、断连和停止服务的所有权顺序已经明确。
- 远端流水线已跑绿，Day 2 可以验收。

### 非阻断风险

`afterAll` 仍是顺序式清理：若 `dropDatabase()` 或 `disconnect()` 抛错，后续资源释放以及 `JWT_SECRET` 恢复可能被跳过。不改的实际代价是异常清理路径可能留下连接或环境变量；正常路径和 CI 路径已经稳定验证，本日不继续扩展。

## 11. AI 辅助与本人理解验证

- AI 辅助范围：以逐问方式 review 数据库来源、隔离边界、资源所有权和 Mongoose 初始化时序，并根据重复运行结果校准事实。
- 援助级别：L1 原理追问与 review；实现、测试生命周期调整和核心验证由本人完成，未新增学习债务。
- 本人理解证据：能够解释 `MONGODB_URI` 与 `CI` 的不同职责、`--runInBand` 为什么不等于隔离、suite 为什么需要独占逻辑数据库、以及 `Model.init()` 为什么必须位于初始清库与 fixture 之间。
- 延迟重建：本日未触发 L2，不新增强制重建项；后续复盘可脱离代码口述两条数据库来源路径和完整 teardown 顺序。

## 12. 下一入口

进入 W6 全栈 demo 接线：先列出前端现有 API 调用与后端真实路由的契约差异，再只打通最小可演示主链。
