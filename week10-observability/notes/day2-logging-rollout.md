# W10 Day 2（8/18）：日志改造并上线（本周第一个有副作用的日子）

> 建立：2026-08-18（Asia/Shanghai）
> 上游：[`day1-observability-contract.md`](./day1-observability-contract.md)（**契约已冻结，本文件不重开任何已拍板的题**）、[`week10-plan.md`](./week10-plan.md) §4 D2 / §6 / §9
> 形态参考：W9 [`day5-rebuild-closeout.md`](../../week9-deployment/notes/day5-rebuild-closeout.md) §10「变更单四要素 + 六项验证」
> 状态：**计划已就绪，未执行**。本文件由 AI 起草（计划分析 + 文档整理 + 配置语法，属白名单）；§3 的五个问题与 §2 的发布顺序由本人拍板，AI 只 review。

---

## 1. 今日唯一主线与验收句

**主线**：把 D1 冻结的观测契约，从纸面变成**线上正在跑的形态**——一次公网请求在 Nginx 与 Node 两条日志流里被同一个 id 串起来，且登录请求的密码在任何一条日志里都查不到。

**验收句（D1 §8 已写死，今天不改一个字）**：

> 从公网发一次请求，能用这一个 id 在 Nginx 日志和 Node 日志里各查到一条记录，且响应头里带着它；
> 一次真实登录请求的日志里，查不到密码或完整 token。

**今天与 D1 的根本差别**：D1 的止步条件是「不装库、不改配置、不注入故障」；
**今天这三条全部解禁**，但解禁的代价是**每一个动作都必须先挂在变更单上**——
D1 是「想清楚再写下来」，D2 是「写下来再动手」。

**今天不是排障日**。四类故障演练在 D4；今天任何一次红灯都不是练习题，是真事故，按 §7 止步。

---

## 2. 变更单（动手前冻结，四要素）

### 2.1 改动清单 —— 今天就这九项，别的都不动

> 「改动清单 = 边界」的意义在 W9 已经验证过：90% 的生产事故从「顺手改一下」开始。
> 第 4 列是 `week10-plan.md` §6 的黑白名单落到具体文件，**不是今天临场裁量的**。

| # | 层 | 文件 / 对象 | 改什么 | 归属与谁实现 |
|---|---|---|---|---|
| 1 | 依赖 | `week2-express/src/package.json` | `npm i pino`（进 `dependencies`，不是 dev——服务器用 `--omit=dev` 装） | 白名单，AI 可直接给命令 |
| 2 | 代码 | 新增 `week2-express/src/config/logger.js`（或同层） | pino 实例：`level` / `timestamp: isoTime` / `redact` 清单（取值来自 D1 §5.1，不重新设计） | **配置样板白名单**，AI 给骨架；redact 路径逐条对 D1 清单，本人核 |
| 3 | 代码 | `week2-express/src/app.js` 第 17–28 行 | 重写请求日志中间件：九个必有字段 + `finish`/`close` 去重 + 响应头回写 `X-Request-Id` | **黑名单**：本人实现，AI 只 review |
| 4 | 代码 | `week2-express/src/app.js` 第 51–88 行 error handler | 用 pino 替换 `console.error`，并带上同一个 requestId + 错误类名（非 message） | **黑名单**：本人实现，AI 只 review |
| 5 | 代码 | `week2-express/src/app.js` | 新增 `/health` 探针（Q8 收口项），位置在 `/users` 路由之前 | 黑名单（判据由 §3 P3 定），本人实现 |
| 6 | 代码 | `week2-express/src/server.js` | 生命周期 `console.log` / `console.error` 换 pino（启动 / 关停 / 启动失败） | 白名单（机械替换），本人执行，AI 可给对照 |
| 7 | 工具配置 | `week2-express/src/eslint.config.js` | 加 `no-console`（把「禁止裸 console.log」从纪律变成机器强制，D1 §5.1 强制层） | 白名单，AI 可直接实现 |
| 8 | 服务器 | `/etc/nginx/nginx.conf`（http 块）+ 四份 site | ① 定义 `log_format`（含 `$request_id` + `$time_iso8601` + `$request_time`）；② 每个 **proxy location** 加 `proxy_set_header X-Request-Id $request_id`（数量见 §2.3） | 白名单（Nginx 语法），AI 出配置，本人执行 + 核输出 |
| 9 | 服务器 | `/etc/systemd/journald.conf` | `SystemMaxUse=500M`（D1 Q2③，依据基线 248M） | 白名单，AI 出命令，本人执行 |

**顺带项（W9 遗留，`week10-plan.md` §9）**：把 Nginx 本地副本补齐——
详见 §2.4，**它已经从「顺带」升级为改动清单的一部分**。

**明确不在清单内**（写下来是为了防蔓延）：不改任何业务逻辑、不动鉴权（Q8 已收口）、
不碰 8081 展板产物、不写检查脚本（D3）、不注入任何故障（D4）、不装 node_exporter。

### 2.2 执行顺序（本人拍板，见 §3 P5）

两种顺序各有代价，**不能都要**：

| 顺序 | 好处 | 代价 |
|---|---|---|
| **甲：先 Nginx，后 Node** | Nginx 改动与 Node 完全解耦，可独立 reload、独立回滚；改完先看到 access.log 里出现 `$request_id`，Node 还没上线也不影响任何面 | 中间态存在一段「Nginx 传了 header，Node 不认」的时间——无害（Node 只是忽略未知头），但验证 ⑤ 要等两边都上完才能做 |
| **乙：先 Node，后 Nginx** | 代码本地已全绿，上线即可验证响应头回写 | 中间态 `req.headers['x-request-id']` 为空——**必须先想清楚 id 缺失时中间件怎么办**（记空串？本地兜底生成？），否则这段时间的日志字段是残缺的 |

