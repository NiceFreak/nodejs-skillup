// 排障手册板（白名单展示资产）。
// 事实源 = week10-observability/notes/runbook.md；本组件按操作手册形态重排：
// 通用首查 → 速查表 → 三类故障 → 演练痕迹识别 → 局限。
// 展示状态对外可见，但真实 IP / 域名替换为占位符；复习状态显示真实地址
// （脱敏规则见 SHOWCASE-DEPLOY-PROTOCOL.md §发布不变量）。
import type { BoardMode } from "./types";

const LIVE = { ip: "43.128.154.242", domain: "43-128-154-242.sslip.io" };
const PLACEHOLDER = { ip: "<服务器公网 IP>", domain: "<服务器域名>" };
const HEALTH_URL = "http://127.0.0.1:3000/health";

export default function RunbookBoard({ mode }: { mode: BoardMode }) {
  const review = mode === "review";
  const h = review ? LIVE : PLACEHOLDER;

  const faces = [
    {
      name: "80 · API",
      url: `http://${h.ip}/`,
      ok: "200",
      probe: "无专属；走通用首查（/health）",
    },
    {
      name: "443 · API",
      url: `https://${h.domain}`,
      ok: "200 且证书校验通过",
      probe: "查 Nginx error.log 的 upstream 行",
    },
    {
      name: "443 /admin/",
      url: `https://${h.domain}/admin/`,
      ok: "200",
      probe: "同 443 API（共享同一 server 块）",
    },
    {
      name: "8080 · 管理后台",
      url: `http://${h.ip}:8080/`,
      ok: "200",
      probe: "静态目录与 Nginx 站点配置",
    },
    {
      name: "8081 · 学习展板",
      url: `http://${h.ip}:8081/`,
      ok: "200",
      probe: "同 8080（展板内容不经反代）",
    },
  ];

  const services = [
    { name: "nodeapp", normal: "active，且 127.0.0.1:3000 有监听", probe: "systemctl status nodeapp + ss -tlnp | grep :3000" },
    { name: "mongod", normal: "active，且 127.0.0.1:27017 有监听", probe: "systemctl status mongod" },
    { name: "nginx", normal: "active，且四个 listen 端口在听", probe: "systemctl status nginx + nginx -t" },
  ];

  const checks = [
    { name: "check-app", red: "进程两层判：is-active + /health", run: "systemctl start check-app.service + journalctl -u check-app.service -n 5" },
    { name: "check-mem", red: "内存可用 < 200 MB", run: "systemctl start check-mem.service + journalctl -u check-mem.service -n 5" },
    { name: "check-disk", red: "磁盘可用 < 4 GiB（字节级判据）", run: "systemctl start check-disk.service + journalctl -u check-disk.service -n 5" },
    { name: "check-cert", red: "证书剩余 < 15 天", run: "systemctl start check-cert.service + journalctl -u check-cert.service -n 5" },
  ];

  // 三类故障各自的五步处理轨道：症状 → 首查 → 判定 → 修复 → 验证。
  const faultTracks: Array<Array<{ t: string; d: string }>> = [
    [
      { t: "症状", d: "443 根 502；/health 仍 200；80 / 8080 / 8081 不受影响" },
      { t: "首查", d: "curl /health = 200" },
      { t: "判定", d: "Nginx 层：nginx -t → error.log → 定位 proxy_pass" },
      { t: "修复", d: "备份 → 恢复 → nginx -t && reload → diff 为空" },
      { t: "验证", d: "443 根恢复 200" },
    ],
    [
      { t: "症状", d: "/health 返回 000；is-active 仍是 active" },
      { t: "首查", d: "ss -tlnp | grep :3000" },
      { t: "判定", d: "端口被占；或假 active（无监听但 active）" },
      { t: "修复", d: "杀占用进程 → systemctl restart nodeapp" },
      { t: "验证", d: "ss 见 LISTEN + /health 200" },
    ],
    [
      { t: "症状", d: "公网面与 /health 仍 200，磁盘逼近满" },
      { t: "首查", d: "df -h / → df -B1 / 字节级" },
      { t: "判定", d: "字节级 avail < 4 GiB" },
      { t: "修复", d: "rm 占位文件释放空间" },
      { t: "验证", d: "df 回到故障前 + 字节级 > 4 GiB" },
    ],
  ];

  return (
    <section className="rb-board" aria-label="服务器排障手册">
      <header className="rb-hero">
        <span>operations runbook</span>
        <h2>服务器排障手册</h2>
        <p>
          单机生产环境（2 核 / 2 GB / 40 GB，无 swap）的排障入口：先跑通用首查，再按速查表定位，
          最后按三类故障的处理序列恢复。命令在服务器内执行；日志落点：Node → journald（NDJSON，UTC），
          Nginx → /var/log/nginx/{'{access,error}.log'}。
        </p>
        {!review && (
          <p className="rb-hero-note">
            展示状态隐藏真实地址，以占位符显示；复习状态显示实际地址。
          </p>
        )}
      </header>

      <section className="rb-block">
        <div className="rb-head">
          <span>first probe</span>
          <h3>① 通用首查：一条命令区分故障层</h3>
        </div>
        <div
          className="rb-cut"
          role="group"
          aria-label={`首查命令是 curl ${HEALTH_URL}：200 走反代层或资源层，非 200 走应用层；资源逼近告警线时健康检查仍 200，改看四项检查输出`}
        >
          <div className="rb-cut-probe">
            <div className="rb-cut-probe-head">
              <span>第一步 · 服务器内直连</span>
            </div>
            <code>{`curl ${HEALTH_URL}`}</code>
            <p>一条命令区分故障层：200 与非 200 指向不同的排查方向。</p>
          </div>

          <div className="rb-cut-branches">
            <article className="rb-cut-branch rb-branch-reverse">
              <header>
                <b>200</b>
                <span>反代层 / 资源层</span>
              </header>
              <ul className="rb-cut-next-steps">
                <li>
                  <strong>反代层</strong>
                  <small>nginx -t → tail error.log → 定位 proxy_pass 目标</small>
                </li>
                <li>
                  <strong>资源层</strong>
                  <small>df -B1 / 字节级余量 + free -m 内存可用</small>
                </li>
              </ul>
              <p className="rb-cut-next">
                <span>下一步</span>
                Nginx 配置正确性；磁盘 / 内存是否逼近告警线
              </p>
            </article>

            <article className="rb-cut-branch rb-branch-app">
              <header>
                <b>非 200（含 000）</b>
                <span>应用层 / 进程层</span>
              </header>
              <ul className="rb-cut-next-steps">
                <li>
                  <strong>端口占用</strong>
                  <small>ss -tlnp | grep :3000 → 有占用则记录 PID、杀进程、restart</small>
                </li>
                <li>
                  <strong>假 active</strong>
                  <small>无监听但 is-active=active → 修复方向 error 监听 + exit(1)</small>
                </li>
              </ul>
              <p className="rb-cut-next">
                <span>下一步</span>
                journalctl -u nodeapp -n 30 看 Node 自身错误
              </p>
            </article>
          </div>

          <p className="rb-cut-limit">
            <b>失灵边界：</b>资源逼近告警线时 /health 仍 200（探针不碰数据库）；
            这时靠四项检查输出补位。
          </p>

          <div className="rb-cut-second">
            <div className="rb-cut-second-q">
              <span>公网范围检查</span>
              五个公网面全挂还是单个面挂？
            </div>
            <div className="rb-cut-second-grid">
              <p>
                <span>全挂</span>
                共享下游：nodeapp / Nginx 进程与监听
              </p>
              <p>
                <span>单面挂</span>
                该面专属 server 块（如 443 面 → shop-ssl 配置）
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rb-block">
        <div className="rb-head">
          <span>cheat sheets</span>
          <h3>② 速查表：照着一行判据跑命令</h3>
        </div>

        <div
          className="rb-topo"
          role="group"
          aria-label="五个公网面的访问路径：浏览器经 Nginx 的四个站点配置，进入 nodeapp、mongod 或静态目录"
        >
          <div className="rb-topo-entries">
            {faces.map((f) => (
              <div key={f.name} className="rb-topo-entry">
                <span>公网面</span>
                <b>{f.name}</b>
                <code>{f.url}</code>
              </div>
            ))}
          </div>
          <div className="rb-topo-nginx">
            <b>Nginx · 四个站点配置</b>
            <div className="rb-topo-blocks">
              <span>shop · 80</span>
              <span>shop-ssl · 443（含 /admin/）</span>
              <span>shop-admin · 8080</span>
              <span>shop-showcase · 8081</span>
            </div>
          </div>
          <div className="rb-topo-down">
            <div>
              <b>nodeapp</b>
              <span>127.0.0.1:3000</span>
              <small>80 / 443 的反代目标；8080 / 8081 的 /auth /reports 反代</small>
            </div>
            <div>
              <b>mongod</b>
              <span>127.0.0.1:27017</span>
              <small>业务数据存储</small>
            </div>
            <div>
              <b>静态目录</b>
              <span>dist/ · dist-showcase/</span>
              <small>8080 管理后台 / 8081 学习展板的静态面</small>
            </div>
          </div>
        </div>

        <h4>五个公网面</h4>
        <div className="rb-table-wrap">
          <table className="rb-table">
            <thead>
              <tr><th>面</th><th>地址</th><th>正常判据</th><th>该面专属首查</th></tr>
            </thead>
            <tbody>
              {faces.map((f) => (
                <tr key={f.name}>
                  <td>{f.name}</td>
                  <td><code>{f.url}</code></td>
                  <td>{f.ok}</td>
                  <td>{f.probe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>三个常驻服务</h4>
        <div className="rb-table-wrap">
          <table className="rb-table">
            <thead>
              <tr><th>服务</th><th>正常形态</th><th>首查命令</th></tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.name}>
                  <td><code>{s.name}</code></td>
                  <td>{s.normal}</td>
                  <td><code>{s.probe}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>四项检查（systemd timer 驱动，oneshot 报红看 journald）</h4>
        <div className="rb-table-wrap">
          <table className="rb-table">
            <thead>
              <tr><th>检查</th><th>报红判据</th><th>手工触发 + 看结果</th></tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.name}>
                  <td><code>{c.name}</code></td>
                  <td>{c.red}</td>
                  <td><code>{c.run}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rb-footnote">
          经验知识：Type=oneshot 正常跑完是 Deactivated successfully，失败是 Failed with result exit-code；
          systemctl is-active 对 oneshot 看不出红绿，要看 journalctl。
        </p>
      </section>

      <section className="rb-block">
        <div className="rb-head">
          <span>three fault classes</span>
          <h3>③ 三类故障的处理序列</h3>
        </div>

        <article className="rb-fault">
          <header>
            <b>类 1</b>
            <span>反代配置错误</span>
            <i>A 档</i>
          </header>
          <ol
            className="rb-track"
            style={{ ["--rb-track-steps" as string]: faultTracks[0].length }}
          >
            {faultTracks[0].map((s, i) => (
              <li key={s.t} className={`rb-track-step${i === faultTracks[0].length - 1 ? " kick-ok" : ""}`}>
                <i aria-hidden="true">{i + 1}</i>
                <b>{s.t}</b>
                <p>{s.d}</p>
              </li>
            ))}
          </ol>
          <div className="rb-fault-grid">
            <div className="rb-fault-symptom">
              <h5>症状</h5>
              <ul>
                <li>443 根路径 502，/health 仍 200</li>
                <li>80 / 8080 / 8081 面不受影响</li>
                <li>error.log：connect() failed (111)，upstream 指向 http://127.0.0.1:9999/</li>
              </ul>
            </div>
            <div className="rb-fault-probe">
              <h5>首查 → 分叉</h5>
              <code>{`curl ${HEALTH_URL}`}</code>
              <p>200 → Nginx 层：nginx -t → tail error.log → 定位 proxy_pass；非 200 → 转类 2。</p>
            </div>
            <div className="rb-fault-fix">
              <h5>修复</h5>
              <pre>{`cp shop-ssl shop-ssl.d4bak       # ① 备份现场（双证据）
diff shop-ssl shop-ssl.d4bak      # ② 注入后非空
cp shop-ssl.d4bak shop-ssl        # ③ 恢复备份
nginx -t && systemctl reload nginx
diff shop-ssl shop-ssl.d4bak      # ④ 应为空
curl -s -o /dev/null -w '%{http_code}' https://${h.domain}`}</pre>
              <p>判据：diff 退出码 0，且 443 根恢复 200。</p>
            </div>
            <div className="rb-fault-prevent">
              <h5>预防</h5>
              <ul>
                <li>error.log 的 connect() failed 模式监控</li>
                <li>敏感站点文件建 md5sum 基线，变更前 diff</li>
                <li>nginx -t 只验语法，不验上游可达性</li>
              </ul>
            </div>
          </div>
        </article>

        <article className="rb-fault">
          <header>
            <b>类 2</b>
            <span>端口占用 / 假 active</span>
            <i>A 档</i>
          </header>
          <ol
            className="rb-track"
            style={{ ["--rb-track-steps" as string]: faultTracks[1].length }}
          >
            {faultTracks[1].map((s, i) => (
              <li key={s.t} className={`rb-track-step${i === faultTracks[1].length - 1 ? " kick-ok" : ""}`}>
                <i aria-hidden="true">{i + 1}</i>
                <b>{s.t}</b>
                <p>{s.d}</p>
              </li>
            ))}
          </ol>
          <div className="rb-fault-grid">
            <div className="rb-fault-symptom">
              <h5>症状</h5>
              <ul>
                <li>/health 返回 000（连接拒绝）</li>
                <li>systemctl is-active nodeapp 仍是 active</li>
                <li>ss 无 3000 监听，或被 nc / socat 占用</li>
                <li>journalctl 无 EADDRINUSE 错误</li>
              </ul>
            </div>
            <div className="rb-fault-probe">
              <h5>首查 → 分叉</h5>
              <code>{`curl ${HEALTH_URL}`}</code>
              <p>非 200 → 应用层：ss -tlnp | grep :3000 + journalctl -u nodeapp -n 30。</p>
            </div>
            <div className="rb-fault-fix">
              <h5>修复</h5>
              <pre>{`pkill -f 'nc -l 127.0.0.1 3000'  # ① 杀占用进程
ss -tlnp | grep :3000              # ② 确认杀干净
systemctl restart nodeapp          # ③ 重启
ss -tlnp | grep :3000              # ④ 应见 LISTEN
curl -s -o /dev/null -w 'health %{http_code}' ${HEALTH_URL}`}</pre>
              <p>
                判据：ss 有 LISTEN + /health 200 + status active。假 active 分支的修复方向是
                error 监听 + process.exit(1)，复用外层 server，机制尚未验证，排 W11 复现。
              </p>
            </div>
            <div className="rb-fault-prevent">
              <h5>预防</h5>
              <ul>
                <li>过渡监控：ss 监听 + /health 双重校验</li>
                <li>health 000 但 active → 告警假 active</li>
              </ul>
            </div>
          </div>
        </article>

        <article className="rb-fault">
          <header>
            <b>类 3</b>
            <span>磁盘逼近满</span>
            <i>B 档</i>
          </header>
          <ol
            className="rb-track"
            style={{ ["--rb-track-steps" as string]: faultTracks[2].length }}
          >
            {faultTracks[2].map((s, i) => (
              <li key={s.t} className={`rb-track-step${i === faultTracks[2].length - 1 ? " kick-ok" : ""}`}>
                <i aria-hidden="true">{i + 1}</i>
                <b>{s.t}</b>
                <p>{s.d}</p>
              </li>
            ))}
          </ol>
          <div className="rb-fault-grid">
            <div className="rb-fault-symptom">
              <h5>症状</h5>
              <ul>
                <li>公网面与 /health 仍 200（探针不碰数据库，不写盘）</li>
                <li>df -BG 显示 4G（四舍五入），字节级余量已逼近或低于 4 GiB</li>
                <li>2026-08-21 起 check-disk 已改字节级判据，同条件报红</li>
              </ul>
            </div>
            <div className="rb-fault-probe">
              <h5>首查 → 分叉</h5>
              <code>df -h /</code>
              <p>avail &lt; 3.5 GiB → 立即止损；≥ 3.5 GiB → df -B1 / 字节级确认真实余量。</p>
            </div>
            <div className="rb-fault-fix">
              <h5>修复</h5>
              <pre>{`ls -lh /tmp/disk-fill.bin       # ① 确认占位文件
rm -f /tmp/disk-fill.bin         # ② 释放空间
df -h / && df -B1 /              # ③ 验证恢复`}</pre>
              <p>判据：df 的 avail 回到故障前，字节级 avail &gt; 4 GiB。</p>
            </div>
            <div className="rb-fault-prevent">
              <h5>预防</h5>
              <ul>
                <li>check-disk 判据已改字节级比较</li>
                <li>journalctl --disk-usage 定期检查日志占用</li>
              </ul>
            </div>
          </div>
        </article>
      </section>

      <section className="rb-block">
        <div className="rb-head">
          <span>drill vs incident</span>
          <h3>④ 如何区分演练痕迹与真事故</h3>
        </div>
        <div className="rb-table-wrap">
          <table className="rb-table">
            <thead>
              <tr><th>维度</th><th>演练</th><th>真事故</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>标记</td>
                <td>logger -t DRILL 打标签，journalctl -t DRILL 可一次过滤</td>
                <td>无 DRILL 标签</td>
              </tr>
              <tr>
                <td>时间窗口</td>
                <td>集中在演练窗口，前后状态正常</td>
                <td>无预定义窗口</td>
              </tr>
              <tr>
                <td>证据链</td>
                <td>注入 / 恢复命令、diff 双证据、预测偏差记录</td>
                <td>可能缺恢复命令或预测对照</td>
              </tr>
              <tr>
                <td>服务状态</td>
                <td>结束后恢复正常，残留逐项核零</td>
                <td>残留可能持续存在</td>
              </tr>
              <tr>
                <td>判定原则</td>
                <td>三条同时成立：起止标记、恢复验证、残留核零</td>
                <td>该时段 journalctl -t DRILL 无输出 → 按真事故处理</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rb-block">
        <div className="rb-head">
          <span>limits</span>
          <h3>⑤ 这份手册覆盖不到什么</h3>
        </div>
        <ul className="rb-limits">
          <li><b>OOM：</b>2 GB / swap=0，OOM 未演练。遇 OOM 走 dmesg | grep -i oom 定位，建议扩容或开 swap。</li>
          <li><b>多机：</b>只覆盖单机，不处理 Nginx / MongoDB 集群化故障。</li>
          <li><b>证书真过期：</b>只给检查命令，不自动重签或撤销，需走现网变更流程。</li>
          <li><b>8080 下线：</b>按计划将下线；异常时先区分「计划下线」与「真故障」。</li>
          <li><b>展板内容：</b>只覆盖 HTTP 状态码；MongoDB 异常但 Node 仍 200 时，内容可达性不在此手册。</li>
        </ul>
      </section>
    </section>
  );
}
