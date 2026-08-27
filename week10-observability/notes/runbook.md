# W10 排障 Runbook

> 建立：2026-08-21（W10 D5 收口日）
> 上游：`day5-wrapup.md` §6 骨架 + §3 P2/P3 拍板（分叉结构 / 盲区替代信号）
> 用途：**别人（延迟后的自己）照着能修的排障手册** —— 不看 D4 笔记，只按本文件走通故障。
> 填写状态：**三类五列正文 + 速查表映射 + §5/§6 已由本人填写（2026-08-21 块 C）**；AI 只落字不代填。

---

## 0. 适用范围与前提

- 目标机器：`43.128.154.242`（Ubuntu 22.04，2 核 / 2 GB / 40 GB，swap=0）
- 五个公网面：80 API / 443 API / 443 `/admin/` / 8080 管理后台 / 8081 学习展板
- 三个常驻服务：nodeapp（127.0.0.1:3000）/ mongod（127.0.0.1:27017）/ nginx
- 四项检查：check-app / check-mem / check-disk / check-cert（systemd timer 驱动）
- 日志落点：Node → stdout → journald（NDJSON，UTC）；Nginx → `/var/log/nginx/{access,error}.log`
- 关联 id：Nginx `$request_id` → `X-Request-Id` 头 → Node pino 日志；响应头回写

## 1. 通用首查（只看到症状时的第一条命令）

| 判定点 | 真 → 走哪 | 假 → 走哪 |
|---|---|---|
| `curl 127.0.0.1:3000/health`（通用首查：一步区分反代层与应用层） | **200** → 反代层 / 资源层（类 1 注入态 200→反代；类 3 200→资源）。**补位**：四 check 输出（资源型故障探针不碰 DB，/health 200 但资源逼近线） | **非 200（含 000）** → 应用层 / 进程层（类 2 假 active 现象） |

失灵边界（P2-②）：**类 3 资源型故障** —— /health 200 但磁盘/内存逼近线（探针不碰 DB），这一条首查区分不出来；补位信号 = 四 check 的输出（`journalctl -u check-*.service` 看 OK/FAIL 与 detail 字段）。

「五面全挂」vs「单面挂」（P2-③）：**全挂 → 共享下游**（nodeapp / Nginx 进程与监听，`systemctl is-active nodeapp nginx mongod` + `ss -tlnp | grep -E '3000|80|443'`）；**单面挂 → 该面专属 server block**（如 443 面挂 → `shop-ssl` 配置 / error.log；8080 面挂 → `shop-admin` 静态目录）。

## 2. 分类条目

### 2.1 类 1 反代配置错误（A 档）

#### 症状（对外看到什么）

- 443 根路径 `https://43-128-154-242.sslip.io/` → **502**
- `/health` 仍为 **200**（Node 内存态正常）
- 80/8080/8081 面不受影响（仍 200）
- `error.log` 有 `connect() failed (111) while connecting to upstream` + `upstream: "http://127.0.0.1:9999/"`
- 注：`/auth`、`/reports` 可能返回 404（应用裸前缀路由特性，非注入直接现象）

#### 首查命令（先跑哪一条，为什么先跑它）

**命令**：

```bash
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/health
```

**为什么先跑它**：一步区分反代层与应用层——200 → Nginx 层（Node 正常），非 200 → 应用层。避免被公网混杂的 502/200 干扰。

#### 判定分叉（真 → 走哪 / 假 → 走哪）

**真（/health = 200）** → Nginx 层：

1. `sudo nginx -t`（语法）
2. `sudo tail -n 30 /var/log/nginx/error.log` 看 `connect() failed` 或 `no live upstreams`
3. 定位 proxy_pass 目标错误

**假（/health 非 200）** → 应用层：转入类 2 流程（`ss -tlnp | grep :3000` + `journalctl -u nodeapp`）

#### 修复

```bash
# ① 备份现场（关键：双证据）
sudo cp /etc/nginx/sites-available/shop-ssl /etc/nginx/sites-available/shop-ssl.d4bak
# ② 检查 diff（注入后非空）
sudo diff shop-ssl shop-ssl.d4bak
# ③ 恢复备份
sudo cp /etc/nginx/sites-available/shop-ssl.d4bak /etc/nginx/sites-available/shop-ssl
# ④ 验证语法 + reload
sudo nginx -t && sudo systemctl reload nginx
# ⑤ 确认 diff 为空（回滚后为 0）
sudo diff shop-ssl shop-ssl.d4bak
# ⑥ 验证公网恢复
curl -s -o /dev/null -w '443root %{http_code}\n' https://43-128-154-242.sslip.io/
```

**判据**：`diff` 退出码回滚后 = 0 + 443root 恢复 200

#### 预防