> **AI review 意见（不是答案）**：乙的中间态逼你回答一个 D1 没答的问题——
> 「Nginx 没传 id 时 Node 记什么」。这个问题**无论选哪个顺序都必须答**，因为它同时是 D4 反代演练的现场（请求绕过 Nginx 直连 3000 时也没有 id）。
> 选甲能把它推迟，选乙会当场逼出来。

> 答（本人，2026-08-18）：**选甲：先 Nginx，后 Node**。理由：两个改动层完全解耦、可独立 reload/回滚；
> 甲的唯一代价「Nginx 传了 id、Node 不认」无害（Node 忽略未知头，访问日志已先出现 `$request_id`，
> 且验证 ⑤ 等两边都上完再做）；而乙的中间态「id 缺失」必须在发布时刻当场决策，不如现在就在
> 代码里把「id 缺失时记什么」写死（见 §3 P5 答），让两种路径的日志口径都确定后再上线。
> → 发布顺序 = **先 Nginx（reload，无业务影响）→ 后 Node（restart nodeapp）**。
>
> （P1/P2/P5 答案见 §3，此处只拍顺序。）

### 2.3 一个执行期的精度问题：要改的不是「四份 server 块」，是九个 location

D1 §5.1 写的是「四份 server 块全部加 `proxy_set_header X-Request-Id $request_id`」。
按 W9 笔记复原出的四份 site 形态，**真正需要加的是每一个反代 location**：

| site（端口） | 反代 location | 静态 location | 需要加 header 的处数 |
|---|---|---|---|
| `shop`（80） | `= /`、`/auth`、`/reports` | — （`location / { return 404; }`） | 3 |
| `shop-ssl`（443） | `= /`、`/auth`、`/reports` | `/admin/`（alias） | 3 |
| `shop-admin`（8080） | `/auth`、`/reports` | `root dist` | 2 |
| `shop-showcase`（8081） | `/auth` | `root dist-showcase` | 1 |
| | | | **合计 9** |

- **事实**：443 那份来自本地副本 [`shop-ssl.conf`](../../week9-deployment/notes/shop-ssl.conf)，逐行可读。
- **推断**：80 / 8080 / 8081 三份的形态来自 W9 笔记（`day4b` §A5 冻结形态、`day4c` 步骤 5），**本地没有副本**。
  → **块 A 第一件事就是把这三份 `cat` 出来核对**，把「推断」升级成「事实」再动手（`LEARNING-PROTOCOL.md` §4）。

#### 块 A 核对结论（2026-08-18，已执行，推断 → 事实）

**① 上表 9 个反代 location 与服务器实际逐条一致**（`cat /etc/nginx/sites-available/{shop,shop-ssl,shop-admin,shop-showcase}`）。四个反代 location 全部带 `proxy_set_header Host $host;`——P1 的「location 级屏蔽」前提成立。

**② access_log 四份共用一个文件**：所有 server 块都没有自己的 `access_log` 指令；
`nginx.conf` http 块只有一份 `access_log /var/log/nginx/access.log;`（error.log 同理）。
→ **改动 #8 的 `log_format` 只需改 nginx.conf 一处**；`proxy_set_header X-Request-Id` 仍须在 9 个 location 各加（location 级指令族屏蔽 http/server 级，`nginx -t` 不报错）。

**③ 其他核对事实**：
- `sites-available/default` 未启用（不在 sites-enabled，仅 4 个软链：shop / shop-admin / shop-showcase / shop-ssl）。
- `shop.bak`（424B，8/14）与 `shop` 内容一致 = 回滚基线仍有效。
- `shop-ssl` 属主 **ubuntu**（非 root），与 8/14 admin 迁 443 时由 ubuntu 身份写文件的痕迹一致。
- 服务器 shop-ssl 与本地副本 [`shop-ssl.conf`](../../week9-deployment/notes/shop-ssl.conf) 仅差一行注释（服务器无「2026-08-14 更新」注释行），主体逐行一致。
- `nginx.conf` 无自定义 `log_format`、`server_tokens` 已注释（默认开，暴露版本号——非今日改动项，记入 D5 展板核谎候选）。

**为什么不能图省事写在 server 级**（这是本条真正的学习点，也是 §3 P1 要拍的）：
Nginx 的 `proxy_set_header` 是**「当前层一旦出现同名指令，就整体屏蔽上层的这一族指令」**，不是逐条合并。
现有每个反代 location 里都写着 `proxy_set_header Host $host;`——
把 `X-Request-Id` 单独放到 server 级，这些 location 会因为自己有 `proxy_set_header` 而**整个不继承** server 级的那一族，
结果是：配置看着加了，实际一个面都没生效，而且 `nginx -t` 完全通过。
**这是「配置改了但没生效」的经典形态：语法检查过不代表语义生效**，只有验证 ④⑤ 能证伪它。

### 2.4 Nginx 本地副本：只同步一份等于新造三个不可追溯点

W9 遗留项写的是「同步 `shop-ssl.conf` 本地副本」。但今天要改的是**四份 site + `nginx.conf`**，
如果仍然只同步 443 那一份，改完之后仓库里就有**三份被改过、却在 git 里没有任何形态记录**的配置——
比 W9 的遗留状态更糟（W9 至少还有一份是准的）。

