import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BoardMode } from "./types";

interface NoteSource {
  id: string;
  label: string;
  description: string;
  /**
   * 正文按需加载。原先是静态 `?raw` 导入，15 份正文全压进 MarkdownNotes 这一个
   * chunk（gzip 197 kB），点开笔记 tab 就得整包下载。改成每份一个动态 import：
   * Vite 会各自切一个 chunk，只有真正打开某一份时才拉它。
   */
  load: () => Promise<string>;
  file: string; // 仓库内文件名，用于把 .md 交叉引用映射回展板笔记
  repoPath: string; // 文件在仓库中的完整路径，用于解析相对链接
  /** 只在复习状态列出。与部署板同一条不变式：个人 / 基础设施细节不进对外 demo。 */
  reviewOnly?: boolean;
}

interface TocItem {
  id: string;
  label: string;
  level: 2 | 3;
}

const NOTES: NoteSource[] = [
  // 两份问答稿是个人材料，与「面试准备」板同一条口径：只在复习状态列出。
  // 之前它们在展示状态也列着，而对应的板本身是 reviewOnly——那是一处不一致。
  // 放在首位：复习时这是最常翻的两份，手机上直接读原文最省事。
  { id: "qa", label: "面试问答稿", description: "W1–W6 的 37 道题与答法骨架（配套「面试准备」板）", load: () => import("../../../../interview-prep/backend-qa-sheet.md?raw").then((m) => m.default), file: "backend-qa-sheet.md", repoPath: "interview-prep/backend-qa-sheet.md", reviewOnly: true },
  { id: "dbqa", label: "DB 自测稿", description: "MongoDB 聚合 / 索引 10 题自测（尚未过，过完可把 DB 调回强项）", load: () => import("../../../../interview-prep/db-review-sheet.md?raw").then((m) => m.default), file: "db-review-sheet.md", repoPath: "interview-prep/db-review-sheet.md", reviewOnly: true },
  { id: "w6model", label: "W6 心智模型", description: "测试与 CI：从「本地能跑」到「每次 push 可独立验证」", load: () => import("../../../../week6-testing/notes/week6-testing-ci-mental-model.md?raw").then((m) => m.default), file: "week6-testing-ci-mental-model.md", repoPath: "week6-testing/notes/week6-testing-ci-mental-model.md" },
  { id: "readme", label: "项目说明", description: "运行方式、页面路径与验收动线", load: () => import("../../../README.md?raw").then((m) => m.default), file: "README.md", repoPath: "week8-fullstack/README.md" },
  { id: "features", label: "能力速查", description: "代码里已经使用的 ES、TS、React 与 CSS", load: () => import("../../../notes/frontend-features-cheatsheet.md?raw").then((m) => m.default), file: "frontend-features-cheatsheet.md", repoPath: "week8-fullstack/notes/frontend-features-cheatsheet.md" },
  { id: "hooks", label: "Hooks 面试", description: "从类组件迁移到 Hooks 的判断地图", load: () => import("../../../notes/react-hooks-interview-map.md?raw").then((m) => m.default), file: "react-hooks-interview-map.md", repoPath: "week8-fullstack/notes/react-hooks-interview-map.md" },
  { id: "toolbox", label: "前端工具箱", description: "状态、布局、测试与生态选型", load: () => import("../../../notes/frontend-toolbox.md?raw").then((m) => m.default), file: "frontend-toolbox.md", repoPath: "week8-fullstack/notes/frontend-toolbox.md" },
  { id: "legacy", label: "存量项目", description: "旧项目判断、迁移策略与面试叙事", load: () => import("../../../notes/legacy-projects-and-staying-current.md?raw").then((m) => m.default), file: "legacy-projects-and-staying-current.md", repoPath: "week8-fullstack/notes/legacy-projects-and-staying-current.md" },
  { id: "deploy", label: "部署链路", description: "展板怎么上线：零后端双仓发布链路（可视化）", load: () => import("../../../notes/deploy-pipeline.md?raw").then((m) => m.default), file: "deploy-pipeline.md", repoPath: "week8-fullstack/notes/deploy-pipeline.md" },

  // W10 原文（只在复习状态）：配套「可观测性」板。板上每条结论都指回这五份，
  // 不把源文件接进来，读者就只能看结论、核不了事实。
  { id: "w10d3", label: "W10 D3 · 监控与弄红", description: "四项判据翻成能自己跑的检查，再逐项弄红一次：P1–P5 五问、九项验证实测、timer 与「谁监控监控本身」", load: () => import("../../../../week10-observability/notes/day3-monitoring-alerting.md?raw").then((m) => m.default), file: "day3-monitoring-alerting.md", repoPath: "week10-observability/notes/day3-monitoring-alerting.md", reviewOnly: true },
  { id: "w10d2", label: "W10 D2 · 日志上线", description: "变更单四要素 + 七项验证实测 vs 期望 + 执行期四条新增事实（含查询串凭据那条阻断）", load: () => import("../../../../week10-observability/notes/day2-logging-rollout.md?raw").then((m) => m.default), file: "day2-logging-rollout.md", repoPath: "week10-observability/notes/day2-logging-rollout.md", reviewOnly: true },
  { id: "w10d1", label: "W10 D1 · 观测契约", description: "记什么、不记什么、谁来关联、什么算红、哪些故障可以真做——Q1–Q15 与冲突自查七对", load: () => import("../../../../week10-observability/notes/day1-observability-contract.md?raw").then((m) => m.default), file: "day1-observability-contract.md", repoPath: "week10-observability/notes/day1-observability-contract.md", reviewOnly: true },
  { id: "w10plan", label: "W10 周计划", description: "D1–D5 节奏、演练三档安全边界与本周黑白名单判断（D1✓ D2✓ D3✓）", load: () => import("../../../../week10-observability/notes/week10-plan.md?raw").then((m) => m.default), file: "week10-plan.md", repoPath: "week10-observability/notes/week10-plan.md", reviewOnly: true },
  { id: "w10viz", label: "W10 展板方法", description: "这块板怎么建的：分块设计、contract 档位、口径边界总表与「先做的会先说谎」的阶段顺序", load: () => import("../../../../week10-observability/notes/week10-visualization-plan.md?raw").then((m) => m.default), file: "week10-visualization-plan.md", repoPath: "week10-observability/notes/week10-visualization-plan.md", reviewOnly: true },

  // W9 原文（只在复习状态）：配套「部署上线」板，手机上要读的就是这几份。
  { id: "w9roadmap", label: "W9 浓缩地图", description: "全周 D1–D5 的目标拓扑、两张面表、32 条认知修正与白话对照表（§6.4 是 D5 收口）", load: () => import("../../../../week9-deployment/notes/week9-roadmap-d1-d4.md?raw").then((m) => m.default), file: "week9-roadmap-d1-d4.md", repoPath: "week9-deployment/notes/week9-roadmap-d1-d4.md", reviewOnly: true },
  { id: "w9d5", label: "W9 D5 · 收口日", description: "冷启动自愈 + 信任边界复核 + 能力检验 8 处当场修正 + Q8 还债 + admin 迁 443 + 变更单思维", load: () => import("../../../../week9-deployment/notes/day5-rebuild-closeout.md?raw").then((m) => m.default), file: "day5-rebuild-closeout.md", repoPath: "week9-deployment/notes/day5-rebuild-closeout.md", reviewOnly: true },
  { id: "w9demo", label: "W9 Demo 讲稿", description: "从本地到线上中间多出来的是什么：8 分钟动线、演示前自检与三条对外呈现边界", load: () => import("../../../../week9-deployment/notes/day5-demo-script.md?raw").then((m) => m.default), file: "day5-demo-script.md", repoPath: "week9-deployment/notes/day5-demo-script.md", reviewOnly: true },
  { id: "w9perm", label: "W9 权限速查表", description: "服务器上「你是谁」决定「你能碰什么」：三种身份、属主表与 12 条坑族", load: () => import("../../../../week9-deployment/notes/server-permission-cheatsheet.md?raw").then((m) => m.default), file: "server-permission-cheatsheet.md", repoPath: "week9-deployment/notes/server-permission-cheatsheet.md", reviewOnly: true },
  { id: "w9d4c", label: "W9 D4-c · 展板 8081", description: "学习展板独立部署 + 登录门禁 + 构建产物分目录；服务边界 vs 暴露边界的心智", load: () => import("../../../../week9-deployment/notes/day4c-showcase-gate-deploy.md?raw").then((m) => m.default), file: "day4c-showcase-gate-deploy.md", repoPath: "week9-deployment/notes/day4c-showcase-gate-deploy.md", reviewOnly: true },
  { id: "w9d4b", label: "W9 D4-b · 收敛与 HTTPS", description: "段 0 URL 面收敛（Q0–Q8）+ 8080 管理后台（A1–A9）+ D4-HTTPS 冻结与执行（H1–H4）", load: () => import("../../../../week9-deployment/notes/day4b-https-and-admin-plan.md?raw").then((m) => m.default), file: "day4b-https-and-admin-plan.md", repoPath: "week9-deployment/notes/day4b-https-and-admin-plan.md", reviewOnly: true },
  { id: "w9d4", label: "W9 D4 · 反代", description: "Nginx 反代 + ufw 80 + 凭据轮换；附 Nginx 解决什么问题的概念问答", load: () => import("../../../../week9-deployment/notes/day4-http-reverse-proxy.md?raw").then((m) => m.default), file: "day4-http-reverse-proxy.md", repoPath: "week9-deployment/notes/day4-http-reverse-proxy.md", reviewOnly: true },
  { id: "w9d3", label: "W9 D3 · 数据库", description: "MongoDB 接通 + 阶段 B 五项（seed / 端到端 / 重启 / 故障注入 / RSS）", load: () => import("../../../../week9-deployment/notes/day3-finish-d2-and-db.md?raw").then((m) => m.default), file: "day3-finish-d2-and-db.md", repoPath: "week9-deployment/notes/day3-finish-d2-and-db.md", reviewOnly: true },
  { id: "w9d2", label: "W9 D2 · 主机", description: "最小权限用户、SSH 与 ufw、Node 运行时、systemd 七条契约", load: () => import("../../../../week9-deployment/notes/day2-host-and-node-service.md?raw").then((m) => m.default), file: "day2-host-and-node-service.md", repoPath: "week9-deployment/notes/day2-host-and-node-service.md", reviewOnly: true },
  { id: "w9d1", label: "W9 D1 · 契约", description: "开工前讲死的边界：验收接口、端口表、失败路径、进程守护选型", load: () => import("../../../../week9-deployment/notes/day1-contract-freeze.md?raw").then((m) => m.default), file: "day1-contract-freeze.md", repoPath: "week9-deployment/notes/day1-contract-freeze.md", reviewOnly: true },
  { id: "w9plan", label: "W9 周计划", description: "D1–D5 五天的目标、时间盒与勾选状态（全周已收口）", load: () => import("../../../../week9-deployment/notes/week9-plan.md?raw").then((m) => m.default), file: "week9-plan.md", repoPath: "week9-deployment/notes/week9-plan.md", reviewOnly: true },
  { id: "w9viz", label: "W9 展板方法", description: "这块板怎么建的：板块设计、口径边界总表与逐块执行记录", load: () => import("../../../../week9-deployment/notes/week9-visualization-plan.md?raw").then((m) => m.default), file: "week9-visualization-plan.md", repoPath: "week9-deployment/notes/week9-visualization-plan.md", reviewOnly: true },
];