- **监控补位**：部署 Nginx error.log 的 `connect() failed` 模式监控（告警阈值 > 0/分钟），或本地后端健康检查（curl 每个 `proxy_pass` 后端，失败告警）—— 归入 W11 CI 部署验证。
- **配置变更审计**：对 `shop-ssl` 等敏感站点文件建立 `md5sum` 基线，变更前 `diff` 对照，防止语义错误被漏过。
- **`nginx -t` 不能作为唯一语法检查**：它只验语法不验上游可达性；操作手册必须写「语法通过 ≠ 语义正确，需查 error.log 确认连接成功」。

### 2.2 类 2 端口占用 / 应用假 active（A 档）

#### 症状（对外看到什么）

- 公网对应面异常（**推断**：`/health` 000 ⇒ 反代层无法连接后端，必然返回 502/504；但 D4 §6.3 实测直接证据仅为 **`/health`=000** 与 **`ss` 无 3000 监听**，未贴五面 curl 输出，故此处标推断而非事实）
- `/health` = **000**（Connection refused）—— **这是 D4 实测的直接事实**
- `systemctl is-active nodeapp` = **active**（进程活着）
- `ss -tlnp | grep :3000` 无 nodeapp 监听（或被 nc/socat 占）
- `journalctl -u nodeapp` **无 EADDRINUSE 错误**（进程无错误日志却无监听）

#### 首查命令（先跑哪一条，为什么先跑它）

**命令**：

```bash
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/health
```

（与类 1 共用）

**为什么先跑它**：同前，非 200 → 应用层方向；结合 `ss -tlnp | grep :3000` 确认端口是否被占。

#### 判定分叉（真 → 走哪 / 假 → 走哪）

**真（/health 非 200）** → 应用层：

1. `ss -tlnp | grep :3000` 看有无占用（PID/进程名）
2. `journalctl -u nodeapp -n 30` 看 Node 自身错误

- 若 `ss` 有 3000 被占 → 记录 PID，`pkill -f '<匹配串>'` 杀之 → `sudo systemctl restart nodeapp`
- 若 `ss` 无 3000 但 nodeapp active → 进入「假 active」分支。**块 E 定论**：`app.listen` 成功回调（"服务运行端口: 127.0.0.1:3000"）被触发，但底层 socket 未实际绑定；`server.on('error')` 缺失不是唯一原因，真正机制（回调触发但绑定失败）**当前未验证**。定位：`/health` 非 200 + `ss` 无监听 + `is-active` active → 假 active。修复方向：`error` 监听 + `process.exit(1)`，复用外层 `server`（第 6 行 `let server = null`）；机制复现排 W11。

**假（/health = 200）** → 反代层：转入类 1 流程

#### 修复

```bash
# ① 杀占用进程（以 nc 为例）
sudo pkill -f 'nc -l 127.0.0.1 3000'
# ② 确认杀干净
ss -tlnp | grep :3000
# ③ 重启 nodeapp
sudo systemctl restart nodeapp
# ④ 验证监听恢复
ss -tlnp | grep :3000  # 应见 LISTEN 127.0.0.1:3000
curl -s -o /dev/null -w 'health %{http_code}\n' http://127.0.0.1:3000/health  # 应 200
```

**判据**：`ss` 有 LISTEN + `health` 200 + `systemctl status nodeapp` active

#### 预防

- **修复方案（已定，待 W11 复现验证后上线）**：
  - `app.listen` 后加 `server.on('error', ...)`，`EADDRINUSE` 等错误时 `logger.error(...)` + `process.exit(1)`，确保 systemd 感知 failed。
  - **关键**：复用外层 `let server`（第 6 行），不能用 `const server =` 遮蔽，否则 `gracefulShutdown` 无法正确关闭。
  - 机制（成功回调触发但绑定失败）未验证 → W11 最小样本复现后定最终方案，避免盲目 `process.exit(1)` 产生副作用。
  - **过渡监控补位**：`ss -tlnp | grep :3000` + `/health` 双重校验，health 000 但 active → 告警「假 active」，归 W11 CI 部署验证。

### 2.3 类 3 磁盘逼近满（B 档）

#### 症状（对外看到什么）

- 公网五面仍 **200**（Node 内存态响应，探针不碰 DB）
- `/health` = **200**（纯内存探针，不写盘）
- **8/20 旧判据下**：`check-disk` 在整点排程触发后 **OK**（`avail=4G`），这是取整盲区，不代表磁盘安全
- **2026-08-21 改字节级判据后**：同条件报 **FAIL**（D5 15:18:41 实证），本行症状不再出现
- 真实可用空间：字节级 `df -B1 /` 可能已 **< 4 GiB**，而 `df -BG` 四舍五入显示 4G → 旧判据 `>=4G` 判绿

#### 首查命令（先跑哪一条，为什么先跑它）

**命令**：