**因此本日的处置**：`week9-deployment/notes/` 下补齐 `shop.conf` / `shop-admin.conf` / `shop-showcase.conf`
（或统一挪到 `week10-observability/notes/nginx/` 下，命名由本人定），
加上 `nginx.conf` 的 `log_format` 片段，**四份 + 1 = 唯一可追溯保存点**。
**这也是回滚预案的物质基础**：§6 的 Nginx 回滚依赖服务器上的 `.bak`，而本地副本是「服务器和备份一起丢了」时的最后一层。

### 2.5 验证 = 可证伪实验（七项，逐项写死期望）

> W9 是六项，今天是七项——多出来的一项是 ⑤，本次发布的**唯一新能力**（两条流被串起来）。
> 每一项都必须先写期望值再跑；没有期望的验证只是「看了看」。

| # | 验证 | 在哪跑 | 命令 / 动作 | **期望值** | 期望来源 | 覆盖层 |
|---|---|---|---|---|---|---|
| ① | 结构化输出成形 | 本地 | 起本地服务 + `curl localhost:3000/` | stdout 出现**一行** NDJSON，D1 §5.1 九个必有字段齐；不是 pretty 文本 | Q1 字段契约 + Q2② 落点 | 应用层格式 |
| ② | **脱敏实测** | 本地 | 真实 `POST /auth/login`（真密码）后，在输出里 `grep` 该密码串与完整 token | **0 命中**；`authorization` 若出现则为 `[REDACTED]` | Q3 脱敏清单 | 安全边界 |
| ③ | 断连补记 + 去重 | 本地 | 正常请求一次；再 `curl --max-time 0.05` 打一个慢接口制造断连 | 正常请求**恰好 1 条**（finish）；断连请求**恰好 1 条**且 `请求状态=close` | Q1 实现纪律（每请求至多一条） | 当前盲区是否消除 |
| ④ | 响应头回写 | 公网（部署后） | `curl -D- -s -o /dev/null https://43-128-154-242.sslip.io/` | 响应头含 `X-Request-Id: <32 位十六进制>` | Q4④ 回写决策 | 反代 → 应用 贯通 |
| ⑤ | **一个 id 串两条流**（本次唯一新能力） | 服务器内 | 取 ④ 拿到的 id：`grep <id> /var/log/nginx/access.log` 与 `journalctl -u nodeapp \| grep <id>` | **两边各恰好 1 条** | D1 §5.2 日志旅程 | 本次发布验收核心 |
| ⑥ | 三层基线回归 | 公网 + 服务器 | D1 §4.5 Q14 三层：五面 curl + `curl -f 127.0.0.1:3000/health` + `systemctl is-active nginx nodeapp` | 80=200、443=200/verify 0、443 `/admin/`=200、8080=200、8081=200；`/health`=200；两服务 active | W9 收口证据（对照组） | 旧面不破 |
| ⑦ | journald 上限生效 | 服务器 | `systemd-analyze cat-config systemd/journald.conf \| grep -i SystemMaxUse` + `journalctl --disk-usage` | 配置项可见 = `500M`；占用仍在 500M 以内（基线 248M） | Q2③ + §5.5 基线 | 存储边界 |

**两个关键设计点**（对应 W9 §10.3 的同名段落）：
- **⑤ 必须在服务器内跑**——Nginx 的 access.log 与 journald 都不出本机，这条验证没有公网形态；
  它也是唯一能证伪 §2.3「header 写在 server 级会被屏蔽」的实验。
- **② 必须用真实登录请求**，不能用构造的假 body——契约要防的是**真实链路**里的泄漏，
  而 pino 的 `redact` 只在「确实把 `req` 记进了日志」时才生效；契约的第一层拦截其实是**根本不记 body**，
  redact 是第二层。②同时验证这两层。

### 2.6 回滚 = 失败前置（动手前写好，见 §6）

### 2.7 止步条件 = 止损线（见 §7）

---

## 3. 动手前必须先答的五个问题（D1 没覆盖，执行期才暴露）

> 这些不是重开已冻结的契约，是**契约落到具体配置时才出现的新缺口**。
> 按 `AGENTS.md`：属信任边界 / 口径 / 分层归属，**AI 只提问和 review**，答案由本人写在 `> 答：` 下。
> 五题答完再进块 C，否则会出现 D1 最怕的情况——**写错的观测在明天变成假事实**。

### P1（配置语义）`proxy_set_header` 加在哪一层？

现有九个反代 location 每一个都写了 `proxy_set_header Host $host;`。三个选项：
(a) 九处逐个加 `X-Request-Id`；(b) 把 `Host` 和 `X-Request-Id` 一起提到 server 级、location 里全部删掉；
(c) server 级只加 `X-Request-Id`，location 保持不动。

必答追问：**(c) 会发生什么**，你怎么在不看文档的情况下证伪它？（提示：验证 ⑤，不是 `nginx -t`）
以及：选 (b) 意味着**动了 W9 已收口的四份配置的公共部分**，这与「改动清单越小越好」冲突——你怎么权衡？

