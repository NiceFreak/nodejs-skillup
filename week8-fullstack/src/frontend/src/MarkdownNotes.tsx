import { useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import readme from "../../../README.md?raw";
import features from "../../../notes/frontend-features-cheatsheet.md?raw";
import toolbox from "../../../notes/frontend-toolbox.md?raw";
import legacy from "../../../notes/legacy-projects-and-staying-current.md?raw";
import hooks from "../../../notes/react-hooks-interview-map.md?raw";
import deploy from "../../../notes/deploy-pipeline.md?raw";
// 来自 week8 之外的笔记：W6 主线收束，以及两份面试问答稿——
// 手机复习要读的就是它们，所以直接读源文件，不在前端维护副本。
import w6model from "../../../../week6-testing/notes/week6-testing-ci-mental-model.md?raw";
import qaSheet from "../../../../interview-prep/backend-qa-sheet.md?raw";
import dbSheet from "../../../../interview-prep/db-review-sheet.md?raw";
// W9 部署链路：这几份写的是一台在跑的服务器——公网 IP、端口、systemd 单元行为、
// 排障判据。部署板本身设成了只在复习状态出现，笔记这边必须用同一条口径，
// 否则等于绕过那个决定（notes tab 在展示状态是可见的）。
import w9roadmap from "../../../../week9-deployment/notes/week9-roadmap-d1-d4.md?raw";
import w9d4 from "../../../../week9-deployment/notes/day4-http-reverse-proxy.md?raw";
import w9d3 from "../../../../week9-deployment/notes/day3-finish-d2-and-db.md?raw";
import w9d2 from "../../../../week9-deployment/notes/day2-host-and-node-service.md?raw";
import w9d1 from "../../../../week9-deployment/notes/day1-contract-freeze.md?raw";
import w9viz from "../../../../week9-deployment/notes/week9-visualization-plan.md?raw";
import type { BoardMode } from "./types";

interface NoteSource {
  id: string;
  label: string;
  description: string;
  source: string;
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
  // 放在首位：面试问答稿是当前最常翻的一份，手机上直接读原文最省事。
  { id: "qa", label: "面试问答稿", description: "W1–W6 的 37 道题与答法骨架（配套「面试准备」板）", source: qaSheet, file: "backend-qa-sheet.md", repoPath: "interview-prep/backend-qa-sheet.md" },
  { id: "dbqa", label: "DB 自测稿", description: "MongoDB 聚合 / 索引 10 题自测（尚未过，过完可把 DB 调回强项）", source: dbSheet, file: "db-review-sheet.md", repoPath: "interview-prep/db-review-sheet.md" },
  { id: "w6model", label: "W6 心智模型", description: "测试与 CI：从「本地能跑」到「每次 push 可独立验证」", source: w6model, file: "week6-testing-ci-mental-model.md", repoPath: "week6-testing/notes/week6-testing-ci-mental-model.md" },
  { id: "readme", label: "项目说明", description: "运行方式、页面路径与验收动线", source: readme, file: "README.md", repoPath: "week8-fullstack/README.md" },
  { id: "features", label: "能力速查", description: "代码里已经使用的 ES、TS、React 与 CSS", source: features, file: "frontend-features-cheatsheet.md", repoPath: "week8-fullstack/notes/frontend-features-cheatsheet.md" },
  { id: "hooks", label: "Hooks 面试", description: "从类组件迁移到 Hooks 的判断地图", source: hooks, file: "react-hooks-interview-map.md", repoPath: "week8-fullstack/notes/react-hooks-interview-map.md" },
  { id: "toolbox", label: "前端工具箱", description: "状态、布局、测试与生态选型", source: toolbox, file: "frontend-toolbox.md", repoPath: "week8-fullstack/notes/frontend-toolbox.md" },
  { id: "legacy", label: "存量项目", description: "旧项目判断、迁移策略与面试叙事", source: legacy, file: "legacy-projects-and-staying-current.md", repoPath: "week8-fullstack/notes/legacy-projects-and-staying-current.md" },
  { id: "deploy", label: "部署链路", description: "展板怎么上线：零后端双仓发布链路（可视化）", source: deploy, file: "deploy-pipeline.md", repoPath: "week8-fullstack/notes/deploy-pipeline.md" },

  // W9 原文（只在复习状态）：配套「部署上线」板，手机上要读的就是这几份。
  { id: "w9roadmap", label: "W9 浓缩地图", description: "D1–D4 的目标拓扑、端口表、认知修正与白话对照表", source: w9roadmap, file: "week9-roadmap-d1-d4.md", repoPath: "week9-deployment/notes/week9-roadmap-d1-d4.md", reviewOnly: true },
  { id: "w9d4", label: "W9 D4 · 反代", description: "Nginx 反代 + ufw 80 + 凭据轮换；附 Nginx 解决什么问题的概念问答", source: w9d4, file: "day4-http-reverse-proxy.md", repoPath: "week9-deployment/notes/day4-http-reverse-proxy.md", reviewOnly: true },
  { id: "w9d3", label: "W9 D3 · 数据库", description: "MongoDB 接通 + 阶段 B 五项（seed / 端到端 / 重启 / 故障注入 / RSS）", source: w9d3, file: "day3-finish-d2-and-db.md", repoPath: "week9-deployment/notes/day3-finish-d2-and-db.md", reviewOnly: true },
  { id: "w9d2", label: "W9 D2 · 主机", description: "最小权限用户、SSH 与 ufw、Node 运行时、systemd 七条契约", source: w9d2, file: "day2-host-and-node-service.md", repoPath: "week9-deployment/notes/day2-host-and-node-service.md", reviewOnly: true },
  { id: "w9d1", label: "W9 D1 · 契约", description: "开工前讲死的边界：验收接口、端口表、失败路径、进程守护选型", source: w9d1, file: "day1-contract-freeze.md", repoPath: "week9-deployment/notes/day1-contract-freeze.md", reviewOnly: true },
  { id: "w9viz", label: "W9 展板方法", description: "这块板怎么建的：六块设计、口径边界总表与逐块执行记录", source: w9viz, file: "week9-visualization-plan.md", repoPath: "week9-deployment/notes/week9-visualization-plan.md", reviewOnly: true },
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
  const contentVisible = mode === "demo" || revealedTopic === active.id;

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
  }, [active.id, contentVisible]);

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
            <h3>这份笔记写的是一台在跑的服务器</h3>
            <p>
              公网 IP、端口、systemd 单元行为与排障判据都在里面，和「部署上线」板同一条口径：
              不进对外展示。切到复习状态即可打开。
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
                {active.source}
              </ReactMarkdown>
            </article>

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
