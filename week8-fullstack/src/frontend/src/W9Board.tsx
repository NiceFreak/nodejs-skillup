// W9 部署链路板 · 阶段 1 代表页「故障分叉」。展示资产（AGENTS.md 白名单）。
//
// 为什么先做这一块：W9 迁移价值最高的一条结论是「两个 502 外部现象完全相同，
// 靠第一个排查动作的结果分叉」。它在笔记里是三段并列的 text 块，读者要自己对齐；
// 而它恰好是 week8 认证链 401/403/200 已经验证过的形态——同一条链路切换停止点。
//
// 本板同时要证明本轮新增的两条语法成立，之后才推其余九块：
//   1. 信任边界用「面 + 文字标签」表达，不新增颜色；
//   2. 每条路径强制挂证据档位（实测 / 推演 / 待做），渲染时不允许省略。
// 第 2 条是 W9 与 week8 的实质差别：四条路径里只有一条是实测的，做成图之后
// 极易被读成「都验证过」。
//
// 范围与其余九块见 week9-deployment/notes/week9-visualization-plan.md。
import { Fragment, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { HBarChart } from "./charts";
import { FrameNarration, FrameTransport, dwellByText, useFramePlayer } from "./framePlayer";
import { tabKeyDown } from "./tabs";
import type { BoardMode } from "./types";
import {
  ACCEPTANCE_READINGS,
  ACCEPTANCE_RUNS,
  ACCESS_MATRIX,
  ARTIFACT_SPLIT,
  ACC_SEGMENTS,
  BOUNDARY_NOTES,
  CERTBOT_CHOICE,
  CERT_FACTS,
  CERT_LIFECYCLE,
  CHAIN_NODES,
  CHANGE_DISCIPLINE,
  CHAIN_LAYERS,
  CHANGE_TICKET,
  CONTRACTS,
  COVERAGE_LIMIT,
  DENY_FORM,
  DISTORTIONS,
  EVIDENCE_GRADE,
  EXECUTION_SNAGS,
  EXPOSURE_SPLIT,
  IDENTITIES,
  EXPOSURE_SPLIT_NOTE,
  FACES_NOTE,
  FAST_FAIL_OBSERVED,
  GATES,
  GATE_DIFFERENTIAL,
  HTTPS_READINGS,
  INJECTION_BLIND_SPOT,
  LAYER_CHOICE,
  LE_RATE_LIMIT,
  MEMORY_GATE,
  NOT_ADOPTED,
  OWNED_OBJECTS,
  OPEN_ITEMS,
  OPEN_ITEMS_NOTE,
  PAIRING_RULE,
  PERM_RECIPES,
  PERM_RULE,
  PERM_SNAGS,
  PORT_ROWS,
  PRODUCTION_PARITY,
  PUBLIC_FACES,
  PLANE_LABEL,
  READING_CAVEAT,
  RELEASE_TICKET,
  ROLLBACK_LEVELS,
  SECURITY_DEBT,
  SERVICE_EXPOSURE,
  SERVICE_EXPOSURE_NOTE,
  SERVICE_EXPOSURE_TAKEAWAYS,
  SITE_CONFIGS,
  SPOKEN_FIXES,
  SPOKEN_KIND,
  SPOKEN_TAKEAWAYS,
  STALE_BACKUP,
  STARTUP_ORDER_NOTE,
  STOP_LOSS,
  SYSTEMD_LIMITS,
  TICKET_TAKEAWAY,
  TIMEZONE_NOTE,
  TWO_LAYER_DEFENSE,
  VERIFY_LAYERS,
  VERIFY_MATRIX,
  TRUST_CHAIN,
  URL_RULES,
  type ChainNode,
  type AccessVerdict,
  type EvidenceGrade,
  type SpokenFix,
  type IdentityId,
  type Gate,
  type PortRow,
} from "./w9Facts";
import { W9_ANALOGIES, W9_GLOSSARY } from "./w9Glossary";
import {
  DISCRIMINATOR_ROWS,
  FAILURE_MODES,
  FAILURE_PATHS,
  FORK_RULE,
  LIMIT_RULE,
  TLS_TRIAGE,
  TRIAGE_RULE,
  W9_CORRECTIONS,
  W9_CORRECTION_KIND,
  W9_STAGE_PLAN,
  type FailureMode,
  type FailurePath,
} from "./w9Topics";

const PATH_TAB_IDS = FAILURE_PATHS.map((item) => `w9-path-tab-${item.id}`);

/** 三条连接线：0 = 客户端→Nginx（跨公网），1 = Nginx→Node，2 = Node→Mongo。 */
const LINKS: Array<{ from: string; to: string }> = [
  { from: "client", to: "nginx" },
  { from: "nginx", to: "node" },
  { from: "node", to: "mongo" },
];

const nodeState = (index: number, activeIndex: number) =>
  index === activeIndex ? "current" : index < activeIndex ? "passed" : "ahead";

/** 这条路径断在第几条线上；正常路径返回 null。 */
function brokenLink(path: FailurePath): number | null {
  const last = path.frames[path.frames.length - 1];
  if (path.tone !== "failure" || !last.to) return null;
  return LINKS.findIndex((l) => l.from === last.at && l.to === last.to);
}

function linkState(path: FailurePath, index: number, link: number): string {
  const { from, to } = LINKS[link];
  const frameIdx = path.frames.findIndex((f) => f.at === from && f.to === to);
  // 本路径根本不经过这条线（例如 502 从来走不到 Node→Mongo）。
  if (frameIdx === -1) return "unused";
  if (index < frameIdx) return "ahead";
  if (index > frameIdx) return "passed";
  const isStopFrame = frameIdx === path.frames.length - 1 && path.tone === "failure";
  return isStopFrame ? "broken" : "current";
}

/** 舞台是 role="img"，给读屏一句等价描述，否则整张图对他们是空的。 */
function stageSummary(path: FailurePath, index: number): string {
  const frame = path.frames[Math.min(index, path.frames.length - 1)];
  const at = CHAIN_NODES.find((n) => n.id === frame.at)?.name ?? "";
  const to = frame.to ? CHAIN_NODES.find((n) => n.id === frame.to)?.name : null;
  const atStop = index >= path.frames.length - 1;
  const where = to ? `${at} 正在送往 ${to}` : `请求位于 ${at}`;
  if (!atStop) return `路径「${path.label}」：${where}。`;
  return path.tone === "success"
    ? `路径「${path.label}」：请求走完四跳，外部得到 ${path.status}。`
    : `路径「${path.label}」：${to ? `${at} 到 ${to} 这条线断开` : where}，外部得到 ${path.status}。`;
}

/**
 * 十个专题，每块只回答一个问题。
 *
 * 顺序是一条阅读弧线：三层结构（网络 → 授权 → 加密）→ 两类故障 → 改动纪律
 * → 验收方法 → 一处细节 → 收束。
 *
 * 8/13 重建时曾把「URL 面」并进「信任边界」，理由是两者同属最小暴露原则。
 * 那条判据用错了：本板的规则是**每块回答一个问题**，不是每块讲一条原则。
 * 「外面能摸到哪一层」问的是网络层，「进了门谁该被拦在哪一层」问的是授权层——
 * 同一条原则的两次应用，答的是两个问题，于是拆开。
 */
const W9_TOPICS = [
  { id: "boundary", label: "信任边界与端口", question: "外面能摸到哪一层" },
  { id: "urlface", label: "URL 面与授权层", question: "进了门谁被拦在哪" },
  { id: "cert", label: "证书与信任", question: "HTTPS 通了证明了什么" },
  { id: "failure", label: "故障分叉", question: "两个 502 差在哪" },
  { id: "systemd", label: "systemd 失败模式", question: "崩溃循环怎么被停住" },
  { id: "rollback", label: "改一台在跑的机器", question: "改砸了怎么退回去" },
  { id: "release", label: "发布变更单", question: "凭什么敢按下回车" },
  { id: "identity", label: "身份与权限", question: "权限报错先问哪一句" },
  { id: "spoken", label: "讲得出来才算会", question: "我以为懂了，卡在哪一层" },
  { id: "chain", label: "端到端验收链", question: "某次 200 没证明什么" },
  { id: "proxy", label: "反代 header 决策", question: "反代后该传什么头" },
  { id: "exposure", label: "服务边界 vs 暴露边界", question: "加了入口等于加业务吗" },
  { id: "evidence", label: "契约销账与闸门", question: "还欠什么" },
] as const;

const TOPIC_TAB_IDS = W9_TOPICS.map((t) => `w9-topic-tab-${t.id}`);

/**
 * 术语 / 白话开关。只切**标签文本**，舞台结构一个字不动——
 * 切成两套图会让两边慢慢漂移，也违背 roadmap「不把增加交互当成果」的口径。
 */
const PlainContext = createContext(false);

/** 一个挂了对照的术语。开关拨到白话时换成 roadmap §8 里那句，不新造。 */
function Term({ id }: { id: string }) {
  const plain = useContext(PlainContext);
  const entry = W9_GLOSSARY[id];
  if (!entry) return null;
  return (
    <span className={`w9-term${plain ? " plain" : ""}`} title={plain ? entry.term : entry.plain}>
      {plain ? entry.plain : entry.term}
    </span>
  );
}

export default function W9Board({
  mode,
  topic,
  onTopicChange,
}: {
  mode: BoardMode;
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  const review = mode === "review";
  const [plain, setPlain] = useState(false);
  const activeIndex = Math.max(0, W9_TOPICS.findIndex((t) => t.id === topic));
  const active = W9_TOPICS[activeIndex];

  return (
    <PlainContext.Provider value={plain}>
      <header className="w6-head">
        <div>
          <span>W9 · Deployment</span>
          <h2>从零到线上：请求经过哪些层，坏了先看哪里</h2>
          <p>
            最小闭环是外部 → Nginx → 只监听 loopback 的 Node → 只监听 loopback 的 MongoDB。
            8/13 收口后 Nginx 长出四个对外面（80 / 443 / 8080 / 8081），后面仍是同一条内线。
            每个专题只回答一个问题，并且都要说清结论是跑出来的还是推出来的。
          </p>
        </div>
        <div className="w9-head-right">
          <button
            type="button"
            className={`w9-plain-toggle${plain ? " on" : ""}`}
            aria-pressed={plain}
            onClick={() => setPlain((p) => !p)}
          >
            {plain ? "显示术语" : "显示白话"}
          </button>
          <strong className="w9-stage-badge">{W9_TOPICS.length} 块已落地</strong>
        </div>
      </header>

      <div
        className="w9-topic-switch"
        role="tablist"
        aria-label="W9 专题"
        onKeyDown={tabKeyDown(TOPIC_TAB_IDS, activeIndex, (i) => onTopicChange(W9_TOPICS[i].id))}
      >
        {W9_TOPICS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            id={`w9-topic-tab-${item.id}`}
            role="tab"
            aria-selected={i === activeIndex}
            aria-controls="w9-topic-panel"
            tabIndex={i === activeIndex ? 0 : -1}
            className={i === activeIndex ? "on" : ""}
            onClick={() => onTopicChange(item.id)}
          >
            <strong>{item.label}</strong>
            <small>{item.question}</small>
          </button>
        ))}
      </div>

      <GradeLegend />

      <div id="w9-topic-panel" role="tabpanel" aria-labelledby={`w9-topic-tab-${active.id}`}>
        {active.id === "systemd" ? (
          <SystemdModes review={review} />
        ) : active.id === "chain" ? (
          <AcceptanceChain review={review} />
        ) : active.id === "proxy" ? (
          <ProxyHeaders review={review} />
        ) : active.id === "evidence" ? (
          <SettlementBoard review={review} />
        ) : active.id === "boundary" ? (
          <TrustBoundary review={review} />
        ) : active.id === "urlface" ? (
          <UrlSurface review={review} />
        ) : active.id === "cert" ? (
          <CertTrust review={review} />
        ) : active.id === "rollback" ? (
          <ChangingLiveBox review={review} />
        ) : active.id === "release" ? (
          <ReleaseTicket review={review} />
        ) : active.id === "identity" ? (
          <IdentityMatrix review={review} />
        ) : active.id === "spoken" ? (
          <SpokenCheck review={review} />
        ) : active.id === "exposure" ? (
          <ServiceExposureBoard review={review} />
        ) : (
          <FailureFork review={review} />
        )}
      </div>

      <Glossary plain={plain} />
      <StagePlan />
    </PlainContext.Provider>
  );
}