> 答（本人，2026-08-18）：**选 (a) 九处 location 逐个加 `X-Request-Id`，不做任何上提或删改。**
>
> 理由：现有每个反代 location 都有 `proxy_set_header Host $host;`，按继承规则，location 里一旦出现
> `proxy_set_header` 一族，父级定义的全部失效。(c) 是假生效——配置看着有，实际跑到 location 就被屏蔽，
> `nginx -t` 还查不出来，唯一能发现是验证⑤（上线后 journald 里 grep 不到 id，白干还要回滚）。
> (b) 虽然能生效，但代价是「加一行」变成「删九行 + 加两处 server」，扩大改动面、动了 W9 已收口的
> 公共结构，还给未来埋「忘了 location 里不能写 Host」的同款坑。
> **取舍**：重复但清晰（每处写死 Host + X-Request-Id，看配置一眼知道传了什么头、不依赖继承语义），
> 优于减少重复但引入隐蔽屏蔽风险。与「改动清单最小化」原则自洽。
>
> **AI review（2026-08-18）**：✅ 正确。核心命中「location 级指令族屏蔽」的机制、`nginx -t` 只查语法
> 不查语义、验证⑤是唯一证伪手段；(b) 的代价分析（改动面扩大 + 未来踩坑种子）成立。

### P2（时间口径）`$time_iso8601` 不是 UTC

D1 Q6 拍板「全部 UTC」，衔接点写的是「Nginx `$time_local` → `$time_iso8601`（UTC）」。
**执行期事实**：`$time_iso8601` 输出的是**带偏移量的本地时间**（本机 TZ 为 CST，因此形如 `2026-08-18T10:00:00+08:00`），
不是 `Z` 结尾的 UTC。而 Node 侧 pino 的 `isoTime` 输出的是**真 UTC**（`...Z`）。
**照原样做完，两条流的时间戳仍然不是同一个口径**——只是从「无法比较」变成「可机械换算」。

三个选项：
(a) 接受 `+08:00`——偏移量显式写在每行里，不会被误读，代价是排障时人要自己做减法；
(b) 给 nginx 单元设 `Environment=TZ=UTC`，让 `$time_iso8601` 渲染成 UTC——代价是**动了 systemd 单元**，
   且 error.log 的时间戳也会跟着变（它不受 `log_format` 控制）；
(c) 保留 `$time_local`，在 Q6 的口径声明里改成「Nginx 本地时间 / Node UTC，换算关系写进 runbook」。

必答追问：D1 Q6 的原始目的是「三个月后的自己不会把这个差当成新 bug」。
上面哪一个最能达成这个目的——**是让时间戳一致，还是让差异显式且有据可查**？

> 答（本人，2026-08-18）：**选 (a) 接受 `$time_iso8601` 带 `+08:00` 偏移，不设 TZ=UTC，也不用 `$time_local`。**
>
> 理由：D1 Q6 的目的不是让两边数字长得一样，而是让排障的人不把 8 小时差误当 bug。
> `+08:00` 显式写在每行，一眼知道是北京时间；配合 runbook 写死「Nginx 用北京（+08:00）、Node 用 UTC
> （Z），换算减 8 小时」，三个月后的自己看到两条时间不同，第一反应是去对偏移量，不是查 bug。
> (b) 确实让输出变 Z 与 Node 一致，但代价是动 systemd 单元 + error.log 跟着变 UTC，而系统其余部分
> （`date`、其他服务日志）仍是 CST——把「Node vs Nginx 的差」换成了「Nginx vs 系统其余部分的差」，
> 复杂度没消失只是转移，还多一条长期维护规则。(c) 最差：非标准格式 + 偏移量缩在行尾人眼易漏 + 机器
> 解析麻烦。**改动最小、不碰系统级设置、符合今日「只改 log_format」的边界**。
>
> **AI review（2026-08-18）**：✅ 正确。核心命中「目标是差异可识别而非数字一致」、「(b) 只是把不一致
> 转移到别处」、(c) 三重缺陷（非标准/易漏/难解析）。与 D1 Q6 的意图自洽。

### P3（探针语义）`/health` 检查到哪一层

D1 Q8 定的是「`systemctl is-active` + `curl -f /health` 两层判」，理由是「进程在但不干活」单靠 systemd 查不出。
但「不干活」有两种：**HTTP 层不响应**，和 **Mongo 断了但 HTTP 还能答**。三问：

① `/health` 只回 `200 {status:'ok'}`，还是要读 `mongoose.connection.readyState`？
   （若不读，D3 的「进程存活」检查对「Mongo 挂了」这类完全失明；若读，Mongo 抖动会让检查红灯闪烁——**告警的可操作性标准，D1 §2.4.6**）
② `/health` 要不要记日志？D3 的 timer 会周期性打它——每分钟一次 = 1440 条/天，
   这与 Q2③ 的 500M 上限、Q9 的磁盘红线**必须自洽**（这是 D1 冲突自查②的同型问题）。
③ `/health` 要不要经 Nginx 暴露到公网？（现状：80/443 的 `location / { return 404; }` 会把它挡住，
   即**什么都不做它就只在 127.0.0.1 可见**。这是收益还是缺陷？）