```bash
df -h /   # 若 < 3.5G（执行期修正止步线）立即止损；若 ≥ 3.5G，转 df -B1 / 字节级确认真实余量
df -B1 /  # 字节级确认真实余量
```

**为什么先跑它**：绕过 `df -BG` 取整盲区，直接获得字节级准确值，判断是否逼近告警线（4G）或止步线（3.5G）。

#### 判定分叉（真 → 走哪 / 假 → 走哪）

**真（df -B1 / 的 avail < 4G）** → 磁盘逼近告警：

1. `ls -lhS /tmp/` 看大占位文件（如 `disk-fill.bin`）
2. `du -sh /var/log/*` 看日志方向
3. `sudo rm -f <占位文件>` 释放空间
4. `df -h /` 确认回绿

**假（df -B1 / 的 avail ≥ 4G）** → 磁盘不是根因，转 `free -m` / `journalctl --disk-usage` 查内存/日志

**特殊分支（avail < 3.5G）** → 触止步②，立即 `sudo rm -f /tmp/disk-fill.bin`，不等观察；然后重新 `df -h /` 确认回到安全区

#### 修复

```bash
# ① 确认占位文件
ls -lh /tmp/disk-fill.bin
# ② 删除释放空间
sudo rm -f /tmp/disk-fill.bin
# ③ 验证恢复
df -h / && df -B1 /
```

**判据**：`df -h /` 的 avail 回到注入前基线（如 31G）+ 字节级 avail > 4G

#### 预防

- **脚本修正（已执行）**：`check-disk.sh` 判据改用 **字节级比较**（`df -B1 /` 与 4GB 阈值直接比较），避免 `df -BG` 四舍五入盲区。2026-08-21 已改脚本，走变更单。
- **人工复核**：在修正部署前，操作手册必须写「看到 OK 行 avail=4G 时，**必须手工 `df -B1 /` 复核**」—— 这是盲区表里的强制动作。
- **日志轮转监控**：`journalctl --disk-usage` 定期检查，防止日志积累占满。

## 3. 监控盲区表（四项检查不会报红、只能靠人发现的故障）

| 盲区 | 四项检查为什么不报红 | 人靠什么先发现（替代信号） | 去向 |
|---|---|---|---|
| ① `df -BG` 取整 | `df -BG` 四舍五入，avail∈[3.5,4.0)GiB 显示成 4G → 判据 `>=4` 静默绿；FAIL 在合法止步区间内不可达 | **两步链**：`journalctl -u check-disk.service` 见 OK 行 avail 逼近阈值（触发怀疑，入口）→ `df -B1 /` 字节级确认真实余量（终点；`df -BG` 的 4G 是取整产物，不可当终点） | **已修**（2026-08-21 #11 改字节级判据） |
| ② check-app 反代 scope | 只探 `127.0.0.1:3000` 本地进程存活，不探对外反代语义（443 root=502 时四项全绿） | 公网 curl 该面（`curl -sS -o /dev/null -w '%{http_code}' https://43-128-154-242.sslip.io`）或 Nginx `error.log` 的 `upstream` 模式 | W11 CI 部署验证 |
| ③ nodeapp 假 active | systemd 只看进程 exit code / active 状态，不见「无监听」——D4 实测 listen **成功回调已触发**（journald 有「服务运行端口」）但底层 socket 未绑定 | `ss -tlnp | grep :3000` 无 nodeapp 监听 + `/health` 000，但 `systemctl is-active nodeapp` = active | **机制已定论 + 已修复（2026-08-27）**：W11 D4 最小样本否证 close 竞争，完整 server.js + `EADDRINUSE` 注入复现——listen 到被占用端口时 listening 回调仍触发、底层 bind 失败、无 error 监听 → 进程静默存活。修复：`server.on('error')` 对 `EADDRINUSE`/`EACCES`/`EADDRNOTAVAIL` → `logger.error` + `process.exit(1)`（已部署 `2b9f87b`，注入 exit(1) + 部署七项验证通过）；`ss :3000` 兜底保留 |

## 4. 速查表

### 4.1 公网面（8080 下线后：四个面 + 一个子路径入口）

> 变更记录：2026-08-27（W11 D4）8080 明文过渡期下线（Q17 拍板，`shop-admin` 的 server 块注释、reload 生效）。管理后台入口收敛到 443 `/admin/`（`shop-ssl` 反代）。原「五面基线」判据随之下线 8080 面、补 `/showcase/` 子路径入口，收口口径见 W11 周计划 §3。