// 仓库内 .md 交叉引用（如 README 指向各笔记）→ 展板笔记 id：点链接直接切板，而不是打不开。
const NOTE_ID_BY_FILE = new Map(NOTES.map((note) => [note.file, note.id]));

// 展板内没有对应笔记的本地链接（代码文件、目录）→ 指向 GitHub 上可浏览的地址。
// 用 main 分支而非部署分支，链接更持久。
const REPO_BLOB_BASE = "https://github.com/NiceFreak/nodejs-skillup/blob/main";

// 把相对链接（./ 或 ../）按「当前文档所在目录」解析成仓库根下的路径。
function resolveRepoPath(fromRepoPath: string, href: string): string {
  const target = href.split(/[?#]/)[0];
  const stack = fromRepoPath.split("/").slice(0, -1); // 去掉文件名，得到所在目录
  for (const seg of target.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") stack.pop();
    else stack.push(seg);
  }
  return stack.join("/");
}

export default function MarkdownNotes({
  mode,
  topic,
  onTopicChange,
}: {
  mode: BoardMode;
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  // 展示状态只列不带 reviewOnly 的；复习状态全列。
  const visible = mode === "review" ? NOTES : NOTES.filter((note) => !note.reviewOnly);
  const requested = NOTES.find((note) => note.id === topic);
  // 深链指向一份只在复习状态的笔记、而当前是展示状态：给一句明确提示，
  // 而不是悄悄换成另一篇——后者会让人以为链接坏了或内容变了。
  const blocked = mode !== "review" && requested?.reviewOnly ? requested : null;
  const active = (blocked ? null : visible.find((note) => note.id === topic)) ?? visible[0];
  const articleRef = useRef<HTMLElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [revealedTopic, setRevealedTopic] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const contentVisible = mode === "demo" || revealedTopic === active.id;

  // 切笔记或从复习门后揭示时才去拉正文。alive 标志防止快速连点时旧的 promise 后到、
  // 把上一篇的内容盖到当前这篇上。
  useEffect(() => {
    if (blocked || !contentVisible) {
      setText(null);
      return;
    }
    let alive = true;
    setText(null);
    void active.load().then((body) => {
      if (alive) setText(body);
    });
    return () => {
      alive = false;
    };
  }, [active, blocked, contentVisible]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const article = articleRef.current;
    if (!article) return;

    const headings = Array.from(article.querySelectorAll<HTMLHeadingElement>("h2, h3"));
    const nextToc = headings.map((heading, index) => {
      const id = `note-${active.id}-section-${index + 1}`;
      heading.id = id;
      return {
        id,
        label: heading.textContent?.trim() || `章节 ${index + 1}`,
        level: heading.tagName === "H2" ? 2 : 3,
      } satisfies TocItem;
    });

    setToc(nextToc);
    setActiveSection(nextToc[0]?.id ?? null);

    let frame = 0;
    function updateActiveSection() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const current = headings.reduce<HTMLHeadingElement | null>((match, heading) => (
          heading.getBoundingClientRect().top <= 120 ? heading : match
        ), null) ?? headings[0];
        setActiveSection(current?.id ?? null);
        frame = 0;
      });
    }

    window.addEventListener("scroll", updateActiveSection, { passive: true });
    updateActiveSection();
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [active.id, contentVisible, text]);

  function jumpToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "auto" });
  }

  return (
    <section className="notes-browser">
      <header className="notes-browser-head">
        <div>
          <span>仓库原文速览</span>
          <h2>学习笔记</h2>
          <p>直接读取现有 Markdown 源文件；更新笔记后重新构建即可同步，不维护前端副本。</p>
        </div>
        <strong>{visible.length} 份文档</strong>
      </header>

      <div className="notes-browser-layout">
        <nav className="notes-index" aria-label="学习笔记">
          {visible.map((note) => (
            <button
              key={note.id}
              type="button"
              className={note.id === active.id ? "on" : ""}
              onClick={() => onTopicChange(note.id)}
            >
              <strong>{note.label}</strong>
              <span>{note.description}</span>
            </button>
          ))}
        </nav>

        {blocked ? (
          <section className="notes-recall">
            <span>{blocked.label} · 只在复习状态</span>
            <h3>{blocked.repoPath.startsWith("interview-prep/") ? "这是个人面试材料" : "这份笔记写的是一台在跑的服务器"}</h3>
            <p>
              {blocked.repoPath.startsWith("interview-prep/")
                ? "自评、答法骨架与仍在路上的部分都在里面，和「面试准备」板同一条口径：不进对外展示。"
                : "公网 IP、端口、systemd 单元行为与排障判据都在里面，和「部署上线」板同一条口径：不进对外展示。"}
              切到复习状态即可打开。
            </p>
          </section>
        ) : !contentVisible ? (
          <section className="notes-recall">
            <span>{active.label} · 阅读前回忆</span>
            <h3>{active.description}</h3>
            <p>先不打开原文，口述这份文档解决的核心问题、一个判断规则，以及一条证据或适用边界。</p>
            <button type="button" onClick={() => setRevealedTopic(active.id)}>展开原文核对</button>
          </section>
        ) : (
          <>
            {text === null ? (
              <p className="notes-loading">正在载入 {active.label}…</p>
            ) : (
            <article ref={articleRef} className="markdown-reader" key={active.id}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                skipHtml
                components={{
                  table: ({ children }) => <div className="markdown-table"><table>{children}</table></div>,
                  a: ({ href, children }) => {
                    if (!href) return <>{children}</>;
                    // 外链：新标签打开。
                    if (href.startsWith("http://") || href.startsWith("https://")) {
                      return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
                    }
                    // 页内锚点：交给浏览器滚动。
                    if (href.startsWith("#")) return <a href={href}>{children}</a>;
                    // 仓库内 .md 交叉引用且展板收录了该笔记 → 直接在展板内切板（移动端最顺手）。
                    const file = href.split(/[?#]/)[0].split("/").pop() ?? "";
                    const targetId = NOTE_ID_BY_FILE.get(file);
                    if (targetId) {
                      return (
                        <button
                          type="button"
                          className="markdown-note-link"
                          onClick={() => onTopicChange(targetId)}
                        >
                          {children}
                        </button>
                      );
                    }
                    // 其它本地路径（代码、目录）→ 指向 GitHub 上可浏览的地址，替代原先点不动的灰字。
                    const gh = `${REPO_BLOB_BASE}/${resolveRepoPath(active.repoPath, href)}`;
                    return <a href={gh} target="_blank" rel="noreferrer" title={href}>{children}</a>;
                  },
                }}
              >
                {text}
              </ReactMarkdown>
            </article>
            )}

            <aside className="notes-toc" aria-label={`${active.label}章节导航`}>
              <strong>章节导航</strong>
              {toc.length > 0 ? (
                <ol>
                  {toc.map((item) => (
                    <li key={item.id} className={`level-${item.level}`}>
                      <a
                        href={`#${item.id}`}
                        className={activeSection === item.id ? "on" : ""}
                        aria-current={activeSection === item.id ? "location" : undefined}
                        onClick={(event) => {
                          event.preventDefault();
                          jumpToSection(item.id);
                        }}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              ) : (
                <span>本文没有分节标题</span>
              )}
            </aside>
          </>
        )}
      </div>
    </section>
  );
}