> 答（本人，2026-08-18）：
>
> **① 不读 `mongoose.connection.readyState`，只回 `{status:'ok'}`。**
> 理由：Mongo 挂了时我的「动作」是什么？既不能重启 Mongo、应用层也修不了，重启 nodeapp 无济于事——
> 「知道了但没法立刻动手」的告警不符合 D1 §2.4.6 可操作性标准。反之 HTTP 层卡死时 `/health` 会超时，
> 我的动作是「重启 nodeapp」，可操作。Mongo 挂了靠业务请求的 500 + error handler 的 errType 去发现。
> **取舍留痕（防误判）**：`/health` 不覆盖 Mongo 是有意为之不是遗漏——D3 四项检查不含 Mongo 状态，
> Mongo 属「业务 500 暴露」路径，不扩探针职责。
>
> **② 记日志，级别敲定为 `debug`（AI review 敲定，采纳）。**
> 算术：~300B/条 × 1440 条/天 ≈ 0.4MB/天 → 500M 够 ~1000 天，容量无虞。但探针是**机器行为**、非
> D1 Q5 定义的「正常业务事件」，用 info 每分钟刷 1440 条会稀释 journald 里的真实请求日志；debug 后
> 默认 `LOG_LEVEL=info` 探针不出现，排障才开 debug，与 Q5 级别口径自洽。
>
> **③ 不暴露公网，保持现状（只在 127.0.0.1 可见）。**
> D3 检查脚本在本机跑，`curl 127.0.0.1:3000/health` 足够；暴露公网会泄露「应用活着 + 依赖是否正常」
> 两个有情报价值的布尔值。不暴露 = 少一个攻击面，与 Q8「3000 仅 loopback」信任边界一致。将来有
> 「公网健康检查」需求再单独走变更单。
>
> **AI review（2026-08-18）**：✅ ①与 D1 Q8 冻结判据一致、可操作性推理成立；②算术正确，级别敲定
> debug 与 Q5 自洽（防探针淹没真实请求日志）；③与 loopback 信任边界一致。「/health 不覆盖 Mongo」
> 的取舍留痕必要，已写入本答。

### P4（中间件正确性）监听注册的位置

现有代码（`app.js` 第 17–28 行）是 `next()` **之后**才 `res.on('finish', ...)`。
今天要加的两件事——`close` 兜底与**响应头回写 `X-Request-Id`**——对注册时机的要求不一样：

- 响应头**必须在响应头发出之前**写（即 `next()` 之前）；
- 事件监听放在 `next()` 之后，依赖「`finish` 事件不会在 `next()` 同步返回前触发」这个**隐含假设**。

必答追问：① 这个假设在什么情况下会不成立，你打算怎么把它变成不需要假设的写法？
② 计时起点 `Date.now()` 应该在 `next()` 前还是后，为什么（对照 D1 §2.2 第 1 条的 duration 口径）？

> 答（本人，2026-08-18）：
>
> **① 监听注册全部放 `next()` 之前**：入口先 `setHeader`（回写 X-Request-Id）→ 挂 `finish`/`close`
> 监听 → 最后 `next()`。这样监听不依赖 `next()` 是否同步返回、是否被短路跳过、是否同步抛错——
> 无论上游中间件做什么，监听已挂上，日志必有。「隐含假设」被消除成「无论发生什么，监听都在」。
>
> **② 计时起点 `Date.now()` 在 `next()` 之前（中间件入口处）。**
> 依据 D1 冻结的 duration 口径「中间件入口 → finish」——要覆盖路由处理、异步 I/O、响应组装整段；
> 放 `next()` 之后会漏掉路由处理器执行时间，duration 就不准。
>
> **③ 实现提醒（AI review 补充）**：响应头回写必须用**最终决定的 requestId**——即「header 里有就用
> header 的，没有就用 P5 的 local 兜底」，回写值与日志记的值一致，否则客户端拿到的响应头 id 与日志
> 对不上（P5 敲定 local 兜底后这是必须处理的分支）。
>
> **AI review（2026-08-18）**：✅ ①「提前注册」消除对 `next()` 行为的依赖，正确；②与 D1 duration
> 口径完全对齐；③补充的实现提醒成立。

### P5（发布顺序）先 Nginx 还是先 Node

见 §2.2 的两行对照表。附带必须一起答的那个问题：
**Nginx 没传 `X-Request-Id` 时，Node 记什么**（空串 / 缺字段 / 本地兜底生成一个）？
这不是假想——D4 的反代演练、以及任何一次 `curl 127.0.0.1:3000` 直连都会走到这条路径。

> 答（本人，2026-08-18）：**发布顺序选甲（先 Nginx，后 Node），已在 §2.2 固化。**
>
> **id 缺失时：本地兜底生成一个，格式敲定为 `local-<crypto.randomUUID()>`。**
> 理由：
> - **空串 / 缺字段**违反 D1 §5.1「九必有字段」契约，且 `grep ""` 匹配一切无法定位。
> - 本地兜底生成让 requestId 永不缺席；**格式带 `local-` 前缀**与 Nginx 的 32 位 hex 一眼可辨——
>   排障时拿它去 Nginx access.log grep 不到，第一反应是「看格式：local 开头 = 没走反代」，
>   不会误判成日志丢失。这正是 P5 要求的「三个月后自解释」。
> - 日志可选加扩展字段 `requestIdSource: 'nginx' | 'local'`（不占九字段核心位，同「入口端口」
>   可选字段的待遇），需要时开 debug 级可查。
> - 响应头回写同样回写这个最终 id（见 P4③ 实现提醒）。
>
> **用例落点**：D4 反代演练（Nginx 把请求挡掉或改错）、`curl 127.0.0.1:3000` 直连、以及发布中间态
> 都会走到 `local-` 分支——日志形态在发布前已确定，不存在「上线后才发现字段残缺」。
>
> **AI review（2026-08-18）**：✅ 三选项里最自洽——九字段永不缺席 + `local-` 前缀格式天生可辨来源、
> 无需靠记忆理解「为什么这条 id 在 Nginx 里找不到」；`requestIdSource` 作为扩展字段与 D1 §5.1
> 「入口端口可选字段」同款待遇，不膨胀核心契约。发布顺序选甲与 §2.2 一致。

---

## 4. 今日时间盒