| 面 | URL | 正常判据 | 该面专属首查 |
|---|---|---|---|
| 80 API | `http://43.128.154.242/` | 200 | 无专属；走通用首查（`/health`） |
| 443 API | `https://43-128-154-242.sslip.io` | 200 + ssl_verify=0 | **查 `error.log` 的 upstream 行**：`sudo tail -n 30 /var/log/nginx/error.log \| grep connect()` |
| 443 /admin/ | `https://43-128-154-242.sslip.io/admin/` | 200 | 同 443 API（共享 `shop-ssl` server block） |
| 8081 学习展板 | `http://43.128.154.242:8081/` | 200 | 展板内容不走反代，首查静态目录与 `shop-showcase` 配置 |
| 80 /showcase/ | `http://43.128.154.242/showcase/` | 200 | 80 站子路径入口（2026-08-27 落盘），首查 `shop.conf` 的 `location /showcase/` |
| ~~8080 管理后台~~ | ~~`http://43.128.154.242:8080/`~~ | **已下线（2026-08-27）** | 明文面关闭，`ss -lnt \| grep 8080` 应为空；管理后台走 443 `/admin/` |

### 4.2 四个服务 / 排程

| 项 | 正常形态 | 首查命令 |
|---|---|---|
| nodeapp | active + `ss -tlnp` 有 127.0.0.1:3000 | `systemctl status nodeapp` + `ss -tlnp | grep :3000` |
| mongod | active + 127.0.0.1:27017 | `systemctl status mongod` |
| nginx | active + 四个 listen 端口在听 | `systemctl status nginx` + `sudo nginx -t` |
| 四 timer | active + NEXT 有值 | `systemctl list-timers --all \| grep check-` |

### 4.3 四项检查

| 检查 | 红判据（契约） | 手工触发 + 看结果 |
|---|---|---|
| check-app | 进程两层判（is-active + /health） | `sudo systemctl start check-app.service` + `journalctl -u check-app.service -n 5` |
| check-mem | 内存 available < 200MB | `sudo systemctl start check-mem.service` + `journalctl -u check-mem.service -n 5` |
| check-disk | 磁盘可用 < 4GB（**2026-08-21 改字节级**，见 §3 盲区①） | `sudo systemctl start check-disk.service` + `journalctl -u check-disk.service -n 5` |
| check-cert | 证书剩余 < 15 天 | `sudo systemctl start check-cert.service` + `journalctl -u check-cert.service -n 5` |

> 经验知识：`Type=oneshot` 正常跑完是 `Deactivated successfully`，失败是 `Failed with result exit-code`；
> `systemctl is-active` 对 oneshot 看不出绿红 —— 报红要开 `journalctl -u check-*.service -n 5` 看。

## 5. 演练痕迹与真事故如何区分

| 维度 | 演练（DRILL） | 真事故 |
|---|---|---|
| **标记** | 每类注入/恢复有 `logger -t DRILL` 打标签，`journalctl -t DRILL` 可一次性过滤全部演练事件 | 无 DRILL 标签 |
| **时间窗口** | 演练集中在特定窗口（如 8/20 10:00–15:30），前后基线全绿 | 无预定义窗口，可能是任意时刻 |
| **证据链** | 每类有注入命令、恢复命令、`diff` 双证据、预测 vs 实际偏差记录 | 可能缺恢复命令或预测对比 |
| **服务状态** | 演练结束后基线全绿 + 残留清单核零（`diff` 空、`ls` 不存在、`pgrep` 无匹配） | 残留可能持续存在，需持续排查 |
| **判定原则** | 演练痕迹不按事故处理，判据有三条：① 有明确的开始/结束标记（DRILL）；② 有恢复基线验证；③ 残留清单已逐项核零。 | 若 `journalctl -t DRILL` 在该时间段无输出，则该时间段的 FAIL 行按真事故处理。 |

## 6. 局限（这份 runbook 覆盖不到什么）

- **OOM（内存耗尽）**：本机 2GB/swap=0，OOM 场景被 `week10-plan.md` 列为 C 档（自伤型），演练未做，runbook 不覆盖。若遇到 OOM，需参考 `dmesg | grep -i oom` 和 `journalctl -k` 定位，建议走扩容或 swap 开启路线（D1 Q12 已记录）。
- **多机集中故障**：本 runbook 仅针对单机（43.128.154.242），不处理 Nginx/MongoDB 集群化环境下的分布式故障。
- **证书真过期**：证书链路只读，runbook 只提供**检查命令**（`systemctl start check-cert.service` + `journalctl -u check-cert.service`），不提供「自动重签」或「撤销」步骤——这些操作需走现网变更流程，本 runbook 不越权。
- **8080 下线**：8080 管理后台按 W10 计划应在后续下线，但本 runbook 编写时仍在线；若 8080 面异常，需区分「计划下线」与「真故障」。
- **展板内容失效**：8081 展板依赖 MongoDB 数据，若 MongoDB 出问题但 Node 仍 200，runbook 未覆盖展板内容的可访问性校验（仅覆盖 HTTP 状态码）。需在展板维护流程中补充内容可达性检查。