/** 术语对照表：开关的「全都给我看」出口，也是 roadmap §8.3 那组类比的落点。 */
function Glossary({ plain }: { plain: boolean }) {
  const entries = Object.values(W9_GLOSSARY);
  return (
    <details className="w9-glossary">
      <summary>术语 ↔ 白话对照（{entries.length} 条）· 当前显示{plain ? "白话" : "术语"}</summary>
      <div className="w9-glossary-body">
        <p className="w9-glossary-note">
          全部取自 W9 浓缩地图 §8，不新造。术语本身要学，白话负责唤醒真实场景。
        </p>
        <ul className="w9-glossary-list">
          {entries.map((e) => (
            <li key={e.id} className={plain ? "flip" : ""}>
              <b>{e.term}</b>
              <i aria-hidden="true">↔</i>
              <span>{e.plain}</span>
            </li>
          ))}
        </ul>
        <ul className="w9-analogies">
          {W9_ANALOGIES.map((a) => (
            <li key={a.role}><b>{a.role}</b><span>{a.as}</span></li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/* 证据档位图例。本轮新增的语法，全板只解释一次。 */
function GradeLegend() {
  return (
    <section className="w9-grade-legend" aria-label="证据档位说明">
      <div className="w6-section-head">
        <span>evidence grading</span>
        <h3>每条路径都必须说清「这是跑出来的，还是推出来的」</h3>
      </div>
      <div className="w9-grade-legend-grid">
        {(Object.keys(EVIDENCE_GRADE) as EvidenceGrade[]).map((grade) => (
          <article key={grade} className={`w9-grade-${grade}`}>
            <GradeChip grade={grade} />
            <p>{EVIDENCE_GRADE[grade].meaning}</p>
          </article>
        ))}
      </div>
      <p className="w9-grade-legend-note" role="note">
        这块板里<b>实测的部分是少数</b>：故障分叉四条路径只有「正常」跑过，systemd 只有快失败跑过。
        其余来自 D1 冻结时的设计推演或契约推导。把它们画成同一种确定性，是最容易犯的错。
      </p>
    </section>
  );
}

function GradeChip({ grade }: { grade: EvidenceGrade }) {
  return (
    <span className={`w9-grade-chip ${grade}`}>
      {EVIDENCE_GRADE[grade].label}
    </span>
  );
}

/* 故障分叉主体：路径切换 + 逐帧链路 + 排障三连 + 判据对照 + 分叉规则。 */
function FailureFork({ review }: { review: boolean }) {
  const [pathId, setPathId] = useState(FAILURE_PATHS[0].id);
  const [revealed, setRevealed] = useState(false);
  const path = FAILURE_PATHS.find((item) => item.id === pathId) ?? FAILURE_PATHS[0];
  // 两条都跟着内容形态定：
  // 1. 不自动播放——认证链、W6 八段轨道、W3 pipeline 这些「请求走链路 + 每步带说明」
  //    的板全都是 autoPlay: false，节奏由读者掌握；自动播放只适合 W5 那种短状态标签。
  //    第一版沿用了 hook 的默认值 true，等于选了个和内容不匹配的约定。
  // 2. 停留时间跟解说长度走（dwellByText，全展板共用）。
  const player = useFramePlayer(path.frames.length, {
    autoPlay: false,
    intervalAt: (i) => dwellByText(path.frames[i]?.narration ?? ""),
  });

  // 切路径回到第 1 帧：不重置的话会停在上一条路径的末帧上，读成「这条也走到了那里」。
  // 刻意不放进 useEffect —— replay 每次渲染都是新的函数身份，作为依赖会让效果每帧重跑，
  // 把 index 一直摁回 0，链路就再也推不动了。改由选择动作本身触发，点击与方向键共用。
  function selectPath(id: string) {
    setPathId(id);
    player.replay();
  }

  // 切换展示 / 复习时收回答案，避免复习态一进来就看到上一次揭示的结果。
  useEffect(() => {
    setRevealed(false);
  }, [review]);

  const frame = path.frames[Math.min(player.index, path.frames.length - 1)];
  const atStop = player.index >= path.frames.length - 1;
  const showAnswer = !review || revealed;
  const activeIndex = CHAIN_NODES.findIndex((node) => node.id === frame.at);
  const stopIndex = CHAIN_NODES.findIndex(
    (node) => node.id === (path.frames[path.frames.length - 1].to ?? path.frames[path.frames.length - 1].at),
  );

  return (
    <section className="w9-fork" aria-label="故障分叉">
      <div className="w6-section-head">
        <span>same chain, four stops</span>
        <h3>条件在标签上，结论在链路里——先走完再看状态码</h3>
      </div>

      <div
        className="w9-path-switch"
        role="tablist"
        aria-label="链路结局"
        onKeyDown={tabKeyDown(
          PATH_TAB_IDS,
          FAILURE_PATHS.findIndex((item) => item.id === pathId),
          (index) => selectPath(FAILURE_PATHS[index].id),
        )}
      >
        {FAILURE_PATHS.map((item) => {
          const selected = item.id === pathId;
          return (
            <button
              key={item.id}
              type="button"
              id={`w9-path-tab-${item.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls="w9-path-panel"
              tabIndex={selected ? 0 : -1}
              className={selected ? "on" : ""}
              onClick={() => selectPath(item.id)}
            >
              <strong>{item.label}</strong>
              <small>{item.grade === "measured" ? "实测" : item.grade === "derived" ? "推演" : "待做"}</small>
            </button>
          );
        })}
      </div>

      <div id="w9-path-panel" role="tabpanel" aria-labelledby={`w9-path-tab-${path.id}`}>
        <p className="w9-condition">
          <b>条件</b>
          {path.condition}
        </p>

        {/* 舞台：两个信任面各是一个真的包围框，请求沿连接线走，断点落在线上而不是节点上。
            502 断在 Nginx→Node 那条线，500 断在 Node→Mongo 那条线——位置本身就是结论。 */}
        <div className="w9-stage-scroll">
          <div className="w9-stage" role="img" aria-label={stageSummary(path, player.index)}>
            <Plane kind="client" label={PLANE_LABEL.client}>
              <Node node={CHAIN_NODES[0]} state={nodeState(0, activeIndex)} />
            </Plane>

            <Link path={path} index={player.index} link={0} />

            <Plane kind="public" label={PLANE_LABEL.public} gate="ufw 只放行 22 / 80">
              <Node node={CHAIN_NODES[1]} state={nodeState(1, activeIndex)} />
            </Plane>

            <Link path={path} index={player.index} link={1} />

            <Plane kind="loopback" label={PLANE_LABEL.loopback}>
              <Node
                node={CHAIN_NODES[2]}
                state={nodeState(2, activeIndex)}
                stopLabel={atStop && stopIndex === 2 ? path.stopLabel : undefined}
                tone={path.tone}
              />
              <Link path={path} index={player.index} link={2} />
              <Node
                node={CHAIN_NODES[3]}
                state={nodeState(3, activeIndex)}
                stopLabel={atStop && stopIndex === 3 ? path.stopLabel : undefined}
                tone={path.tone}
              />
            </Plane>
          </div>
        </div>

        {/* 当前这一跳负责什么，只在走到它时给——四个节点常驻四段说明是上一版最主要的文字堆积。 */}
        <p className="w9-role-now">
          <b>{CHAIN_NODES[activeIndex]?.name}</b>
          {CHAIN_NODES[activeIndex]?.role}
          {CHAIN_NODES[activeIndex]?.term && <em>{CHAIN_NODES[activeIndex].term}</em>}
        </p>

        {/* 手机端舞台会局部横向滚动，这条轨道给出可扫读的四跳与当前位置。 */}
        <div className="mobile-scroll-cue w9-chain-cue" aria-hidden="true">
          {CHAIN_NODES.map((node, index) => (
            <span key={node.id} className={index === activeIndex ? "on" : ""}>
              {index + 1}
              <small>{node.name}</small>
            </span>
          ))}
        </div>

        <FrameTransport player={player} length={path.frames.length} label="请求推进" />
        <FrameNarration
          step={player.index + 1}
          text={frame.narration}
          tone={atStop ? (path.tone === "success" ? "status-200" : "blocked") : undefined}
        />

        {/* 状态码走到停止点之后才揭示：从一开始就摆着的标签，会把「推导结论」变成「已知条件」。 */}
        <div className={`w9-status-reveal${atStop ? " on" : ""}`} role="status">
          {atStop ? (
            <>
              <span>外部看到</span>
              <strong className={path.tone}>{path.status}</strong>
              <small>
                {path.tone === "success" ? ACCEPTANCE_READINGS.sample : "请求没有走完这条链路"}
              </small>
            </>
          ) : (
            <span className="w9-status-pending">走到停止点后揭示状态码</span>
          )}
        </div>

        {/* 档位说明必须与图相邻，不能只放折叠区。 */}
        <p className={`w9-grade-note ${path.grade}`}>
          <GradeChip grade={path.grade} />
          <span>{path.gradeNote}</span>
        </p>

        {path.id === "boot-db-down" && (
          <p className="w9-startup-note" role="note">
            <b>为什么连不上就等于没监听</b>
            {STARTUP_ORDER_NOTE}
          </p>
        )}
        {path.id === "ok" && (
          <p className="w9-startup-note" role="note">
            <b>反代确实贯通的反证</b>
            {ACCEPTANCE_READINGS.proxyProof}
          </p>
        )}

        {/* 复习态先只给条件与现象，答案（怎么查、判据是什么）由局部 reveal 展开。 */}
        {!showAnswer ? (
          <div className="w9-reveal-gate">
            <strong>先答：现在只知道外部拿到 502</strong>
            <p>
              说出<b>第一个排查动作</b>，以及这个动作的两种结果分别指向哪条路径、下一步该看什么。
              再说一句：什么情况下外部看到的会是 500 而不是 502。
            </p>
            <button type="button" onClick={() => setRevealed(true)}>展开排查路线与判据</button>
          </div>
        ) : (
          <>
            {/* 正常路径没有可排查的东西，渲染两个空框只会是噪声。 */}
            {path.tone === "failure" && (
              <div className="w9-triage">
                <article className="w9-triage-action">
                  <span>第一个排查动作</span>
                  <code>{path.firstAction}</code>
                </article>
                <article className="w9-triage-cause">
                  <span>根因</span>
                  <p>{path.rootCause}</p>
                </article>
              </div>
            )}

            <StopOverview current={path.id} onSelect={selectPath} />
            <DiscriminatorTable />
            <ForkRule />
            <TlsTriage />
          </>
        )}
      </div>
    </section>
  );
}

/**
 * 443 上线之后新增的一类问法：「域名打不开」。
 * 它比 502 更早一步——502 至少说明请求摸到了 Nginx，而超时可能连主机都没进。
 * 空间编码是两条互不相交的竖列：症状先分相位，同一相位内才逐层往下。
 */
function TlsTriage() {
  const [phaseId, setPhaseId] = useState(TLS_TRIAGE[0].id);
  const phase = TLS_TRIAGE.find((p) => p.id === phaseId) ?? TLS_TRIAGE[0];

  return (
    <div className="w9-tls">
      <div className="w6-section-head">
        <span>before the 502</span>
        <h3>443 之后多了一种问法：域名打不开，先分相位再查层</h3>
      </div>

      <div className="w9-tls-phases" role="group" aria-label="排查相位">
        {TLS_TRIAGE.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`w9-tls-phase${p.id === phaseId ? " on" : ""}`}
            aria-pressed={p.id === phaseId}
            onClick={() => setPhaseId(p.id)}
          >
            <em>{p.symptom}</em>
            <strong>{p.label}</strong>
          </button>
        ))}
      </div>

      <p className={`w9-grade-note ${phase.grade}`}>
        <GradeChip grade={phase.grade} />
        <span>{phase.gradeNote}</span>
      </p>
      <p className="w9-tls-why">{phase.why}</p>

      <ol className="w9-tls-steps">
        {phase.steps.map((step) => (
          <li key={step.layer}>
            <strong>{step.layer}</strong>
            <code>{step.command}</code>
            <p className="pass"><b>过</b>{step.pass}</p>
            <p className="fail"><b>停</b>{step.fail}</p>
          </li>
        ))}
      </ol>

      <p className="w9-tls-rule"><b>不能越过的那条界</b>{TRIAGE_RULE}</p>
    </div>
  );
}

/* ---- 舞台构件 ---- */

/** 信任面：一个真的包围框，不是给每个节点各描一道边。 */
function Plane({
  kind,
  label,
  gate,
  children,
}: {
  kind: ChainNode["plane"];
  label: string;
  gate?: string;
  children: ReactNode;
}) {
  return (
    <div className={`w9-plane ${kind}`}>
      <span className="w9-plane-label">{label}</span>
      {gate && <span className="w9-plane-gate">{gate}</span>}
      <div className="w9-plane-body">{children}</div>
    </div>
  );
}

function Node({
  node,
  state,
  stopLabel,
  tone,
}: {
  node: ChainNode;
  state: string;
  stopLabel?: string;
  tone?: string;
}) {
  return (
    <div className={`w9-node ${state}${stopLabel ? ` stop ${tone}` : ""}`}>
      <strong>{node.name}</strong>
      <code>{node.addr}</code>
      {stopLabel && <span className={`w9-node-stop ${tone}`}>{stopLabel}</span>}
    </div>
  );
}

/**
 * 连接线。断点画在线上：502 断在 Nginx→Node，500 断在 Node→Mongo——
 * 断在哪条线本身就是「停得多深」这个结论，比把红色涂在某个节点上准确。
 */
function Link({ path, index, link }: { path: FailurePath; index: number; link: number }) {
  const state = linkState(path, index, link);
  return (
    <div className={`w9-link ${state}`} aria-hidden="true">
      <i className="w9-link-line" />
      <span className="w9-link-mark">{state === "broken" ? "✕" : "›"}</span>
    </div>
  );
}

/* 一眼结论图：四条路径分别断在哪，一屏看完，不用点四次。 */
function StopOverview({ current, onSelect }: { current: string; onSelect: (id: string) => void }) {
  return (
    <div className="w9-overview">
      <span className="w9-overview-label">四种停法的位置对照</span>
      <div className="w9-overview-rows">
        {FAILURE_PATHS.map((item) => {
          const broken = brokenLink(item);
          return (
            <button
              key={item.id}
              type="button"
              className={`w9-overview-row${item.id === current ? " on" : ""}`}
              onClick={() => onSelect(item.id)}
              aria-pressed={item.id === current}
            >
              <span className="w9-overview-name">{item.label}</span>
              <span className="w9-mini" aria-hidden="true">
                {CHAIN_NODES.map((node, i) => (
                  <Fragment key={node.id}>
                    {i > 0 && (
                      <i
                        className={`w9-mini-link${
                          broken === null || i - 1 < broken ? " passed" : broken === i - 1 ? " broken" : " unused"
                        }`}
                      />
                    )}
                    <i
                      className={`w9-mini-dot${
                        broken === null || i <= broken ? " reached" : " unreached"
                      }`}
                    />
                  </Fragment>
                ))}
              </span>
              <em className={item.tone}>{item.status}</em>
            </button>
          );
        })}
      </div>
      <p className="w9-overview-note">
        两条 502 断在<b>同一条线</b>上——所以外部现象一样。500 断得更深，请求已经进到应用里了。
      </p>
    </div>
  );
}

/* 判据对照：四条路径 × 四个观察点。决定性的两格单独标出。 */
function DiscriminatorTable() {
  return (
    <div className="w9-matrix" role="table" aria-label="四条路径的判据对照">
      <div className="w9-matrix-head" role="row">
        <span role="columnheader">观察点</span>
        {FAILURE_PATHS.map((path) => (
          <span key={path.id} role="columnheader">
            {path.label}
          </span>
        ))}
      </div>
      {DISCRIMINATOR_ROWS.map((row, index) => (
        <div key={row} className="w9-matrix-row" role="row">
          <code role="rowheader">{row}</code>
          {FAILURE_PATHS.map((path) => {
            const cell = path.discriminators[index];
            return (
              <span
                key={path.id}
                role="cell"
                // 手机端表头被隐藏，靠这个属性在每格前重复列语义，不靠横向记忆。
                data-path={path.label}
                className={`w9-matrix-cell${cell.key ? " key" : ""}`}
              >
                {cell.value}
              </span>
            );
          })}
        </div>
      ))}
      <p className="w9-matrix-note">
        标出的格子是决定性判据。注意「反代地址写错」整列都是健康读数——
        <b>所有单点健康检查都会通过</b>，问题在两个健康组件之间的那一行配置。
      </p>
    </div>
  );
}

/* 本板要留下的那条可迁移规则。 */
function ForkRule() {
  return (
    <section className="w9-rule" aria-label="502 的排查分叉">
      <div className="w6-section-head">
        <span>the transferable rule</span>
        <h3>外部现象相同，用第一个动作的<b>结果</b>分叉</h3>
      </div>
      <div className="w9-rule-tree">
        <div className="w9-rule-symptom">
          <span>现象</span>
          <strong>{FORK_RULE.symptom}</strong>
        </div>
        <div className="w9-rule-action">
          <span>第一个动作</span>
          <code>{FORK_RULE.action}</code>
        </div>
        <ul className="w9-rule-branches">
          {FORK_RULE.branches.map((branch) => (
            <li key={branch.result}>
              <em>{branch.result}</em>
              <strong>{branch.conclusion}</strong>
              <p>{branch.next}</p>
            </li>
          ))}
        </ul>
      </div>
      <p className="w9-rule-note" role="note">{FORK_RULE.note}</p>
    </section>
  );
}

/* ==========================================================================
   ① 信任边界与端口。
   空间编码换一种，不重复故障分叉板的链路形态：这里是**嵌套的可达层**——
   公网 →（安全组 → ufw 两道闸门）→ 主机 → 对外监听面 / loopback 内线。
   「外面能摸到哪一层」直接读成深度：端口落在第几层，就是外面能不能摸到它。
   ========================================================================== */

const GATE_MARK: Record<Gate, { text: string; cls: string }> = {
  allow: { text: "放行", cls: "allow" },
  deny: { text: "拦住", cls: "deny" },
  unknown: { text: "未知", cls: "unknown" },
  na: { text: "不适用", cls: "na" },
};

function TrustBoundary({ review }: { review: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const port = PORT_ROWS.find((p) => p.port === selected) ?? null;
  const showAnswer = !review || revealed;

  useEffect(() => {
    setRevealed(false);
    setSelected(null);
  }, [review]);

  const exposed = PORT_ROWS.filter((p) => p.layer === "exposed");
  const loopback = PORT_ROWS.filter((p) => p.layer === "loopback");

  return (
    <section className="w9-boundary" aria-label="信任边界与端口">
      <div className="w6-section-head">
        <span>how deep can the outside reach</span>
        <h3>公网请求最多到第二层，再往里都是本机内线</h3>
      </div>

      {/* 嵌套层：由外向内。端口落在第几层，就是外面能不能摸到它。 */}
      <div className="w9-layers" role="img" aria-label={layersSummary()}>
        <div className="w9-layer public">
          <span className="w9-layer-label">公网 · 任何人都能发起</span>

          <div className="w9-gates">
            {GATES.map((g, i) => (
              <div key={g.id} className={`w9-gate ${g.grade}`}>
                <b>闸门 {i + 1}</b>
                <strong>{g.name}</strong>
                <small>{g.where}</small>
              </div>
            ))}
          </div>

          <div className="w9-layer host">
            <span className="w9-layer-label">主机 · 过了两道闸门才到这里</span>

            <div className="w9-port-zone exposed">
              <span className="w9-zone-label">对外监听面 · <Term id="plane-public" /></span>
              <div className="w9-port-chips">
                {exposed.map((p) => (
                  <PortChip key={p.port} row={p} on={selected === p.port} onPick={setSelected} />
                ))}
              </div>
            </div>

            <div className="w9-port-zone loopback">
              <span className="w9-zone-label"><Term id="plane-loopback" /> · 只有同机进程连得上</span>
              <div className="w9-port-chips">
                {loopback.map((p) => (
                  <PortChip key={p.port} row={p} on={selected === p.port} onPick={setSelected} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {port ? (
        <div className={`w9-port-detail ${port.publicReachable ? "public" : "internal"}`}>
          <header>
            <code>:{port.port}</code>
            <strong>{port.process}</strong>
            <GradeChip grade={port.grade} />
            <em>{port.status}</em>
          </header>
          <dl>
            <div><dt>监听地址</dt><dd>{port.bind ?? "当前没有进程在监听"}</dd></div>
            <div><dt>谁需要它</dt><dd>{port.needs}</dd></div>
            <div><dt>不开的后果</dt><dd>{port.ifClosed}</dd></div>
          </dl>
        </div>
      ) : (
        <p className="w9-port-hint">点上面任意一个端口，看它的监听地址、谁需要它、不开会怎样。</p>
      )}

      {!showAnswer ? (
        <div className="w9-reveal-gate">
          <strong>先答：哪些端口公网摸得到</strong>
          <p>
            七个端口里，说出哪几个外面能摸到、凭什么；再答两句——
            <b>3000 关掉会怎样</b>，以及 <b>27017 从来不对外开，为什么还能用</b>。
          </p>
          <button type="button" onClick={() => setRevealed(true)}>展开可达性判定</button>
        </div>
      ) : (
        <>
          <ReachTable selected={selected} onPick={setSelected} />
          <div className="w9-boundary-notes">
            <p className="w9-bn not-unused"><b>❌ 不等于没在用</b>{BOUNDARY_NOTES.notUnused}</p>
            <p className="w9-bn depth"><b><Term id="defense-in-depth" /></b>{BOUNDARY_NOTES.defenseInDepth}</p>
            <p className="w9-bn gates"><b>ufw 不是全部</b>{BOUNDARY_NOTES.twoGates}</p>
          </div>
          <GateDifferential />
        </>
      )}

      <PublicFaces />
    </section>
  );
}

/* ==========================================================================
   ⑩ 服务边界 vs 暴露边界（D4-c，2026-08-13）。
   空间编码是两个**分离的数**：左边数后端进程，右边数 server block——
   两个数不相同这件事本身就是结论。类比用「一个厨房四个门」落在下方。
   ========================================================================== */

function ServiceExposureBoard({ review }: { review: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const showAnswer = !review || revealed;

  useEffect(() => {
    setRevealed(false);
  }, [review]);

  return (
    <section className="w9-exposure" aria-label="服务边界 vs 暴露边界">
      <div className="w6-section-head">
        <span>services vs doorways</span>
        <h3>加了入口 ≠ 加了业务：数服务看进程，数入口看门</h3>
      </div>

      {/* 两个数并排，数字本身是结论——1 个服务、5 扇门（而 server 块只有 4 份）。 */}
      <div className="w9-exposure-counts">
        {SERVICE_EXPOSURE.map((item) => (
          <article
            key={item.id}
            className={`w9-exposure-card ${item.kind}`}
          >
            <em>{item.kind === "service" ? "服务边界" : "暴露边界"}</em>
            <strong>{item.countBy}</strong>
            <span className="w9-exposure-current">{item.current}</span>
            <p className="w9-exposure-note">{item.note}</p>
            <p className="w9-exposure-change"><b>动它会怎样</b>{item.ifChanged}</p>
          </article>
        ))}
      </div>

      <p className="w9-exposure-note-main" role="note">{SERVICE_EXPOSURE_NOTE}</p>

      {/* 三种切分方式。两天各选了一种，所以这张表不是「为什么用端口」，是「什么时候用哪种」。 */}
      <div className="w9-exposure-split">
        <div className="w6-section-head">
          <span>how to split doorways</span>
          <h3>用端口、域名还是路径切？两天里选了两种</h3>
        </div>
        <div className="w9-exposure-split-list">
          {EXPOSURE_SPLIT.map((s) => (
            <article key={s.way} className={`w9-exposure-split-item${s.chosenWhen ? " chosen" : ""}`}>
              <strong>{s.way}</strong>
              <code>{s.example}</code>
              <p>{s.cost}</p>
              <em>{s.chosenWhen ?? "没选过"}</em>
            </article>
          ))}
        </div>
        <p className="w9-exposure-split-note" role="note">{EXPOSURE_SPLIT_NOTE}</p>
      </div>

      {!showAnswer ? (
        <div className="w9-reveal-gate">
          <strong>先答：加一个学习展板站点，算不算加了一个业务</strong>
          <p>
            说出判断依据：<b>数哪个量</b>能回答这个问题；
            再说两句——为什么 8081 用<b>独立端口</b>而不是往 80 的 URL 面里塞，
            而一天之后 admin 却选了 443 的<b>子路径</b>。
          </p>
          <button type="button" onClick={() => setRevealed(true)}>展开结论与三个可迁移点</button>
        </div>
      ) : (
        <div className="w9-exposure-notes">
          <p className="w9-bn"><b>职责分离</b>{SERVICE_EXPOSURE_TAKEAWAYS.decoupled}</p>
          <p className="w9-bn"><b>网关地基</b>{SERVICE_EXPOSURE_TAKEAWAYS.microservices}</p>
          <p className="w9-bn"><b>服务没变，门换了</b>{SERVICE_EXPOSURE_TAKEAWAYS.doorMoved}</p>
        </div>
      )}
    </section>
  );
}

/**
 * 两道闸门第一次被分别观察到。放在闸门图之后、URL 面之前：
 * 它是「端口面」这一节的收束——两层不是同一层的两种说法，失败形态可以把它们分开。
 */
function GateDifferential() {
  return (
    <div className="w9-gate-diff">
      <div className="w9-gate-diff-head">
        <span className="w9-overview-label">两道闸门被分开看见的那一刻 · 443 放行前后的差分</span>
        <GradeChip grade="measured" />
      </div>
      <div className="w9-gate-diff-pair">
        <article className="before">
          <em>控制台放行前</em>
          <code>{GATE_DIFFERENTIAL.before.symptom}</code>
          <p>{GATE_DIFFERENTIAL.before.meaning}</p>
        </article>
        <i aria-hidden="true">→</i>
        <article className="after">
          <em>放行后（此时还没配 443 站点）</em>
          <code>{GATE_DIFFERENTIAL.after.symptom}</code>
          <p>{GATE_DIFFERENTIAL.after.meaning}</p>
        </article>
      </div>
      <p className="w9-gate-diff-rule"><b>可迁移的那一条</b>{GATE_DIFFERENTIAL.rule}</p>
    </div>
  );
}

/**
 * 五个对外面。位置编码：五张卡并排 = 同一层的五扇门，卡内「转给谁」那一行才是差别所在。
 * 第五张刻意长得不一样（它挂在别人的 server 块里），因为这正是 8/14 那次发布的形态。
 */
function PublicFaces() {
  const blocks = new Set(PUBLIC_FACES.filter((f) => f.blockKind === "server").map((f) => f.site)).size;
  return (
    <div className="w9-faces">
      <div className="w6-section-head">
        <span>five faces, one chain</span>
        <h3>
          Nginx 现在有 {PUBLIC_FACES.length} 个面、{blocks} 份 server 块，后面接的仍是同一条内线
        </h3>
      </div>
      <div className="w9-face-cards">
        {PUBLIC_FACES.map((face) => (
          <article key={face.id} className={`w9-face ${face.scheme} ${face.blockKind}`}>
            <header>
              <code>:{face.port}</code>
              <em>{face.scheme === "https" ? "TLS 加密" : "明文"}</em>
              <GradeChip grade={face.grade} />
            </header>
            <span className="w9-face-kind">
              {face.blockKind === "server" ? "自带一份 server 块" : "挂在 443 那份 server 块里的一个 location"}
            </span>
            <strong>{face.site}</strong>
            <p className="w9-face-serves">{face.serves}</p>
            <div className="w9-face-allow">
              <span>放行</span>
              <ul>
                {face.allow.map((a) => <li key={a}><code>{a}</code></li>)}
              </ul>
            </div>
            <p className="w9-face-fallback"><b>其余</b>{face.fallback}</p>
            <p className="w9-face-proof"><b>验收</b>{face.proof}</p>
            <span className="w9-face-when">{face.when}</span>
          </article>
        ))}
      </div>
      <p className="w9-faces-note" role="note">{FACES_NOTE}</p>
    </div>
  );
}

/**
 * ② URL 面与授权层（段 0）。
 *
 * 端口面之后的第二次最小暴露，但问的是另一个问题：端口面回答「哪几扇门开着」，
 * 这里回答「进了门之后，谁该被拦在哪一层」——后者是 W4 的授权知识落到部署层。
 * 转折点在最后：收窄的是「面」，不是「层」，账单就是 Q8。
 */
function UrlSurface({ review }: { review: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const showAnswer = !review || revealed;

  useEffect(() => {
    setRevealed(false);
  }, [review]);

  return (
    <section className="w9-url" aria-label="URL 面与授权层">
      <div className="w6-section-head">
        <span>the second narrowing</span>
        <h3>端口面之后是 URL 面：进了门，哪几个房间是通的</h3>
      </div>

      {/* 空间编码：白名单三条在里、兜底一条在外，包含关系就是「其余全落进兜底」。 */}
      <div className="w9-url-map" role="img" aria-label={urlSummary()}>
        <div className="w9-url-outer">
          <span className="w9-url-outer-label">
            公网发来的任意路径
          </span>
          <div className="w9-url-inner">
            <span className="w9-url-inner-label">白名单 · 逐条读代码定下来的</span>
            {URL_RULES.filter((r) => r.kind === "allow").map((rule) => (
              <article key={rule.path} className="w9-url-rule allow">
                <code>{rule.path}</code>
                <p>{rule.why}</p>
                {rule.codeEvidence && <small>{rule.codeEvidence}</small>}
              </article>
            ))}
          </div>
          {URL_RULES.filter((r) => r.kind === "deny").map((rule) => (
            <article key={rule.path} className="w9-url-rule deny">
              <code>{rule.path}</code>
              <p>{rule.why}</p>
            </article>
          ))}
        </div>
      </div>

      {!showAnswer ? (
        <div className="w9-reveal-gate">
          <strong>先答：为什么是 404 而不是 403</strong>
          <p>
            白名单外的路径，返回 404、403 还是直接断开？说出你的选择<b>向扫描者透露了什么</b>；
            再答一句——把 <code>/users</code> 挡在 Nginx 这一层，<b>防住的是谁、没防住的是谁</b>。
          </p>
          <button type="button" onClick={() => setRevealed(true)}>展开拒绝形态与层的选择</button>
        </div>
      ) : (
        <>
          <div className="w9-deny">
            <div className="w9-deny-chosen">
              <span className="w9-overview-label">默认拒绝的形态</span>
              <strong>{DENY_FORM.chosen}</strong>
              <p>{DENY_FORM.why}</p>
            </div>
            <div className="w9-deny-rejected">
              <p><b>不选 403</b>{DENY_FORM.rejected403}</p>
              <p><b>不选直接断开</b>{DENY_FORM.rejectedDrop}</p>
            </div>
            <p className="w9-deny-bonus"><b>顺带得到的排障信号</b>{DENY_FORM.twoKindsOf404}</p>
          </div>

          {/* 两层威胁模型：并排放才看得出它们不重叠。 */}
          <div className="w9-layers-choice">
            <div className="w6-section-head">
              <span>which layer</span>
              <h3>{LAYER_CHOICE.question}</h3>
            </div>
            <div className="w9-layer-pair">
              <article className="chosen">
                <em>反代层 · 8/13 选了它</em>
                <p className="defends"><b>防住</b>{LAYER_CHOICE.proxyLayer.defends}</p>
                <p className="blind"><b>没防住</b>{LAYER_CHOICE.proxyLayer.blind}</p>
              </article>
              <article className="not-done">
                <em>应用层 · 8/13 没做，8/14 补上</em>
                <p className="defends"><b>能防住</b>{LAYER_CHOICE.appLayer.defends}</p>
                <p className="blind"><b>单靠它不够</b>{LAYER_CHOICE.appLayer.blind}</p>
              </article>
            </div>
            <p className="w9-layer-ok"><b>8/13 为什么够用</b>{LAYER_CHOICE.whyOkForNow}</p>
            <p className="w9-layer-cost" role="note"><b>代价</b>{LAYER_CHOICE.costLater}</p>
            <p className="w9-layer-resolved"><b>一天后的结局</b>{LAYER_CHOICE.resolved}</p>
          </div>

          <SecurityDebtCard />
          <TwoLayerDefense />
        </>
      )}
    </section>
  );
}

function urlSummary(): string {
  const allow = URL_RULES.filter((r) => r.kind === "allow").map((r) => r.path).join("、");
  return `公网发来的任意路径落在最外层；里面一圈是白名单 ${allow}，只有它们会被转给 Node；白名单之外的一切被最外层的兜底规则直接返回 404。`;
}

/**
 * Q8 安全债。刻意跟在「层的选择」后面——它就是那个选择开出来的账单。
 * 8/14 已还，但欠债那一段保留原样：一条债的价值有一半在「当时为什么敢欠」。
 */
function SecurityDebtCard() {
  return (
    <div className="w9-debt repaid">
      <div className="w9-debt-head">
        <span>Q8 · 这个选择欠下的账，8/14 已还</span>
        <GradeChip grade={SECURITY_DEBT.grade} />
      </div>
      <p className="w9-debt-what">{SECURITY_DEBT.what}</p>
      <dl>
        <div><dt>当时的缓解</dt><dd>{SECURITY_DEBT.mitigation}</dd></div>
        <div><dt>归类</dt><dd>{SECURITY_DEBT.classify}</dd></div>
        <div><dt>怎么还的</dt><dd>{SECURITY_DEBT.repay.how}</dd></div>
        <div><dt>为什么统一挂</dt><dd>{SECURITY_DEBT.repay.whyUnified}</dd></div>
        <div><dt>顺序与一处纠正</dt><dd>{SECURITY_DEBT.repay.orderNote}</dd></div>
        <div><dt>什么时候</dt><dd>{SECURITY_DEBT.repay.when}</dd></div>
      </dl>

      {/* 三档 + 回归，期望与实测并排——「验了」和「验对了」是两件事。 */}
      <div className="w9-debt-verify-wrap">
        <table className="w9-debt-verify">
          <caption>还债验收：先写期望，再对结果</caption>
          <thead>
            <tr><th scope="col">场景</th><th scope="col">期望</th><th scope="col">实测</th></tr>
          </thead>
          <tbody>
            {SECURITY_DEBT.verify.map((v) => (
              <tr key={v.case}>
                <th scope="row">{v.case}</th>
                <td>{v.expect}</td>
                <td className="w9-debt-got">{v.got}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="w9-debt-online"><b>线上复现</b>{SECURITY_DEBT.online}</p>
      <p className="w9-debt-lesson">{SECURITY_DEBT.lesson}</p>
    </div>
  );
}

/**
 * 还债之后，同一个请求走出两条路。这是本块的新图：
 * 空间编码是**两条路径各自停在哪一层**——404 停在 Nginx，401 停进了 Express。
 * 两个数字回答的是两个问题，而它们的差别只有换一个发起位置才看得见。
 */
function TwoLayerDefense() {
  return (
    <div className="w9-twolayer">
      <div className="w6-section-head">
        <span>one request, two walls</span>
        <h3>还债之后：同一个 /users，两条路、两个停止点</h3>
      </div>
      <p className="w9-twolayer-req">
        请求是同一个：<code>{TWO_LAYER_DEFENSE.request}</code>。变的只有从哪里发出去。
      </p>
      <div className="w9-twolayer-paths">
        {TWO_LAYER_DEFENSE.paths.map((p) => (
          <article key={p.id} className={`w9-twolayer-path ${p.id}`}>
            <em className="w9-twolayer-from">{p.from}</em>
            {/*
              内线那条是**绕过** Nginx 的，不是穿过它。第一版把两条都画成
              「发起 → Nginx → Express」，等于说内线也经过了门卫——那正好是这块板
              要否掉的误解。所以 Nginx 在内线这条上是灰的，线从它旁边绕过去。
            */}
            <div className="w9-twolayer-track" aria-hidden="true">
              <span className="w9-twolayer-origin">发起</span>
              <span className={`w9-twolayer-link ${p.id === "public" ? "through" : "bypass"}`}>
                {p.id === "internal" ? <small>绕过</small> : null}
              </span>
              <span className={`w9-twolayer-node${p.id === "internal" ? " dim" : ""}`}>Nginx</span>
              <span className={`w9-twolayer-link ${p.id === "public" ? "cut" : "through"}`}>
                {p.id === "public" ? <small>✕</small> : null}
              </span>
              <span className={`w9-twolayer-node${p.id === "public" ? " dim" : ""}`}>Express</span>
            </div>
            <div className="w9-twolayer-stop">
              <strong>停在 {p.stopAt}</strong>
              <span className="w9-twolayer-code">{p.code}</span>
            </div>
            <p className="w9-twolayer-body">{p.body}</p>
            <p className="w9-bn"><b>为什么停这里</b>{p.why}</p>
            <p className="w9-bn"><b>它挡的是谁</b>{p.defends}</p>
          </article>
        ))}
      </div>
      <p className="w9-twolayer-take" role="note">{TWO_LAYER_DEFENSE.takeaway}</p>
    </div>
  );
}

function layersSummary(): string {
  const pub = PORT_ROWS.filter((p) => p.publicReachable).map((p) => p.port).join(" / ");
  const inner = PORT_ROWS.filter((p) => !p.publicReachable).map((p) => p.port).join(" / ");
  return `由外向内三层：公网、两道闸门（腾讯云安全组与 ufw）、主机。主机内分两区：对外监听面公网摸得到，当前是 ${pub}；loopback 内线只有同机进程连得上，当前是 ${inner}。`;
}

function PortChip({
  row,
  on,
  onPick,
}: {
  row: PortRow;
  on: boolean;
  onPick: (port: string) => void;
}) {
  return (
    <button
      type="button"
      className={`w9-port-chip ${row.grade}${row.publicReachable ? " reachable" : ""}${on ? " on" : ""}`}
      onClick={() => onPick(row.port)}
      aria-pressed={on}
    >
      <code>:{row.port}</code>
      <small>{row.bind ?? "未监听"}</small>
    </button>
  );
}

/** 一眼结论图：可达性是三个条件的合取，任何一格拦住就摸不到。 */
function ReachTable({ selected, onPick }: { selected: string | null; onPick: (p: string) => void }) {
  return (
    <div className="w9-reach" role="table" aria-label="公网可达性判定">
      <span className="w9-overview-label">公网可达 = 安全组放行 ∧ ufw 放行 ∧ 监听地址对外</span>
      <div className="w9-reach-head" role="row">
        <span role="columnheader">端口</span>
        <span role="columnheader">安全组</span>
        <span role="columnheader">ufw</span>
        <span role="columnheader">监听地址</span>
        <span role="columnheader">公网可达</span>
      </div>
      {PORT_ROWS.map((row) => (
        <button
          key={row.port}
          type="button"
          className={`w9-reach-row${row.port === selected ? " on" : ""}`}
          role="row"
          onClick={() => onPick(row.port)}
        >
          <code role="cell">:{row.port}</code>
          {/* data-col：手机端隐藏表头后靠它在每格前重复列语义 */}
          <span role="cell" data-col="安全组" className={`w9-gate-mark ${GATE_MARK[row.cloudGate].cls}`}>{GATE_MARK[row.cloudGate].text}</span>
          <span role="cell" data-col="ufw" className={`w9-gate-mark ${GATE_MARK[row.ufw].cls}`}>{GATE_MARK[row.ufw].text}</span>
          <span role="cell" data-col="监听地址" className={`w9-gate-mark ${row.bind?.startsWith("0.0.0.0") ? "allow" : row.bind ? "deny" : "unknown"}`}>
            {row.bind ? (row.bind.startsWith("0.0.0.0") ? "对外" : "仅本机") : "未监听"}
          </span>
          <span role="cell" className={`w9-reach-verdict ${row.publicReachable ? "yes" : "no"}`}>
            {row.publicReachable ? "摸得到" : "摸不到"}
          </span>
        </button>
      ))}
      <p className="w9-reach-note">
        安全组那一列在 8/12 还只是反推（由公网 200 倒推 22 与 80 被放行）；<b>8/13 放 8080 与 443 时两次真的动了控制台</b>，
        并拿到「放行前超时 → 放行后拒绝」的差分——这一列现在是观察，不再是反推。
        三格里只要有一格拦住，结论就是摸不到。
      </p>
    </div>
  );
}

/* ==========================================================================
   ⑦ 证书与信任。
   空间编码是**嵌套的签名关系**：四环由外向内层层签名，最外层是系统里早就装好的
   根证书库。「被信任」于是是一条看得见的指回路径，而不是一句形容词。
   第二段用一条 90 天时间轴回答「为什么这件事必须自动化」。
   ========================================================================== */

function CertTrust({ review }: { review: boolean }) {
  const [linkId, setLinkId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const showAnswer = !review || revealed;
  const link = TRUST_CHAIN.find((l) => l.id === linkId) ?? null;

  useEffect(() => {
    setRevealed(false);
    setLinkId(null);
  }, [review]);

  return (
    <section className="w9-cert" aria-label="证书与信任">
      <div className="w6-section-head">
        <span>what a green lock actually proves</span>
        <h3>200 只证明有东西在应答，SSL_VERIFY:0 才证明它被信任</h3>
      </div>

      {/* 四环**真嵌套**：包含关系就是签名关系，外面那一环给里面那一环背书。
          平铺成四张卡片会让「被信任」退回成一句形容词——必须是 DOM 上的层层包住。 */}
      <div className="w9-chain-trust" role="img" aria-label={trustSummary()}>
        <TrustRing index={0} selected={linkId} onPick={(id) => setLinkId(linkId === id ? null : id)} />
      </div>

      {link ? (
        <div className="w9-trust-detail">
          <header>
            <strong>{link.name}</strong>
            <em>由 {link.signedBy}</em>
          </header>
          <p>{link.what}</p>
          <p className="broken"><b>这一环断了</b>{link.ifBroken}</p>
        </div>
      ) : (
        <p className="w9-port-hint">点任意一环，看它由谁背书、断了会看到什么。</p>
      )}

      {!showAnswer ? (
        <div className="w9-reveal-gate">
          <strong>先答：`curl -I https://…` 返回 200，够不够</strong>
          <p>
            说出这条命令<b>还差什么</b>才能证明「HTTPS 真的通了」；再答一句——
            为什么<b>用 IP 访问 443 一定会失败</b>，即使证书本身完全有效。
          </p>
          <button type="button" onClick={() => setRevealed(true)}>展开验收口径与证书事实</button>
        </div>
      ) : (
        <>
          <HttpsAcceptance />

          <div className="w9-cert-facts">
            <div className="w9-config-head">
              <span className="w9-overview-label">这张证书本身</span>
              <GradeChip grade={CERT_FACTS.grade} />
            </div>
            <dl>
              <div><dt>SAN</dt><dd><code>{CERT_FACTS.san}</code></dd></div>
              <div><dt>签发 / 到期</dt><dd>{CERT_FACTS.issuedOn} → {CERT_FACTS.notAfter}（{CERT_FACTS.issuer}，{CERT_FACTS.lifespanDays} 天）</dd></div>
              <div><dt>挑战方式</dt><dd>{CERT_FACTS.challenge}</dd></div>
              <div><dt>域名从哪来</dt><dd>{CERT_FACTS.sslip}</dd></div>
            </dl>
          </div>

          <CertLifecycle />

          {/* 签发方式的选择：这一条直接关系到「我配的」和「跑着的」是不是同一份。 */}
          <div className="w9-certbot">
            <div className="w6-section-head">
              <span>who writes the config</span>
              <h3>选 certonly 而不是 --nginx，为的是配置文件里每一行都是我放进去的</h3>
            </div>
            <div className="w9-certbot-pair">
              <article className="chosen">
                <em>本次选择</em>
                <strong>{CERTBOT_CHOICE.chosen}</strong>
                <p>{CERTBOT_CHOICE.why}</p>
              </article>
              <article className="other">
                <em>没选</em>
                <strong>{CERTBOT_CHOICE.alternative}</strong>
                <p>{CERTBOT_CHOICE.altCost}</p>
              </article>
            </div>
            <p className="w9-certbot-install"><b>安装来源</b>{CERTBOT_CHOICE.install}</p>
          </div>

          <p className="w9-cert-rate" role="note"><b>失败了还能试几次</b>{LE_RATE_LIMIT}</p>
        </>
      )}
    </section>
  );
}

/** 递归渲染一环，把下一环放进自己肚子里——包含关系即签名关系。 */
function TrustRing({
  index,
  selected,
  onPick,
}: {
  index: number;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  const link = TRUST_CHAIN[index];
  const inner = index + 1 < TRUST_CHAIN.length;
  return (
    <div className={`w9-trust-ring r${index}${inner ? "" : " innermost"}`}>
      <button
        type="button"
        className={`w9-trust-label${selected === link.id ? " on" : ""}`}
        aria-pressed={selected === link.id}
        onClick={() => onPick(link.id)}
      >
        <b>{link.name}</b>
        <small>{link.signedBy}</small>
      </button>
      {inner ? (
        <TrustRing index={index + 1} selected={selected} onPick={onPick} />
      ) : (
        <p className="w9-trust-inner-note">
          请求打到 <code>https://{CERT_FACTS.san}</code>
        </p>
      )}
    </div>
  );
}

function trustSummary(): string {
  return (
    "信任链由外向内四环，每一环由外面那一环签名：" +
    TRUST_CHAIN.map((l) => `${l.name}（${l.signedBy}）`).join(" → ") +
    "。最内层是请求真正打到的那个域名，它必须与证书 SAN 一致。"
  );
}

/** 90 天时间轴：为什么这件事必须自动化，是从刻度的疏密看出来的。 */
function CertLifecycle() {
  const { span, marks, proof, whyShort, grade, timerFired } = CERT_LIFECYCLE;
  return (
    <div className="w9-life">
      <div className="w6-section-head">
        <span>ninety days</span>
        <h3>{span}：短到手工续期必然出事，于是所有人都被推着去自动化</h3>
      </div>
      <div className="w9-life-axis" role="img" aria-label={marks.map((m) => `第 ${m.at} 天 ${m.label}`).join("；")}>
        <i className="w9-life-line" aria-hidden="true" />
        {/* 上下错开靠显式序号，不用 nth-child——轴线 <i> 占了第一个孩子，
            用 nth-child 会把奇偶算反，8/13 反而排到 8/14 下面去。 */}
        {marks.map((m, i) => (
          <div
            key={m.label}
            className={`w9-life-mark ${i % 2 === 0 ? "up" : "down"}`}
            style={{ left: `${(m.at / 90) * 100}%` }}
          >
            <i aria-hidden="true" />
            <div className="w9-life-text">
              <b>{m.label}</b>
              <small>{m.note}</small>
            </div>
          </div>
        ))}
      </div>
      <p className="w9-life-why">{whyShort}</p>
      <p className="w9-life-proof">
        <GradeChip grade={grade} />
        <span>{proof}</span>
      </p>

      {/*
        8/14 冷启动复测拿到 LAST 那一格。这是全板第二次档位升级——
        单独框出来，因为升级掉的正是一个很容易被当成已证实的推断。
      */}
      <div className="w9-life-upgrade">
        <div className="w9-life-upgrade-head">
          <span>8/14：从「应该会跑」升级成「跑过了」</span>
          <code>{timerFired.reading}</code>
        </div>
        <p>{timerFired.upgrade}</p>
        <p className="w9-life-upgrade-limit"><b>但它仍然不证明</b>{timerFired.stillUnproven}</p>
      </div>
    </div>
  );
}

/* ==========================================================================
   ⑧ 改一台在跑的机器。
   全板唯一一块讲**过程纪律**而不是系统结构的。空间编码是「改动生效的深度」：
   两级回滚落在两个不同深度上，而反直觉的结论——最坏那一级反而最安全——
   正是从深度看出来的，不是读出来的。
   ========================================================================== */

function ChangingLiveBox({ review }: { review: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const showAnswer = !review || revealed;

  useEffect(() => {
    setRevealed(false);
  }, [review]);

  return (
    <section className="w9-live" aria-label="改一台在跑的机器">
      <div className="w6-section-head">
        <span>changing a box that is serving traffic</span>
        <h3>动手之前先想好怎么退回去，以及什么时候放弃</h3>
      </div>

      {/* 三步纪律：位置就是时间顺序，中间那一步是把风险挡在生效之前的那一道。 */}
      <ol className="w9-discipline">
        {CHANGE_DISCIPLINE.map((d, i) => (
          <li key={d.step} className={i === 1 ? "guard" : ""}>
            <b>{d.step}</b>
            <span>{d.what}</span>
          </li>
        ))}
      </ol>

      {!showAnswer ? (
        <div className="w9-reveal-gate">
          <strong>先答：改 Nginx 配置改砸了，怎么退回去</strong>
          <p>
            分两种情况说：<b>`nginx -t` 没过</b>和<b>reload 成功但验收失败</b>，
            退路一样吗？哪一种其实更安全？再答一句——
            签发证书一直失败，你<b>凭什么决定今天不搞了</b>。
          </p>
          <button type="button" onClick={() => setRevealed(true)}>展开两级回滚与止损线</button>
        </div>
      ) : (
        <>
          {/* 位置 = 改动生效的深度。左边那级还没加载，右边那级已经对外生效。 */}
          <div className="w9-levels">
            {ROLLBACK_LEVELS.map((lv) => (
              <article key={lv.id} className={`w9-level ${lv.depth}`}>
                <header>
                  <em>{lv.depth === "not-loaded" ? "配置从未加载" : "已经对外生效"}</em>
                  <strong>{lv.trigger}</strong>
                </header>
                <p className="w9-level-blast"><b>此刻公网</b>{lv.blastRadius}</p>
                <ol>
                  {lv.steps.map((s) => <li key={s}><code>{s}</code></li>)}
                </ol>
                {lv.note && <p className="w9-level-note">{lv.note}</p>}
              </article>
            ))}
          </div>

          <StopLoss />
          <StaleBackup />
        </>
      )}
    </section>
  );
}

/** 止损线：动手之前先写死什么时候放弃。 */
function StopLoss() {
  return (
    <div className="w9-stop">
      <div className="w6-section-head">
        <span>when to quit</span>
        <h3>止损线写在动手之前，不是撞墙的时候临时定</h3>
      </div>
      <p className="w9-stop-rule">
        <GradeChip grade={STOP_LOSS.grade} />
        <strong>{STOP_LOSS.rule}</strong>
      </p>
      <p className="w9-stop-grade" role="note">{STOP_LOSS.gradeNote}</p>

      <div className="w9-stop-why">
        <p><b>为什么是 3 次</b>{STOP_LOSS.whyThree}</p>
        <p><b>为什么隔 5 分钟</b>{STOP_LOSS.whyFive}</p>
        <p><b>回退算不算失败</b>{STOP_LOSS.whatCounts}</p>
      </div>

      <div className="w9-stop-list">
        <span className="w9-overview-label">触发后的六步回退清单</span>
        <ol>
          {STOP_LOSS.checklist.map((c) => <li key={c}>{c}</li>)}
        </ol>
      </div>
      <p className="w9-stop-key"><b>最容易被顺手删掉的一步</b>{STOP_LOSS.keepAccountKey}</p>
      <p className="w9-stop-order"><b>顺序也是设计</b>{STOP_LOSS.orderNote}</p>
    </div>
  );
}

/* ==========================================================================
   ⑪ 发布变更单。
   与 ⑧「改一台在跑的机器」是同一次发布的两个相位：那块讲失败之后怎么退回去，
   这块讲动手之前把什么写死。

   主图是**六项验证 × 四层覆盖的矩阵**。列的分布本身就是结论：
   新入口被验了三次（构建期 → 本地预演 → 线上，一次比一次贵），
   公网兜底只验了一次；而第 ④ 项一次落在两列上——它一个请求验两层。
   这些从格子看得出来，写成六段文字就看不出来了。
   ========================================================================== */

function ReleaseTicket({ review }: { review: boolean }) {
  const [checkNo, setCheckNo] = useState(VERIFY_MATRIX[3].no);
  const [revealed, setRevealed] = useState(false);
  const check = VERIFY_MATRIX.find((c) => c.no === checkNo) ?? VERIFY_MATRIX[0];
  const showAnswer = !review || revealed;

  useEffect(() => {
    setRevealed(false);
  }, [review]);

  return (
    <section className="w9-release" aria-label="发布变更单">
      <div className="w6-section-head">
        <span>freeze it before you touch it</span>
        <h3>{RELEASE_TICKET.title}：动手之前把四件事写死</h3>
      </div>

      {/* 四要素：左边默认思维，右边写下来之后的形态。差别全在「可不可证伪」。 */}
      <div className="w9-ticket-els">
        {CHANGE_TICKET.map((el) => (
          <article key={el.id} className="w9-ticket-el">
            <strong>{el.name}</strong>
            <p className="w9-ticket-naive"><b>默认</b>{el.naive}</p>
            <p className="w9-ticket-disc"><b>写死</b>{el.disciplined}</p>
            <p className="w9-ticket-payoff">{el.payoff}</p>
          </article>
        ))}
      </div>

      {/* 主图。行 = 六项验证（按深度排），列 = 四层；格子 = 这一项验到了那一层。 */}
      <div className="w9-verify">
        <div className="w6-section-head">
          <span>six checks, four layers</span>
          <h3>每一项验的是哪一层：列的分布就是这次发布的风险画像</h3>
        </div>

        <div className="w9-verify-grid" role="table" aria-label={verifySummary()}>
          <div className="w9-verify-head" role="row">
            <span role="columnheader">验证项</span>
            {VERIFY_LAYERS.map((l) => (
              <span key={l.id} role="columnheader">
                {l.label}
                <small>{l.why}</small>
              </span>
            ))}
          </div>
          {VERIFY_MATRIX.map((c) => (
            <button
              key={c.no}
              type="button"
              role="row"
              className={`w9-verify-row${c.no === checkNo ? " on" : ""}`}
              onClick={() => setCheckNo(c.no)}
              aria-pressed={c.no === checkNo}
            >
              <span className="w9-verify-name" role="rowheader">
                <b>{c.no}</b>
                {c.what}
                <small>{c.stage}</small>
              </span>
              {VERIFY_LAYERS.map((l) => {
                const hit = c.layers.includes(l.id);
                return (
                  <span
                    key={l.id}
                    role="cell"
                    data-col={l.label}
                    className={`w9-verify-cell ${hit ? "hit" : "miss"}`}
                  >
                    {hit ? "验到" : ""}
                  </span>
                );
              })}
            </button>
          ))}
        </div>

        {/* 列计数条形图：分布 3 / 2 / 2 / 1 一眼可读。
            原来的「这一层被验了几次」四个数字行被它替代——同一信息不再出现两遍。 */}
        <VerifyCoverageChart />

        {/* 选中项详情：期望必须排在实测之前，而且期望要有来源。 */}
        <div className="w9-verify-detail">
          <div className="w9-verify-detail-head">
            <b>{check.no}</b>
            <strong>{check.what}</strong>
            <em>{check.stage}</em>
          </div>
          <p className="w9-verify-how"><b>怎么跑</b>{check.how}</p>
          <dl className="w9-verify-expect">
            <div><dt>期望</dt><dd className="w9-verify-exp">{check.expect}</dd></div>
            <div><dt>期望来源</dt><dd>{check.expectFrom}</dd></div>
            <div><dt>实测</dt><dd className="w9-verify-got">{check.got}</dd></div>
          </dl>
          {check.note ? <p className="w9-verify-note" role="note">{check.note}</p> : null}
        </div>
      </div>

      {!showAnswer ? (
        <div className="w9-reveal-gate">
          <strong>先答：第 ④ 项（443 的报表接口，不带 token）的期望值该写 200 还是 401</strong>
          <p>
            说出理由，再说一句——第 ⑤ 项为什么<b>必须</b>在服务器内部跑，
            在本地打公网为什么验不出它。
          </p>
          <button type="button" onClick={() => setRevealed(true)}>展开变更单本体与产物二份制</button>
        </div>
      ) : (
        <>
          {/* 变更单本体：这次到底动了哪四样，以及失败时退到哪。 */}
          <div className="w9-ticket-body">
            <div className="w6-section-head">
              <span>the ticket itself</span>
              <h3>这次冻结下来的那张单子</h3>
            </div>
            <div className="w9-ticket-class">
              <p><b>变更类型</b>{RELEASE_TICKET.classify}</p>
              <p><b>服务边界</b>{RELEASE_TICKET.serviceBoundary}</p>
              <p><b>暴露边界</b>{RELEASE_TICKET.exposureBoundary}</p>
            </div>
            <ol className="w9-ticket-changes">
              {RELEASE_TICKET.changes.map((c) => (
                <li key={c.file}>
                  <code>{c.file}</code>
                  <span>{c.what}</span>
                  <em>{c.owner}</em>
                </li>
              ))}
            </ol>
            <p className="w9-ticket-rollback"><b>失败就退到这里</b>{RELEASE_TICKET.rollback}</p>
            <p className="w9-ticket-stop"><b>止步</b>{RELEASE_TICKET.stopAt}</p>
            <p className="w9-ticket-boundary"><b>发布边界</b>{RELEASE_TICKET.boundary}</p>
          </div>

          <ArtifactSplit />
          <ExecutionSnags />

          <p className="w9-ticket-take" role="note">{TICKET_TAKEAWAY}</p>
        </>
      )}
    </section>
  );
}

function verifySummary(): string {
  const cols = VERIFY_LAYERS.map(
    (l) => `${l.label}被 ${VERIFY_MATRIX.filter((c) => c.layers.includes(l.id)).length} 项验到`,
  ).join("、");
  const multi = VERIFY_MATRIX.filter((c) => c.layers.length > 1).map((c) => c.no).join("、");
  return `六项验证对四层的覆盖：${cols}。其中 ${multi} 各自一次落在两层上。`;
}

/** ⑪ 列计数升级：分布 3 / 2 / 2 / 1 是这次发布的风险画像，用真条形图替代文字。 */
function VerifyCoverageChart() {
  const data = VERIFY_LAYERS.map((l) => {
    const n = VERIFY_MATRIX.filter((c) => c.layers.includes(l.id)).length;
    const checks = VERIFY_MATRIX.filter((c) => c.layers.includes(l.id)).map((c) => c.no).join("");
    return {
      label: l.label,
      value: n,
      detail: (
        <>
          <b>{l.label}</b> 被 {n} 项验到（{checks}）
          <br />
          <span>{l.why}</span>
        </>
      ),
    };
  });
  return (
    <div className="w9-chart-block">
      <div className="w6-section-head">
        <span>coverage distribution</span>
        <h3>哪一层被反复验，哪一层只有一次机会</h3>
      </div>
      <HBarChart data={data} valueFormat={(v) => `${v} 次`} />
    </div>
  );
}

/**
 * 产物二份制。它不是事先想到的——是写变更单逐项列改动时才发现的，
 * 所以刻意排在变更单本体后面：先看那张单子，再看它当场拦下了什么。
 */
function ArtifactSplit() {
  return (
    <div className="w9-split">
      <div className="w6-section-head">
        <span>one codebase, two artifacts</span>
        <h3>写单子时当场拦下的一件事：两份产物不能共用一个目录</h3>
      </div>
      <p className="w9-split-found"><b>发现于</b>{ARTIFACT_SPLIT.found}</p>
      <p className="w9-split-break"><b>照原方案会怎样</b>{ARTIFACT_SPLIT.wouldBreak}</p>
      <div className="w9-split-targets">
        {ARTIFACT_SPLIT.targets.map((t) => (
          <article key={t.face} className="w9-split-target">
            <strong>{t.face}</strong>
            <p><span>serve 目录</span><code>{t.dir}</code></p>
            <p><span>base</span><code>{t.base}</code></p>
          </article>
        ))}
      </div>
      <p className="w9-split-rule"><b>规则</b>{ARTIFACT_SPLIT.rule}</p>
      <p className="w9-split-gain">{ARTIFACT_SPLIT.rollbackGain}</p>
    </div>
  );
}

/** 三个执行期踩点。都是「必须真实遇过一次才知道」的那类，所以症状放在最前面。 */
function ExecutionSnags() {
  return (
    <div className="w9-snags">
      <div className="w6-section-head">
        <span>only found by doing</span>
        <h3>执行期踩到的三处：写在单子上也想不出来的那种</h3>
      </div>
      <div className="w9-snag-list">
        {EXECUTION_SNAGS.map((s) => (
          <article key={s.id} className="w9-snag">
            <strong>{s.symptom}</strong>
            <p className="w9-snag-cause"><b>根因</b>{s.cause}</p>
            <p className="w9-snag-fix"><b>正确形态</b>{s.fix}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   ⑬ 讲得出来才算会。
   与 ⑨ 的边界：⑨ 收执行期踩出来的，这块收口述时暴露的。

   空间编码：八层轴，每处修正钉在它所属的那一层上。
   一眼结论是**分布密度**——前三层零错，六处压在中间那几层，
   而那几层恰恰是自己一行行配出来的。这从轴上看得出来，
   写成八段文字就只剩八段文字。
   ========================================================================== */

function SpokenCheck({ review }: { review: boolean }) {
  const [layerId, setLayerId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const showAnswer = !review || revealed;

  useEffect(() => {
    setRevealed(false);
    setLayerId(null);
  }, [review]);

  const fixesOf = (id: string) => SPOKEN_FIXES.filter((f) => f.layer === id);
  const max = Math.max(...CHAIN_LAYERS.map((l) => fixesOf(l.id).length));
  const picked = layerId ? CHAIN_LAYERS.find((l) => l.id === layerId) ?? null : null;
  const pickedFixes = picked ? fixesOf(picked.id) : [];
  const clean = CHAIN_LAYERS.filter((l) => fixesOf(l.id).length === 0);

  return (
    <section className="w9-spoken" aria-label="讲得出来才算会">
      <div className="w6-section-head">
        <span>you only know it if you can say it</span>
        <h3>口述三关暴露的 {SPOKEN_FIXES.length} 处：错都落在哪一层</h3>
      </div>
      <p className="w9-spoken-lead">
        这 {SPOKEN_FIXES.length} 处不是做的时候踩到的，是<b>讲的时候才发现自己没真懂</b>——
        与「契约销账」板上那批执行期修正性质不同，所以分开放。
        每一处钉在它所属的那一层上，柱子的高度就是那一层错了几次。
      </p>

      {/*
        主图：八层轴 + 每层的错误柱。密度就是结论。
        轴线与方向标不是装饰：没有它们，八根柱子读起来只是八个并列的类目，
        而这八层的顺序本身有意义——它是一个请求依次穿过的顺序。
      */}
      <div className="w9-spoken-flow" aria-hidden="true">
        <span>请求从这边进来</span>
        <i />
        <span>一路走到数据</span>
      </div>
      <div className="w9-spoken-axis" role="img" aria-label={spokenSummary()}>
        {CHAIN_LAYERS.map((layer) => {
          const n = fixesOf(layer.id).length;
          const on = layerId === layer.id;
          return (
            <button
              key={layer.id}
              type="button"
              className={`w9-spoken-layer${n === 0 ? " clean" : ""}${on ? " on" : ""}`}
              onClick={() => setLayerId(on ? null : layer.id)}
              aria-pressed={on}
            >
              {/* 柱子在上、层名在下：轴是横的，密度靠高度读。 */}
              <span className="w9-spoken-bar-wrap" aria-hidden="true">
                <span
                  className="w9-spoken-bar"
                  style={{ height: n === 0 ? "3px" : `${(n / max) * 100}%` }}
                />
              </span>
              <em className="w9-spoken-n">{n === 0 ? "零错" : `${n} 处`}</em>
              <strong>{layer.name}</strong>
            </button>
          );
        })}
      </div>

      {picked ? (
        <div className="w9-spoken-detail">
          <div className="w9-spoken-detail-head">
            <strong>{picked.name}</strong>
            <span>{picked.what}</span>
          </div>
          <p className="w9-spoken-fail"><b>这一层坏了长什么样</b>{picked.failure}</p>
          {pickedFixes.length === 0 ? (
            <p className="w9-spoken-none" role="note">
              这一层口述时没出错。它是照着机制学来的——不是自己配出来的那种「熟」。
            </p>
          ) : (
            <ol className="w9-spoken-fixes">
              {pickedFixes.map((f) => (
                <li key={f.id}>
                  <div className="w9-spoken-fix-head">
                    <em className={`w9-spoken-kind ${f.kind}`}>{SPOKEN_KIND[f.kind].label}</em>
                    <span className="w9-spoken-from">{f.from} 关暴露</span>
                  </div>
                  <p className="bad"><b>❌ 我当时说</b>{f.initial}</p>
                  {showAnswer ? (
                    <>
                      <p className="why"><b>⚡ 错在哪一步</b>{f.wrong}</p>
                      <p className="ok"><b>✅ 修正</b>{f.correct}</p>
                    </>
                  ) : (
                    <p className="w9-spoken-hold" role="note">先自己说一遍错在哪一步，再展开。</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <p className="w9-spoken-hint" role="note">
          点任一层看它错在哪。{clean.length} 层是零错的：{clean.map((l) => l.name).join(" / ")}。
        </p>
      )}

      {!showAnswer ? (
        <div className="w9-reveal-gate">
          <strong>先答：这 {SPOKEN_FIXES.length} 处会集中在哪几层</strong>
          <p>
            不用背具体哪一条。说出你的预测：<b>哪几层最可能零错</b>，为什么；
            再说一句——按「哪一关暴露的」分类，哪一类错最难靠自己发现。
          </p>
          <button type="button" onClick={() => setRevealed(true)}>展开修正原文与两条结论</button>
        </div>
      ) : (
        <>
          <div className="w9-spoken-takeaways">
            <p className="w9-bn"><b>密度说了什么</b>{SPOKEN_TAKEAWAYS.density}</p>
            <p className="w9-bn"><b>按暴露渠道分</b>{SPOKEN_TAKEAWAYS.stale}</p>
          </div>

          {/* 错的类型分布。stale 那一类单独着色——它是最难自查的。 */}
          <div className="w9-spoken-kinds">
            <div className="w6-section-head">
              <span>five kinds of being wrong</span>
              <h3>不是所有「说错」都是同一回事</h3>
            </div>
            <div className="w9-spoken-kind-list">
              {(Object.keys(SPOKEN_KIND) as Array<SpokenFix["kind"]>).map((kind) => {
                const n = SPOKEN_FIXES.filter((f) => f.kind === kind).length;
                return (
                  <article key={kind} className={`w9-spoken-kind-card ${kind}`}>
                    <strong>{SPOKEN_KIND[kind].label}</strong>
                    <em>{n} 处</em>
                    <p>{SPOKEN_KIND[kind].meaning}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function spokenSummary(): string {
  const parts = CHAIN_LAYERS.map((l) => {
    const n = SPOKEN_FIXES.filter((f) => f.layer === l.id).length;
    return `${l.name} ${n === 0 ? "零错" : `${n} 处`}`;
  }).join("、");
  return `请求要穿过的八层，各自口述时错了几处：${parts}。`;
}

/* ==========================================================================
   ⑫ 以谁的身份碰谁的东西。
   空间编码是**身份 × 对象的矩阵**：12 条坑各自挂在一个格子上，
   于是「哪一格最容易踩」是数出来的，不是一句总结。

   最值钱的是第 9 与第 10 条落在同一格——那正好解释了为什么
   绕过第一个报错只会把你送到第二个：它们是同一个根因的两种表现。
   ========================================================================== */

const VERDICT_LABEL: Record<AccessVerdict, string> = {
  full: "全权",
  partial: "有条件",
  denied: "被拒",
  discouraged: "能但不该",
  na: "不涉及",
};

function IdentityMatrix({ review }: { review: boolean }) {
  const [picked, setPicked] = useState<{ identity: IdentityId; object: string } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const showAnswer = !review || revealed;

  useEffect(() => {
    setRevealed(false);
    setPicked(null);
  }, [review]);

  const cellOf = (identity: IdentityId, object: string) =>
    ACCESS_MATRIX.find((c) => c.identity === identity && c.object === object);
  const snagsOf = (identity: IdentityId, object: string | null) =>
    PERM_SNAGS.filter((s) => s.identity === identity && s.object === object);

  const active = picked ? cellOf(picked.identity, picked.object) : null;
  const activeSnags = picked ? snagsOf(picked.identity, picked.object) : [];
  // 换身份本身的坑不落在任何格子上，单独一节，否则它们会被硬塞进某一格。
  const looseSnags = PERM_SNAGS.filter((s) => s.object === null);
  // 一眼结论：坑最密的那一格。
  const densest = ACCESS_MATRIX
    .map((c) => ({ cell: c, count: snagsOf(c.identity, c.object).length }))
    .sort((a, b) => b.count - a.count)[0];

  return (
    <section className="w9-idm" aria-label="身份与权限矩阵">
      <div className="w6-section-head">
        <span>who am i touching what as</span>
        <h3>这台机器上「你是谁」决定「你能碰什么」</h3>
      </div>

      {/* 四个身份。www-data 那张刻意排在中间——它是唯一一个你不会登录成它的身份。 */}
      <div className="w9-idm-who">
        {IDENTITIES.map((id) => (
          <article key={id.id} className={`w9-idm-id ${id.id}`}>
            <strong>{id.name}</strong>
            <p>{id.role}</p>
            <p className="w9-idm-how"><b>怎么成为它</b>{id.howToBe}</p>
          </article>
        ))}
      </div>

      {/* 主图：行 = 对象，列 = 身份。格子右上角的数字是这一格踩过几次。 */}
      <div className="w9-idm-grid" role="table" aria-label={identitySummary()}>
        <div className="w9-idm-head" role="row">
          <span role="columnheader">对象 · 属主 · 权限</span>
          {IDENTITIES.map((id) => (
            <span key={id.id} role="columnheader">{id.name}</span>
          ))}
        </div>
        {OWNED_OBJECTS.map((obj) => (
          <div key={obj.id} className="w9-idm-row" role="row">
            <span className="w9-idm-obj" role="rowheader">
              <code>{obj.path}</code>
              <small>{obj.owner} · {obj.mode}</small>
            </span>
            {IDENTITIES.map((id) => {
              const cell = cellOf(id.id, obj.id);
              const snags = snagsOf(id.id, obj.id);
              const on = picked?.identity === id.id && picked?.object === obj.id;
              return (
                <button
                  key={id.id}
                  type="button"
                  role="cell"
                  data-col={id.name}
                  className={`w9-idm-cell ${cell?.verdict ?? "na"}${on ? " on" : ""}`}
                  onClick={() => setPicked(on ? null : { identity: id.id, object: obj.id })}
                  aria-pressed={on}
                >
                  <span className="w9-idm-label">{cell?.label}</span>
                  {snags.length > 0 && (
                    <em className="w9-idm-count" aria-label={`这一格踩过 ${snags.length} 次`}>
                      踩过 {snags.length}
                    </em>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {active ? (
        <div className="w9-idm-detail">
          <div className="w9-idm-detail-head">
            <strong>{IDENTITIES.find((i) => i.id === active.identity)?.name}</strong>
            <span>碰</span>
            <code>{OWNED_OBJECTS.find((o) => o.id === active.object)?.path}</code>
            <em className={active.verdict}>{VERDICT_LABEL[active.verdict]}</em>
          </div>
          <p className="w9-idm-detail-text">{active.detail}</p>
          <p className="w9-idm-why"><b>这个权限位为什么是这样</b>
            {OWNED_OBJECTS.find((o) => o.id === active.object)?.why}
          </p>
          {activeSnags.length > 0 && (
            <ol className="w9-idm-snags">
              {activeSnags.map((s) => (
                <li key={s.no}>
                  <strong>坑 {s.no}：{s.symptom}</strong>
                  <p><b>根因</b>{s.cause}</p>
                  <p className="fix"><b>正确做法</b>{s.fix}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <p className="w9-idm-hint" role="note">
          点任一格看它的结论与踩过的坑。带「踩过」标记的格子共 {ACCESS_MATRIX.filter((c) => snagsOf(c.identity, c.object).length > 0).length} 个。
        </p>
      )}

      {!showAnswer ? (
        <div className="w9-reveal-gate">
          <strong>先答：ubuntu 登录后直接 git pull 会报什么</strong>
          <p>
            再答一句更要紧的——按提示加了 <b>safe.directory</b> 之后，为什么还是不行？
            这两个报错是两个问题，还是同一个？
          </p>
          <button type="button" onClick={() => setRevealed(true)}>展开那一格与两条规则</button>
        </div>
      ) : (
        <>
          {/* 一眼结论：坑最密的一格，以及它为什么是这一格。 */}
          <div className="w9-idm-densest">
            <div className="w6-section-head">
              <span>the densest cell</span>
              <h3>
                12 条坑里有 {densest.count} 条落在同一格：
                {IDENTITIES.find((i) => i.id === densest.cell.identity)?.name} 碰
                {OWNED_OBJECTS.find((o) => o.id === densest.cell.object)?.path}
              </h3>
            </div>
            <p>
              这一格不是最难的，是<b>最容易忘的</b>：你 ssh 上去就是 ubuntu，
              手顺着就 git pull 了——而仓库属主是 nodeapp。
              第 9 条（dubious ownership）与第 10 条（FETCH_HEAD 写不了）之所以落在同一格，
              是因为它们本来就是同一个根因的两种表现：
              <b>绕过第一个报错，只会把你送到第二个</b>。
            </p>
          </div>

          {/* 坑按身份分布的真条形图：谁踩得多是数出来的，不写死。 */}
          <SnagChart />

          {/* 换身份这个动作本身的坑，不属于任何一格。 */}
          <div className="w9-idm-loose">
            <div className="w6-section-head">
              <span>switching, not touching</span>
              <h3>另有 {looseSnags.length} 条不落在格子上：出在「换身份」这个动作本身</h3>
            </div>
            <div className="w9-idm-loose-list">
              {looseSnags.map((s) => (
                <article key={s.no} className="w9-idm-loose-item">
                  <strong>坑 {s.no}：{s.symptom}</strong>
                  <p><b>根因</b>{s.cause}</p>
                  <p className="fix"><b>正确做法</b>{s.fix}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="w9-idm-rule">
            <p className="w9-idm-golden"><b>黄金规则</b>{PERM_RULE.golden}</p>
            <p className="w9-idm-ask"><b>报错时先问这一句</b>{PERM_RULE.ask}</p>
          </div>

          <div className="w9-idm-recipes">
            <span className="w9-overview-label">直接可抄的正确形态</span>
            <ul>
              {PERM_RECIPES.map((r) => (
                <li key={r.what}>
                  <span>{r.what}</span>
                  <code>{r.cmd}</code>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

function identitySummary(): string {
  const rows = OWNED_OBJECTS.map((obj) => {
    const cells = IDENTITIES.map((id) => {
      const c = ACCESS_MATRIX.find((x) => x.identity === id.id && x.object === obj.id);
      return `${id.name} ${c?.label ?? "不涉及"}`;
    }).join("、");
    return `${obj.path}（${obj.owner} ${obj.mode}）：${cells}`;
  }).join("；");
  return `身份与对象的权限矩阵。${rows}。`;
}

/**
 * ⑫ 坑按身份的分布。只统计落进格子的坑（object !== null）——loose 条是
 * 「换身份」这个动作本身的坑，note 里已声明不按身份归。数字从数据算，不写死。
 */
function SnagChart() {
  const gridSnags = PERM_SNAGS.filter((s) => s.object !== null);
  const data = IDENTITIES.map((id) => {
    const snags = gridSnags.filter((s) => s.identity === id.id);
    return {
      label: id.name,
      value: snags.length,
      detail: (
        <>
          <b>{id.name}</b> 踩过 {snags.length} 条
          <br />
          <span>{snags.map((s) => `坑 ${s.no}`).join("、") || "没踩过"}</span>
        </>
      ),
    };
  });
  const top = data.reduce((best, d) => (d.value > best.value ? d : best), data[0]);
  return (
    <div className="w9-chart-block">
      <div className="w6-section-head">
        <span>who stepped on them</span>
        <h3>{gridSnags.length} 条落格子的坑按身份数：{top.label} 最多，{top.value} 条</h3>
      </div>
      <HBarChart data={data} valueFormat={(v) => `${v} 条`} />
      <p className="w9-chart-note" role="note">
        12 条坑里有 {PERM_SNAGS.length - gridSnags.length} 条出在「换身份」这个动作本身
        （不落格子的 loose），图里只数落格子的 {gridSnags.length} 条。
      </p>
    </div>
  );
}

/**
 * 备份自己过期了——这套纪律唯一一次真的漏过。8/14 已闭合，
 * 但破口的原样描述保留：删掉只留「已修复」等于把教训也一起修没了。
 */
function StaleBackup() {
  return (
    <div className="w9-stale closed">
      <div className="w9-debt-head">
        <span>这套纪律唯一漏过的一处，8/14 已闭合</span>
        <GradeChip grade={STALE_BACKUP.grade} />
      </div>
      <p className="w9-debt-what">{STALE_BACKUP.what}</p>
      <dl>
        <div><dt>当时的风险</dt><dd>{STALE_BACKUP.risk}</dd></div>
        <div><dt>怎么补</dt><dd>{STALE_BACKUP.fix}</dd></div>
        <div><dt>{STALE_BACKUP.closedOn} 怎么闭的</dt><dd>{STALE_BACKUP.closedHow}</dd></div>
        <div><dt>闭合之后还剩什么</dt><dd>{STALE_BACKUP.remaining}</dd></div>
      </dl>
      <p className="w9-stale-lesson"><b>可迁移的那一条</b>{STALE_BACKUP.lesson}</p>
    </div>
  );
}

/* ==========================================================================
   ③ systemd 失败模式。空间编码是「同一个 60 秒窗口，两种重启密度」：
   快失败 5 次尝试全落在窗口内 → 撞上 StartLimitBurst；
   慢失败一次就吃掉半个窗口 → 计数永远堆不满。
   为什么一个被停住、另一个不会，是从疏密看出来的，不是从两段文字读出来的。
   ========================================================================== */

const MODE_TAB_IDS = FAILURE_MODES.map((m) => `w9-sys-tab-${m.id}`);

function SystemdModes({ review }: { review: boolean }) {
  const [modeId, setModeId] = useState(FAILURE_MODES[0].id);
  const [revealed, setRevealed] = useState(false);
  const mode = FAILURE_MODES.find((m) => m.id === modeId) ?? FAILURE_MODES[0];
  const player = useFramePlayer(mode.frames.length, {
    autoPlay: false,
    intervalAt: (i) => dwellByText(mode.frames[i]?.narration ?? ""),
  });

  function selectMode(id: string) {
    setModeId(id);
    player.replay();
  }

  useEffect(() => {
    setRevealed(false);
  }, [review]);

  const frame = mode.frames[Math.min(player.index, mode.frames.length - 1)];
  const atEnd = player.index >= mode.frames.length - 1;
  const shown = mode.attempts.slice(0, frame.upto);
  // 窗口内的启动次数：refused 那次是被拒绝的，不计入计数器。
  const inWindow = shown.filter((a) => a.at <= SYSTEMD_LIMITS.windowSec && a.outcome !== "refused").length;
  const showAnswer = !review || revealed;

  return (
    <section className="w9-sys" aria-label="systemd 失败模式">
      <div className="w6-section-head">
        <span>same limiter, two densities</span>
        <h3>同一个 60 秒窗口，两种重启密度</h3>
      </div>

      <div
        className="w9-path-switch w9-sys-switch"
        role="tablist"
        aria-label="失败模式"
        onKeyDown={tabKeyDown(
          MODE_TAB_IDS,
          FAILURE_MODES.findIndex((m) => m.id === modeId),
          (i) => selectMode(FAILURE_MODES[i].id),
        )}
      >
        {FAILURE_MODES.map((item) => {
          const selected = item.id === modeId;
          return (
            <button
              key={item.id}
              type="button"
              id={`w9-sys-tab-${item.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls="w9-sys-panel"
              tabIndex={selected ? 0 : -1}
              className={selected ? "on" : ""}
              onClick={() => selectMode(item.id)}
            >
              <strong><Term id={item.id === "fast" ? "fast-fail" : "slow-fail"} /></strong>
              <small>{EVIDENCE_GRADE[item.grade].label}</small>
            </button>
          );
        })}
      </div>

      <div id="w9-sys-panel" role="tabpanel" aria-labelledby={`w9-sys-tab-${mode.id}`}>
        <p className="w9-condition">
          <b>问题</b>
          {mode.question}
        </p>

        <Timeline mode={mode} shown={shown} />

        <div className="w9-sys-counter">
          <span><Term id="start-limit" /></span>
          <strong className={inWindow >= SYSTEMD_LIMITS.burst ? "hit" : ""}>
            {inWindow} / {SYSTEMD_LIMITS.burst}
          </strong>
          <small>
            {inWindow >= SYSTEMD_LIMITS.burst
              ? "已达 StartLimitBurst，systemd 拒绝再拉起"
              : `还差 ${SYSTEMD_LIMITS.burst - inWindow} 次才会触发限速`}
          </small>
        </div>

        <FrameTransport player={player} length={mode.frames.length} label="时间推进" />
        <FrameNarration
          step={player.index + 1}
          text={frame.narration}
          tone={atEnd ? (mode.verdictTone === "failure" ? "blocked" : undefined) : undefined}
        />

        <div className={`w9-status-reveal${atEnd ? " on" : ""}`} role="status">
          {atEnd ? (
            <>
              <span>结局</span>
              <strong className={`verdict${mode.verdictTone === "failure" ? " failure" : ""}`}>{mode.verdict}</strong>
            </>
          ) : (
            <span className="w9-status-pending">走完时间轴后揭示结局</span>
          )}
        </div>

        <p className={`w9-grade-note ${mode.grade}`}>
          <GradeChip grade={mode.grade} />
          <span>{mode.gradeNote}</span>
        </p>

        {mode.id === "fast" && <JournalEvidence />}

        {!showAnswer ? (
          <div className="w9-reveal-gate">
            <strong>先答：两种失败为什么结局不同</strong>
            <p>
              两边用的是同一套 <code>RestartSec=10s</code> 与 <code>StartLimitBurst=5 / 60s</code>。
              说出为什么配置写错会被停住、数据库挂了却会一直重试——判据是哪一个量。
            </p>
            <button type="button" onClick={() => setRevealed(true)}>展开密度对照与结论</button>
          </div>
        ) : (
          <>
            <DensityCompare current={mode.id} onSelect={selectMode} />
            <p className="w9-sys-rule" role="note">
              <b>要留下的那一条</b>
              {LIMIT_RULE}
            </p>
          </>
        )}

        <BlindSpot />
      </div>
    </section>
  );
}

/** 时间轴：60 秒窗口是一条带子，尝试是落在带子上的点。 */
function Timeline({ mode, shown }: { mode: FailureMode; shown: FailureMode["attempts"] }) {
  const pct = (sec: number) => `${(sec / mode.spanSec) * 100}%`;
  return (
    <div className="w9-timeline-scroll">
      <div
        className="w9-timeline"
        role="img"
        aria-label={`${mode.label}：${mode.spanSec} 秒内发生 ${shown.length} 次启动尝试，其中落在前 ${SYSTEMD_LIMITS.windowSec} 秒窗口内的有 ${shown.filter((a) => a.at <= SYSTEMD_LIMITS.windowSec && a.outcome !== "refused").length} 次。`}
      >
        {/* 限速窗口本身是一个带子——「塞得下几次」是看出来的 */}
        <div className="w9-window" style={{ width: pct(SYSTEMD_LIMITS.windowSec) }}>
          <span>StartLimitIntervalSec = {SYSTEMD_LIMITS.windowSec}s 窗口</span>
        </div>
        <div className="w9-axis" />
        {mode.attempts.map((a, i) => {
          const visible = i < shown.length;
          return (
            <div
              key={`${a.at}-${a.label}`}
              className={`w9-attempt ${a.outcome}${visible ? " on" : ""}`}
              style={{ left: pct(a.at) }}
            >
              <i aria-hidden="true" />
              <span className="w9-attempt-time">{a.at}s</span>
              {visible && (
                <span className="w9-attempt-label">
                  {a.label}
                  {a.pid && <code>pid {a.pid}</code>}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 一眼结论图：两条轴叠起来，疏密差别直接可见。 */
function DensityCompare({ current, onSelect }: { current: string; onSelect: (id: string) => void }) {
  const span = Math.max(...FAILURE_MODES.map((m) => m.spanSec));
  return (
    <div className="w9-density">
      <span className="w9-overview-label">同一个窗口下的两种密度</span>
      {FAILURE_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`w9-density-row${m.id === current ? " on" : ""}`}
          onClick={() => onSelect(m.id)}
          aria-pressed={m.id === current}
        >
          <span className="w9-density-name">{m.label}</span>
          <span className="w9-density-track" aria-hidden="true">
            <i className="w9-density-window" style={{ width: `${(SYSTEMD_LIMITS.windowSec / span) * 100}%` }} />
            {m.attempts.map((a) => (
              <i
                key={a.at}
                className={`w9-density-dot ${a.outcome}`}
                style={{ left: `${(a.at / span) * 100}%` }}
              />
            ))}
          </span>
          <em className={m.verdictTone}>
            {m.attempts.filter((a) => a.at <= SYSTEMD_LIMITS.windowSec && a.outcome !== "refused").length} / {SYSTEMD_LIMITS.burst}
          </em>
        </button>
      ))}
      <p className="w9-overview-note">
        窗口一样长，点的疏密不一样：快失败一次尝试几乎不占时间，所以能在窗口里堆满 5 次；
        慢失败一次就吃掉 <code>{SYSTEMD_LIMITS.dbTimeoutSec}s</code>，窗口里最多塞下 2 次。
      </p>
    </div>
  );
}

/** journal 原文：图不能替代可复核证据。 */
function JournalEvidence() {
  return (
    <div className="w9-journal">
      <span className="w9-overview-label">journal 决定性证据（实测）</span>
      <p className="w9-journal-trigger">{FAST_FAIL_OBSERVED.trigger}</p>
      <ol className="w9-journal-lines">
        {FAST_FAIL_OBSERVED.journal.map((line) => (
          <li key={line}><code>{line}</code></li>
        ))}
      </ol>
      <p className="w9-journal-recovery">
        <b>恢复</b>
        {FAST_FAIL_OBSERVED.recovery}
      </p>
    </div>
  );
}

/** 注入设计盲区：比结论更值得复习——它记录的是实验设计本身会出错。 */
function BlindSpot() {
  return (
    <div className="w9-blindspot">
      <div className="w6-section-head">
        <span>the experiment that failed first</span>
        <h3>第一次注入没测到东西，被依赖语义挡掉了</h3>
      </div>
      <ol className="w9-blindspot-steps">
        <li className="initial">
          <span>❌ 原设计</span>
          <p>{INJECTION_BLIND_SPOT.intent}</p>
        </li>
        <li className="problem">
          <span>⚡ 实际发生</span>
          <p>{INJECTION_BLIND_SPOT.whatHappened}</p>
        </li>
        <li className="final">
          <span>✅ 修正</span>
          <p>{INJECTION_BLIND_SPOT.fix}</p>
        </li>
      </ol>
      <p className="w9-blindspot-lesson" role="note">{INJECTION_BLIND_SPOT.lesson}</p>
    </div>
  );
}

/* ==========================================================================
   ④ 端到端验收链。
   重点不是「覆盖到哪」，是**没覆盖到哪**——所以主图就是覆盖跨度：
   同一条链切成四段，每次验收各自从第几段开始一目了然，没盖到的段显式标
   「没验证」。「B2 的 200 没有证明什么」因此是看出来的，不用读三段记录再自己对齐。
   ========================================================================== */

function AcceptanceChain({ review }: { review: boolean }) {
  const [runId, setRunId] = useState(ACCEPTANCE_RUNS[0].id);
  const [revealed, setRevealed] = useState(false);
  const run = ACCEPTANCE_RUNS.find((r) => r.id === runId) ?? ACCEPTANCE_RUNS[0];
  const showAnswer = !review || revealed;

  useEffect(() => {
    setRevealed(false);
  }, [review]);

  return (
    <section className="w9-acc" aria-label="端到端验收链">
      <div className="w6-section-head">
        <span>same chain, different spans</span>
        <h3>{ACCEPTANCE_RUNS.length} 次验收读起来像重复记录，实际覆盖段完全不同</h3>
      </div>

      {/* 主图即结论图：位置 = 链上第几段，空格 = 这次没验证。 */}
      <div className="w9-acc-grid" role="table" aria-label={coverageSummary()}>
        <div className="w9-acc-head" role="row">
          <span role="columnheader">验收</span>
          {ACC_SEGMENTS.map((seg) => (
            <span key={seg.id} role="columnheader">
              {seg.label}
              <small>{seg.detail}</small>
            </span>
          ))}
        </div>
        {ACCEPTANCE_RUNS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="row"
            className={`w9-acc-row${item.id === runId ? " on" : ""}`}
            onClick={() => setRunId(item.id)}
            aria-pressed={item.id === runId}
          >
            <span className="w9-acc-name" role="rowheader">
              {item.label}
              <small>{item.when}</small>
            </span>
            {ACC_SEGMENTS.map((seg, i) => {
              const covered = item.covers.includes(i);
              return (
                <span
                  key={seg.id}
                  role="cell"
                  data-col={seg.label}
                  className={`w9-acc-seg ${covered ? "covered" : "uncovered"}`}
                >
                  {covered ? "验证到" : "没验证"}
                </span>
              );
            })}
          </button>
        ))}
      </div>

      <p className="w9-acc-caveat" role="note">
        <b>这几组数字不能并排当趋势</b>
        {READING_CAVEAT}
      </p>
      {/* 四次公网验收的覆盖段完全一样——这把尺子量不到「从哪扇门进来的」，必须说破。 */}
      <p className="w9-acc-limit" role="note">
        <b>覆盖段这把尺子的边界</b>
        {COVERAGE_LIMIT}
      </p>

      <div className="w9-acc-detail">
        <header>
          <strong>{run.label}</strong>
          <GradeChip grade={run.grade} />
          <em>{run.when}</em>
        </header>
        <p className="w9-acc-from"><b>起点</b>{run.from}</p>
        {run.entry && <p className="w9-acc-entry"><b>入口面</b>{run.entry}</p>}

        <div className="w9-acc-cols">
          <div className="w9-acc-steps">
            <span className="w9-overview-label">实际走的步骤</span>
            <ol>
              {run.steps.map((step) => <li key={step}><code>{step}</code></li>)}
            </ol>
          </div>
          <div className="w9-acc-readings">
            <span className="w9-overview-label">实测读数</span>
            <dl>
              {run.readings.map((r) => (
                <div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>
              ))}
            </dl>
          </div>
        </div>

        {run.id === "b3" && <TimezoneNote />}
        {/* H1 的验收口径归「证书与信任」板——那里问的是「证明了什么」，
            这里问的是「覆盖了哪几段」，同一条命令服务于两个不同的问题。 */}
        {run.id === "d4https" && (
          <p className="w9-acc-pointer" role="note">
            <b>这条命令为什么必须这么写</b>
            H1 经两轮 review 收紧的三处（必须本地跑、不许加 <code>-k</code>、必须用域名），
            连同证书信任链与 90 天续期，都在<b>「证书与信任」</b>板上。
          </p>
        )}

        {!showAnswer ? (
          <div className="w9-reveal-gate">
            <strong>先答：这次 200 <b>没有</b>证明什么</strong>
            <p>
              起点与读数都给了。说出这次验收**没有覆盖**到链上的哪几段，
              以及由此推不出的两三句结论——再点开核对。
            </p>
            <button type="button" onClick={() => setRevealed(true)}>展开能证明 / 不能证明</button>
          </div>
        ) : (
          <div className="w9-acc-boundary">
            <article className="proves">
              <span>能证明</span>
              <ul>{run.proves.map((t) => <li key={t}>{t}</li>)}</ul>
            </article>
            <article className="limits">
              <span>不能证明</span>
              <ul>{run.limits.map((t) => <li key={t}>{t}</li>)}</ul>
            </article>
          </div>
        )}
      </div>
    </section>
  );
}

function coverageSummary(): string {
  return ACCEPTANCE_RUNS.map((r) => {
    const yes = r.covers.map((i) => ACC_SEGMENTS[i].label).join("、");
    const no = ACC_SEGMENTS.filter((_, i) => !r.covers.includes(i)).map((s) => s.label).join("、");
    return `${r.label} 覆盖 ${yes}${no ? `，没覆盖 ${no}` : "，四段全覆盖"}`;
  }).join("；") + "。";
}

/**
 * H1 验收的三处收紧，必须紧邻 D4-HTTPS 那一行——
 * 否则「HTTP_CODE:200」会被读成「HTTPS 通了」，而这条验收的全部价值在于它还证明了「证书被信任」。
 */
function HttpsAcceptance() {
  return (
    <div className="w9-h1">
      <div className="w9-h1-head">
        <span>H1 · 唯一验收</span>
        <GradeChip grade="measured" />
      </div>
      <pre className="w9-h1-cmd"><code>{HTTPS_READINGS.command}</code></pre>
      <p className="w9-h1-result"><b>{HTTPS_READINGS.result}</b></p>
      <div className="w9-h1-tight">
        <span className="w9-overview-label">两轮 review 收紧的三处 · 每一处都能独立废掉这条验收</span>
        <ul>
          {HTTPS_READINGS.tightened.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>
      <p className="w9-h1-caveat" role="note"><b>执行期才暴露的口径</b>{HTTPS_READINGS.zeroCaveat}</p>
      <div className="w9-h1-meta">
        <p><b>证书</b>{HTTPS_READINGS.cert}</p>
        <p><b>续期</b>{HTTPS_READINGS.renew}</p>
      </div>
    </div>
  );
}

/** 时区观察点必须紧邻 B3，否则「7 月怎么冒出 3 单」会被读成数据错误。 */
function TimezoneNote() {
  return (
    <div className="w9-tz">
      <div className="w9-tz-head">
        <span>观察点</span>
        <GradeChip grade={TIMEZONE_NOTE.grade} />
      </div>
      <p className="w9-tz-obs">{TIMEZONE_NOTE.observation}</p>
      <p className="w9-tz-cause"><b>归因</b>{TIMEZONE_NOTE.cause}</p>
      <p className="w9-tz-status">
        <b>{TIMEZONE_NOTE.decided ? "8/14 决策" : "处理"}</b>
        {TIMEZONE_NOTE.status}
      </p>
    </div>
  );
}

/* ==========================================================================
   ⑤ 反代 header 决策。
   这是纯推理内容，既不是链路也不是时间过程。空间编码用**跨越边界的值改写**：
   同一个字段在 Nginx 两侧各写一次，中间一条竖线就是反代边界——
   「失真」于是是字面可见的，不用先读一段解释再想象。
   ========================================================================== */

function ProxyHeaders({ review }: { review: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const showAnswer = !review || revealed;

  useEffect(() => {
    setRevealed(false);
  }, [review]);

  return (
    <section className="w9-proxy" aria-label="反代 header 决策">
      <div className="w6-section-head">
        <span>what the proxy rewrites</span>
        <h3>三个字段跨过 Nginx 就变了值，补不补要看应用读不读</h3>
      </div>

      <div className="w9-distort" role="table" aria-label={distortSummary()}>
        <div className="w9-distort-head" role="row">
          <span role="columnheader">字段</span>
          <span role="columnheader">客户端真正发出</span>
          <span aria-hidden="true" />
          <span role="columnheader">Node 实际看到</span>
        </div>
        {DISTORTIONS.map((d) => (
          <div key={d.id} className={`w9-distort-row ${d.decision === "配" ? "kept" : "dropped"}`} role="row">
            <span className="w9-distort-field" role="rowheader">{d.field}</span>
            <span className="w9-distort-sent" role="cell">{d.sent}</span>
            {/* 竖线 = 反代边界，改写标记落在跨越的那一刻 */}
            <span className="w9-distort-cross" aria-hidden="true">
              <i />
              <em>改写</em>
            </span>
            <span className="w9-distort-seen" role="cell">
              <b>{d.seen}</b>
              {/* 默认失真与「修没修」是两件事，分两行写，不靠颜色把它们压成一格 */}
              {d.fixed && <em>{d.fixed}</em>}
            </span>
          </div>
        ))}
        {/* 用同一套网格放标签，才能落在竖线那一列上——按 50% 定位会偏，
            因为竖线所在的列不在容器正中。 */}
        <div className="w9-distort-foot" aria-hidden="true">
          <span />
          <span />
          <span className="w9-distort-boundary">Nginx 反代边界</span>
          <span />
        </div>
      </div>

      <div className="w9-decide">
        {DISTORTIONS.map((d) => (
          <article key={d.id} className={d.decision === "配" ? "kept" : "dropped"}>
            <header>
              <strong>{d.field}</strong>
              <em className={d.decision === "配" ? "yes" : "no"}>{d.decision}</em>
            </header>
            <p className="w9-decide-remedy"><b>理论补传</b><code>{d.remedy}</code></p>
            <p className="w9-decide-code">
              <b>{d.consumed ? "应用消费" : "应用不消费"}</b>
              {d.codeEvidence}
            </p>
            <p className="w9-decide-why">{d.why}</p>
          </article>
        ))}
      </div>

      {!showAnswer ? (
        <div className="w9-reveal-gate">
          <strong>先答：该不该把这三个头补回去</strong>
          <p>
            读代码已经告诉你应用消不消费这三类字段。说出<b>判断规则</b>是什么，
            以及将来真要引入 XFF 时，为什么<b>只改 Nginx 一侧是不够的</b>。
          </p>
          <button type="button" onClick={() => setRevealed(true)}>展开判断规则与落盘配置</button>
        </div>
      ) : (
        <>
          <div className="w9-pair">
            <div className="w6-section-head">
              <span>the rule</span>
              <h3>{PAIRING_RULE.question}</h3>
            </div>
            <div className="w9-pair-branches">
              <article className="yes">
                <em>{PAIRING_RULE.yes.label}</em>
                <strong>{PAIRING_RULE.yes.action}</strong>
                <p>{PAIRING_RULE.yes.risk}</p>
              </article>
              <article className="no">
                <em>{PAIRING_RULE.no.label}</em>
                <strong>{PAIRING_RULE.no.action}</strong>
                <p>{PAIRING_RULE.no.risk}</p>
              </article>
            </div>
          </div>

          <SiteConfigs />
        </>
      )}
    </section>
  );
}

/**
 * 四份落盘配置。并排放才看得出：443 是 80 加一层 TLS，而 8080 / 8081 的 location /
 * 换了性质——前两个是 proxy_pass（不读盘），后两个是 root（要读盘）。
 */
function SiteConfigs() {
  const [siteId, setSiteId] = useState(SITE_CONFIGS[0].id);
  const site = SITE_CONFIGS.find((s) => s.id === siteId) ?? SITE_CONFIGS[0];

  return (
    <div className="w9-config">
      <div className="w9-config-head">
        <span className="w9-overview-label">服务器上实际生效的四份站点配置</span>
        <GradeChip grade="measured" />
      </div>
      <div className="w9-config-switch" role="group" aria-label="站点配置">
        {SITE_CONFIGS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === siteId ? "on" : ""}
            aria-pressed={s.id === siteId}
            onClick={() => setSiteId(s.id)}
          >
            <code>:{s.port}</code>
            <small>{s.label.replace("sites-available/", "")}</small>
          </button>
        ))}
      </div>
      <p className="w9-config-purpose">{site.purpose}</p>
      <pre><code>{site.config}</code></pre>
      <p className="w9-config-note" role="note">{NOT_ADOPTED}</p>
      <p className="w9-config-proof">
        <b>生效证据</b>
        {ACCEPTANCE_READINGS.head}；{ACCEPTANCE_READINGS.proxyProof}
      </p>
    </div>
  );
}

function distortSummary(): string {
  return DISTORTIONS.map(
    (d) => `${d.field}：客户端发出「${d.sent}」，穿过 Nginx 后 Node 看到「${d.seen}」，本次决定${d.decision}`,
  ).join("；") + "。";
}

/* ==========================================================================
   ⑥ 契约销账与资源闸门。收束块，三段合一，各用不同的排版密度：
     销账时间轴（位置 = 哪天销的，仍欠的悬在末端）
   → 内存尺（长度 = 占多少）
   → 认知修正 17 条（列表 + 三段式）
   ========================================================================== */

const SETTLE_DAYS = ["D2", "D3", "D4", "D5"] as const;

function SettlementBoard({ review }: { review: boolean }) {
  const owing = CONTRACTS.filter((c) => !c.settledOn);
  const decided = CONTRACTS.filter((c) => c.closure === "decided");

  return (
    <section className="w9-settle" aria-label="契约销账与资源闸门">
      <div className="w6-section-head">
        <span>what is still owed</span>
        <h3>
          D1 冻结了 {CONTRACTS.length} 条<Term id="contract" />，到 D5 全部<Term id="settle" />
          ——但「还欠什么」的答案换了一批人
        </h3>
      </div>

      {/* 位置 = 哪天销的。D5 这一列把最后两条收掉，仍欠那一列因此是空的。 */}
      <div className="w9-settle-track" role="img" aria-label={settleSummary()}>
        <div className="w9-settle-cols">
          {SETTLE_DAYS.map((day) => (
            <div key={day} className="w9-settle-col">
              <span className="w9-settle-day">{day}</span>
              {CONTRACTS.filter((c) => c.settledOn === day).map((c) => (
                <article key={c.id} className={`w9-settle-card done${c.closure === "decided" ? " decided" : ""}`}>
                  <strong>{c.what}</strong>
                  {c.closure === "decided" ? <em className="w9-settle-kind">决策关闭，不是修好了</em> : null}
                  <p>{c.evidence}</p>
                </article>
              ))}
            </div>
          ))}
          <div className="w9-settle-col owing">
            <span className="w9-settle-day">仍欠</span>
            {owing.length === 0 ? (
              <p className="w9-settle-empty">
                这一列空了。D1 那天想到的事到 8/14 全部有了结论——
                其中 {decided.length} 条是「决定不做」而不是「做完了」。
              </p>
            ) : (
              owing.map((c) => (
                <article key={c.id} className="w9-settle-card owed">
                  <strong>{c.what}</strong>
                  <p>{c.evidence}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      {/*
        契约表之外那一批。这一节此前挂的是 Q8——它 8/14 还清了，
        但「还欠什么」这一问不会因此没有答案：契约表只对账 D1 那天想到的事。
      */}
      <div className="w9-offbook">
        <div className="w6-section-head">
          <span>off the ledger</span>
          <h3>契约表之外：这一周做事的过程中新长出来的四笔</h3>
        </div>
        <div className="w9-offbook-list">
          {OPEN_ITEMS.map((item) => (
            <article key={item.what} className={`w9-offbook-item ${item.kind}`}>
              <em>{item.kind === "accepted" ? "主动接受" : "还欠着"}</em>
              <strong>{item.what}</strong>
              <p>{item.why}</p>
              <p className="w9-offbook-owner"><b>归谁</b>{item.owner}</p>
            </article>
          ))}
        </div>
        <p className="w9-offbook-note" role="note">{OPEN_ITEMS_NOTE}</p>
      </div>

      <MemoryGate />
      <ProductionParity />
      <Corrections9 review={review} />
    </section>
  );
}

function settleSummary(): string {
  const byDay = SETTLE_DAYS.map(
    (d) => `${d} 销掉 ${CONTRACTS.filter((c) => c.settledOn === d).length} 条`,
  ).join("、");
  const owing = CONTRACTS.filter((c) => !c.settledOn);
  const tail =
    owing.length === 0
      ? "仍欠 0 条——D1 冻结的契约到 D5 全部有了结论"
      : `仍欠 ${owing.length} 条：${owing.map((c) => c.what).join("、")}`;
  return `${byDay}；${tail}。`;
}

/** 内存尺：长度 = 占多少。少数几个数字，但有对照价值。 */
function MemoryGate() {
  const { totalMB, availableMB, processes, prediction } = MEMORY_GATE;
  const pct = (mb: number) => `${(mb / totalMB) * 100}%`;
  const used = processes.filter((p) => p.name !== "nginx").reduce((sum, p) => sum + p.mb, 0);

  return (
    <div className="w9-mem">
      <div className="w6-section-head">
        <span>memory gate</span>
        <h3><Term id="memory-gate" />：{totalMB} MB 里谁占了多少</h3>
      </div>

      <div className="w9-mem-bar" role="img" aria-label={`总内存 ${totalMB} MB，mongod 占 ${processes[0].mb} MB，nodeapp 占 ${processes[1].mb} MB，可用 ${availableMB} MB。`}>
        {processes.filter((p) => p.name !== "nginx").map((p, i) => (
          <span key={p.name} className={`w9-mem-seg p${i}`} style={{ width: pct(p.mb) }}>
            <b>{p.name}</b>
            <i>{p.mb} MB</i>
          </span>
        ))}
        <span className="w9-mem-seg free" style={{ width: pct(availableMB) }}>
          <b>available</b>
          <i>{availableMB} MB</i>
        </span>
        <span className="w9-mem-seg other" style={{ width: pct(totalMB - used - availableMB) }} />
      </div>
      <p className="w9-mem-swap">
        <b>Swap = {MEMORY_GATE.swapMB}</b>
        真撞到内存上限时没有磁盘兜底。这是现状，不是主动选择。
      </p>

      {/* 预测被实测推翻——两个数放在同一把尺上才有比较价值 */}
      <div className="w9-mem-pred">
        <article className="pred">
          <span>D3 §2.2 预测</span>
          <strong>{prediction.what}</strong>
        </article>
        <i aria-hidden="true">→</i>
        <article className="actual">
          <span>B5 实测</span>
          <strong>{prediction.actual}</strong>
        </article>
      </div>
      <p className="w9-mem-conclusion">{prediction.conclusion}</p>

      <p className="w9-mem-verdict"><b>闸门判定</b>{MEMORY_GATE.verdict}</p>
      <p className="w9-mem-caveat" role="note"><b>口径</b>{MEMORY_GATE.caveat}</p>
    </div>
  );
}

/** 与真实生产的对照：缺的是成熟度，不是结构。 */
function ProductionParity() {
  return (
    <div className="w9-parity">
      <div className="w6-section-head">
        <span>versus real production</span>
        <h3>缺的这些是成熟度差异，不是结构错误</h3>
      </div>
      <div className="w9-parity-cols">
        <article className="done">
          <span>已做 · 真实生产也在做</span>
          <ul>{PRODUCTION_PARITY.done.map((t) => <li key={t}>{t}</li>)}</ul>
        </article>
        <article className="missing">
          <span>缺 · 各有归属</span>
          <ul>
            {PRODUCTION_PARITY.missing.map((m) => (
              <li key={m.what}>{m.what}<em>{m.owner}</em></li>
            ))}
          </ul>
        </article>
      </div>
      <p className="w9-parity-verdict">{PRODUCTION_PARITY.verdict}</p>
    </div>
  );
}

/**
 * 认知修正。复习态先只给初始说法，自己判断错在哪一步。
 * 条数跟着数据走，不写死——但要注意这里是**执行期踩出来的**那一批；
 * D5 能力检验里口述时暴露的那 8 条不在这份表里（浓缩地图 §5 才是全量日志）。
 */
function Corrections9({ review }: { review: boolean }) {
  const [openIds, setOpenIds] = useState<string[]>([]);

  useEffect(() => {
    setOpenIds(review ? [] : W9_CORRECTIONS.map((c) => c.id));
  }, [review]);

  const allOpen = openIds.length === W9_CORRECTIONS.length;
  const experiential = W9_CORRECTIONS.filter((c) => c.kind === "experiential").length;

  return (
    <div className="w9-fix">
      <div className="w6-section-head">
        <span>corrections</span>
        <h3>{W9_CORRECTIONS.length} 条初始说法被推翻，留下的是修正后的版本</h3>
      </div>
      <p className="w9-fix-lead">
        分类比结论本身更值得复习：它记录的是<b>哪一类推理会出错</b>。其中 {experiential} 条属
        <b>「工具行为经验」</b>——不是推理错误，是必须真实遇过一次才知道的东西。
        把它们和「结论超出证据」混成一类，等于告诉复习者「你本该推出来」。
        {review && !allOpen && "复习态先只给初始说法，自己判断问题出在哪一步。"}
      </p>
      <p className="w9-fix-scope" role="note">
        这 {W9_CORRECTIONS.length} 条是<b>执行期踩出来的</b>。D5 能力检验里口述时暴露的另外 8 处
        不在这张表上——它们的性质不同：不是做的时候踩到，是<b>讲的时候才发现自己没真懂</b>。
        全量日志在笔记 tab 的「W9 浓缩地图」§5。
      </p>

      {review && !allOpen && (
        <button
          type="button"
          className="w9-fix-all"
          onClick={() => setOpenIds(W9_CORRECTIONS.map((c) => c.id))}
        >
          全部展开核对
        </button>
      )}

      <ol className="w9-fix-list">
        {W9_CORRECTIONS.map((item, index) => {
          const open = openIds.includes(item.id);
          return (
            <li key={item.id} className={`w9-fix-item ${item.kind}${open ? " open" : ""}`}>
              <b aria-hidden="true">{index + 1}</b>
              <div>
                <p className="w9-fix-initial"><span>❌ 初始说法</span>{item.initial}</p>
                {open ? (
                  <>
                    <p className="w9-fix-problem">
                      <span>问题</span>
                      <em>{W9_CORRECTION_KIND[item.kind]}</em>
                      {item.problem}
                    </p>
                    <p className="w9-fix-final"><span>✅ 修正</span>{item.final}</p>
                    <p className="w9-fix-from">{item.from}</p>
                  </>
                ) : (
                  <button type="button" onClick={() => setOpenIds((ids) => [...ids, item.id])}>
                    这句错在哪一步？展开核对
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* 阶段进度：避免把「做了一块」呈现成「W9 已经做完」。 */
function StagePlan() {
  const done = W9_STAGE_PLAN.filter((item) => item.done).length;
  return (
    <section className="w9-stage-plan" aria-label="本板建构进度">
      <div className="w6-section-head">
        <span>board roadmap</span>
        <h3>本板共 {W9_STAGE_PLAN.length} 块，当前落地 {done} 块</h3>
      </div>
      <ul className="w9-stage-list">
        {W9_STAGE_PLAN.map((item) => (
          <li key={item.id} className={item.done ? "done" : "todo"}>
            <i aria-hidden="true">{item.done ? "✓" : "—"}</i>
            <strong>{item.title}</strong>
            <span>{item.question}</span>
            <em>{item.done ? "已落地" : "待做"}</em>
          </li>
        ))}
      </ul>
      <p className="w9-stage-note">
        语法先由「故障分叉」一块代表页验证（四态切换、停止点后揭示状态码、证据档位强制显示），
        成立后才推其余各块。8/13 主线收口后按新事实重建，并从六块扩到十块——
        「URL 面与授权层」从「信任边界」拆出（同一条原则，两个问题），
        新增「证书与信任」「改一台在跑的机器」与「服务边界 vs 暴露边界」三块此前无归宿的内容。
        范围与口径边界见笔记 <code>week9-visualization-plan.md</code>。
      </p>
    </section>
  );
}