| 块 | 时长 | 内容 | 产出 / 收工判据 |
|---|---|---|---|
| A | 25 min | **只读核对**：`cat` 服务器四份 site + `nginx.conf` 的 http 块；本地重读 `app.js` 17–28 / 51–88 行 | §2.3 的表从「推断」变「事实」；确认 access_log 是四份共用一个文件还是各自分开（决定 #8 是改一处还是四处） |
| B | 20 min | 答 §3 的 P1–P5，冻结 §2 的执行顺序 | 五题有答案；变更单不再有空格 |
| C | 45 min | **本地**实现 #1–#7 并跑验证 ①②③ | 三项本地验证全过；**②不过就地停，不上线** |
| D | 20 min | 写 Nginx 与 journald 的改动（**先写本地副本，再改服务器**）；服务器侧先 `cp *.bak` | 备份存在（`ls -la` 见 `.bak`）；本地副本已成文 |
| E | 40 min | 部署：`git push` → 服务器 `pull` → `npm install --omit=dev` → `nginx -t` → reload → `restart nodeapp`；跑验证 ④⑤⑥⑦ | 四项全过；任一不过按 §6 回滚 |
| F | 20 min | 补齐四份 Nginx 本地副本（§2.4）+ `git status` 核对无敏感信息 + commit | 仓库内可追溯；`.env` 值无泄漏 |
| G | 20 min | 收口：本笔记补「实际发生了什么」、`week10-plan.md` D2 勾选、`LEARNING-STATE.md` 更新、口语稿 | D2 收口 |

合计约 3 小时 10 分。**块 C 的②与块 E 的⑤是今天两个不可让步的点**，其余项时间不够可顺延到 D3 早段。

---

## 5. 执行细节（白名单部分，命令与语法）

> 本节只放**换个库 / 换个反代就不成立**的纯工具细节。取值一律来自 D1 契约，不在这里新造。

### 5.1 依赖与本地起服务

```bash
cd week2-express/src
npm i pino                 # 进 dependencies（服务器用 --omit=dev 安装）
npm run dev                # node --env-file=.env --watch server.js
```

### 5.2 pino 实例的配置面（骨架，取值对 D1 §5.1 逐条核）

```js
// redact 是第二层：只有当日志里真的出现了 req.* 这些路径时才生效。
// 第一层是契约本身——根本不把 body 记进日志。
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime, // ISO8601 UTC，Z 结尾（对照 P2）
    redact: {
        paths: [
            'req.body.password',
            'req.headers.authorization',
            'req.headers.cookie',
            // 其余路径按 D1 §5.1「永不入日志清单」补齐
        ],
        censor: '[REDACTED]',
    },
});
```

`redact` 的路径写法、`censor`、`isoTime` 属 API 拼写（白名单）；
**哪些路径进这个数组是 D1 已冻结的契约，不在今天重新讨论。**

### 5.3 eslint 强制「禁止裸 console.log」

在 `week2-express/src/eslint.config.js` 的 rules 里加 `'no-console': 'error'`，
把 D1 §5.1 的「纪律」变成 `npm run lint` 会失败的机器约束。
（若 `seed*.js` / `perf/` 等脚本确实要打印，用目录级 override 放行，**但 `src` 主链路不放行**。）

### 5.4 Nginx（语法白名单，位置与数量由 §2.3 / P1 决定）

```nginx
# /etc/nginx/nginx.conf 的 http { } 内
log_format obs '$time_iso8601 rid=$request_id $remote_addr "$request" '
               '$status $body_bytes_sent rt=$request_time "$http_user_agent"';
```

```nginx
# 反代 location 内（数量见 §2.3；层级见 P1）
proxy_set_header X-Request-Id $request_id;
```

`$request_id` 是 Nginx 内置变量（1.11.0+，每请求一个 32 位十六进制），无需额外模块。
`rt=$request_time` 与 Node 的 duration 是**两个口径**（D1 Q6），前缀写死是为了排障时不会看串。

改完的固定三连（**顺序不可换**）：

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak.20260818
sudo nginx -t                     # 语法检查；非零绝不 reload（§7）
sudo systemctl reload nginx       # reload 不断连，不用 restart
```

### 5.5 journald 上限

```bash
sudo cp /etc/systemd/journald.conf /etc/systemd/journald.conf.bak.20260818
sudo sed -i 's/^#\?SystemMaxUse=.*/SystemMaxUse=500M/' /etc/systemd/journald.conf
grep -n '^SystemMaxUse' /etc/systemd/journald.conf                 # 确认写进去了
sudo systemctl restart systemd-journald
systemd-analyze cat-config systemd/journald.conf | grep -i systemmaxuse   # 确认生效值
journalctl --disk-usage
```

> 经验知识（AI 直接讲，不要求先猜）：`SystemMaxUse` 改完**不是必须 restart**——
> journald 会在下一次写入时按新上限自行裁剪；restart 只是让它立刻按新值收敛，
> 且**不会丢已有日志**（持久化在 `/var/log/journal`）。这里 restart 是为了让验证 ⑦ 当场可测。

### 5.6 部署（身份边界见 [`server-permission-cheatsheet.md`](../../week9-deployment/notes/server-permission-cheatsheet.md)）

```bash
# 发布前先记下回滚锚点（§6 依赖它）
sudo -iu nodeapp bash -c 'cd ~/nodejs-skillup && git rev-parse HEAD'

sudo -iu nodeapp bash -c 'cd ~/nodejs-skillup && git fetch origin && git pull'
sudo -iu nodeapp bash -c 'cd ~/nodejs-skillup/week2-express/src && npm install --omit=dev'
sudo systemctl restart nodeapp && systemctl is-active nodeapp
```

**W9 踩过的三个坑不要再踩**：服务器 git 必须用 `nodeapp` 身份（dubious ownership / FETCH_HEAD 权限）；
scp 目标目录要先建；静态用 `alias` 不是 `root`。

---

## 6. 回滚预案（三层独立，动手前写好）

> 分三层是因为**三层可以分别失败**。W9 的教训是「panic 时不做设计」——下面每条都可以照抄执行。

| 层 | 触发条件 | 回滚命令 | 回滚后期望 |
|---|---|---|---|
| **Node 代码** | 验证 ④⑤ 不过、或 ⑥ 里任一面从 200 变红、或日志里查到密码 | `sudo -iu nodeapp bash -c 'cd ~/nodejs-skillup && git checkout <发布前 HEAD>'` → `npm install --omit=dev` → `sudo systemctl restart nodeapp` | 五面回到 W9 基线；日志回到 `logger: GET /... 200 12 ms` 形态 |
| **Nginx** | `nginx -t` 非零；或 reload 后任一面异常 | `sudo cp /etc/nginx/nginx.conf.bak.20260818 /etc/nginx/nginx.conf`（site 同法）→ `sudo nginx -t` → `sudo systemctl reload nginx` | 五面全绿；access.log 回到默认 combined |
| **journald** | 改完后 `journalctl` 写不进 / 服务异常 | `sudo cp /etc/systemd/journald.conf.bak.20260818 /etc/systemd/journald.conf` → `sudo systemctl restart systemd-journald` | `journalctl -u nodeapp -n 5` 有新行 |

**三层的独立性是设计出来的**：Node 回滚不需要动 Nginx（Nginx 多传一个头，旧代码只是忽略它）；
Nginx 回滚不需要动 Node（Node 拿不到 id，按 P5 的答案降级）。
**如果你的实现让这两层必须一起回滚，说明耦合写高了**——这是 review 时要看的一条。

---

## 7. 止步条件（止损线）

任一条出现，**立即停止推进，执行 §6 对应层的回滚**，当天转入排查与记录：

1. `nginx -t` 返回非零 —— **绝不 reload**（语法错误的配置 reload 下去，五个面一起没）。
2. 验证 ② 在本地就查到了密码或完整 token —— **不上线**，先修契约实现，这是安全边界不是功能缺陷。
3. 验证 ⑥ 里任一公网面在**回滚之后仍然**不是 200 —— 回滚未生效，停手排查，不叠加新改动。
4. 同一个问题连续两次修改仍未解决 —— 停止「修 A 弄坏 B」的连锁，回到发布前状态再想。
5. **时间止步 17:00** —— 到点不再新增任何服务器变更；已完成的部分计入验收，未完成顺延 D3 早段
   （D3 的四项检查依赖今天的 `/health`，因此 `/health` 与验证 ⑥ 优先于 ⑤ 之外的其他项）。

**不构成止步的情况**（写下来防止过度保守）：日志字段少了一个可选字段、Nginx 日志格式不好看、
`$time_iso8601` 带偏移量（P2 的已知取舍）——这些记进笔记，不阻断发布。

---

## 8. 今日明确不做

- 不写任何检查脚本、不建 `systemd timer`（**D3**）。
- 不注入任何故障——包括「就试一下 `systemctl stop nodeapp` 看告警」（**D4**；今天连告警都还没有）。
- 不装 node_exporter / Prometheus / Grafana（stretch，常驻内存上限 ≤80MB，且要先量）。
- 不改任何业务逻辑与鉴权（Q8 已收口），不动 `week8-fullstack` 前端与 8081 展板产物。
- 不做日志采样、不做 trace、不引 pino transport 写文件（落点已定 journald）。
- 不下线 8080、不碰 Java / Python。

---

## 9. AI 协作边界（本日形态）

| 归属 | 今天具体是什么 |
|---|---|
| **AI 可直接给（白名单）** | `npm i pino` 与安装参数；pino 实例的 API 拼写（`redact` / `censor` / `isoTime`）；eslint `no-console` 规则；`log_format` / `proxy_set_header` / `$request_id` 的 Nginx 语法；journald 配置项与 `systemd-analyze cat-config` 用法；部署与回滚的命令拼写；本文件这类文档整理 |
| **本人实现，AI 只 review（黑名单，上限 L2）** | `app.js` 请求日志中间件本体（字段组装、finish/close 去重、响应头回写时机）；error handler 与请求日志的关联方式；`/health` 的判据（P3）；§3 五问的全部答案；发布顺序与回滚分层的取舍 |

**特别注意**：D1 已把字段契约、脱敏清单、关联 id 方案冻结完毕——
今天 AI 复述这些**已冻结的结论**不构成新的 L2 援助（那是本人 8/17 自己的答案）；
但若在实现中给出中间件的可运行写法，就是**误给 L3**，必须按 `AGENTS.md` §5 记入 `DEBT.md`。

---

## 10. 收尾清单（块 G）

> **状态（2026-08-21 回填）**：七项全部完成。依据 —— `week10-plan.md` §4 的 D2 已勾选且 §9 `shop-ssl.conf` 遗留项标「已收口」；`day2-english-speaking.md` 已入库；`LEARNING-STATE.md` 主线已推进到 D3 之后。

- [x] 本文件补写「实际发生了什么」（§11）：验证七项实测 vs 期望 + 偏差归因。
- [x] §3 五问的答案与 review 结论留痕（P1–P5 全部固化）。
- [x] `git status --short` 核对：无 `.env`、无真实密码/token、无服务器私钥路径以外敏感信息（块 F）。
- [x] commit（本人已 commit + push，f48162d）。
- [x] `week10-plan.md` §4 的 D2 勾选，§9 的 `shop-ssl.conf` 遗留项按 §2.4 的实际处置更新。
- [x] `LEARNING-STATE.md`：当前主线推进到 D3、验收证据补本次的 id 串联证据、Nginx 副本遗留项收口。
- [x] 按 `DAILY-SPEAKING-PROTOCOL.md` 生成 `day2-english-speaking.md`。

---

## 11. 收口：实际发生了什么（2026-08-18 验证七项实测 vs 期望）

> 按 `LEARNING-PROTOCOL.md` §4「先答后对」：每项先写期望值，再写实测值，偏差逐条归因。

| # | 期望值（§2.5） | 实测值（2026-08-18） | 偏差归因 |
|---|---|---|---|
| ① 结构化输出 | stdout 一行 NDJSON，九字段齐 | ✅ `{"level":30,"time":"...Z","method":"GET","path":"/","statusCode":200,"requestId":"local-...","duration":1,"ip":"...","ua":"...","errorType":null,"requestStatus":"finish"}` 一行，真 UTC，九字段齐 | 无 |
| ② 脱敏实测（本地） | 密码/token 0 命中 | ✅ `PASSWORD_NOT_FOUND` + `TOKEN_NOT_FOUND`，第一层（不记 body）生效 | 无 |
| ③ 断连补记+去重 | finish 恰 1 / close 恰 1 | ✅ 正常请求 1 条；限速大 body 断连（curl rc=28）→ `requestStatus:"close"` 1 条；请求日志流 `uniq -d` 无重复 | 首次尝试 `--max-time 0.05` 打 login 未造出断连（bcrypt 快路径 duration 4ms < 50ms，全走 finish）——**测试方式问题，非实现缺陷**；改用 100KB body 限速制造成功 |
| ④ 响应头回写 | `X-Request-Id: <32 位 hex>` | ✅ 公网 443 返回 `63245c0a2ff8bea5fa389ea4174ac241` | 无 |
| ⑤ **一个 id 串两条流** | 两边各恰 1 条 | ✅ Nginx access.log 1 条 `rid=63245c0a...`（`+08:00`）+ Node journald 1 条 `requestId":"63245c0a..."`（`Z`） | 无——**本次唯一新能力的完整证据** |
| ⑥ 三层基线回归 | 五面 200 + /health 200 + 两服务 active | ✅ 80/443(verify 0)/443 admin/8080/8081 全 200 + /health 200 + nginx/nodeapp active | 无 |
| ⑦ journald 上限 | SystemMaxUse=500M 可见；占用 <500M | ✅ `SystemMaxUse=500M` 生效；占用 272.0M（基线 248M + 当日日志） | 无 |

**验收句实测**：从公网发一次请求 → 响应头带 id → 同一个 id 在 Nginx 与 Node 日志各查到恰好 1 条；一次真实登录请求 → Nginx/Node 两条流密码均 `NOT_FOUND`。**验收句完整达成 ✅**

**执行期新增事实（回顾）**：
1. 查询串凭据泄漏：review 时发现 404 的 `err.message` 用 `req.url`（含查询串），凭据以字符串形式进 `err.message` → error handler 当 msg 参数落盘。**pino redact 只对对象路径生效、不碰字符串**。修复 = catch-all 用 `req.path` + error handler msg 改纯描述（断开源与口两个通道）。
2. `sudo -iu nodeapp` 报 `This account is currently not available`：nodeapp 是 systemd 服务账号（shell = nologin），login shell 不可用；改用 `sudo -u nodeapp bash -c`（经验知识，记入权限速查表）。
3. 本地回归测试并行跑挂起 / `--runInBand` 串行 9/9 过：多个 suite 共享外部库 `skillup_test_b` 互相 `dropDatabase` 的既有并行竞态，**非今日改动引入**（锦上添花，待 D5 或 backlog）。
4. `mongoDB 本地原生(CST/认证) + docker skillup-mongo` 并存 27017（W9 已知），macOS 无 `ss`（用 lsof 代替）。

---

## 12. 明日入口（D3）

D3 是「监控与告警，并主动弄红一次」（`week10-plan.md` §4）。**它对今天有两个硬依赖**：

1. **`/health` 必须已上线**——四项检查里的「进程存活」第二层判据直接打它（D1 §5.3）。
2. **journald 上限必须已生效**——D3 的磁盘检查红线（<4 GB）与它咬合，上限没设就等于红线的分母是浮动的。

D3 第一个动作：把 D1 §5.3 的四项判据表逐行翻成检查脚本的**退出码语义**
（0 = 绿 / 非 0 = 红，且红时输出「我该做什么」——Q11 的可操作性要求）。

---

## 13. AI 辅助记录

- 2026-08-18：AI 起草本文件——变更单结构、验证矩阵的**格式**、回滚与止步的**框架**、
  §5 的命令与配置语法（白名单），以及 §2.3 / §3 P1–P5 的**问题与判据**。
- §3 五问、§2.2 发布顺序、中间件与 `/health` 的实现**全部留空待本人作答**，AI 不给取值与可运行实现。
- §2.3 关于 `proxy_set_header` 屏蔽语义、§5.5 关于 `SystemMaxUse` 无需 restart，属 `AGENTS.md` §4「经验知识」
  （必须真实遇过一次才知道的工具行为），按规则直接讲解，不要求本人先猜。
- **未触发 `DEBT.md` 记账**（白名单实现 + L1 讲解，黑名单零实现）。
