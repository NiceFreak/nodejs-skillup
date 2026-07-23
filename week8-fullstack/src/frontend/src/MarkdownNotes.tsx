import { useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import readme from "../../../README.md?raw";
import features from "../../../notes/frontend-features-cheatsheet.md?raw";
import toolbox from "../../../notes/frontend-toolbox.md?raw";
import legacy from "../../../notes/legacy-projects-and-staying-current.md?raw";
import hooks from "../../../notes/react-hooks-interview-map.md?raw";

interface NoteSource {
  id: string;
  label: string;
  description: string;
  source: string;
}

interface TocItem {
  id: string;
  label: string;
  level: 2 | 3;
}

const NOTES: NoteSource[] = [
  { id: "readme", label: "项目说明", description: "运行方式、页面路径与验收动线", source: readme },
  { id: "features", label: "能力速查", description: "代码里已经使用的 ES、TS、React 与 CSS", source: features },
  { id: "hooks", label: "Hooks 面试", description: "从类组件迁移到 Hooks 的判断地图", source: hooks },
  { id: "toolbox", label: "前端工具箱", description: "状态、布局、测试与生态选型", source: toolbox },
  { id: "legacy", label: "存量项目", description: "旧项目判断、迁移策略与面试叙事", source: legacy },
];

export default function MarkdownNotes({
  topic,
  onTopicChange,
}: {
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  const active = NOTES.find((note) => note.id === topic) ?? NOTES[0];
  const articleRef = useRef<HTMLElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);

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
  }, [active.id]);

  function jumpToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "auto" });
  }

  return (
    <section className="notes-browser">
      <header className="notes-browser-head">
        <div>
          <span>仓库原文速览</span>
          <h2>Week8 前端笔记</h2>
          <p>直接读取现有 Markdown 源文件；更新笔记后重新构建即可同步，不维护前端副本。</p>
        </div>
        <strong>{NOTES.length} 份文档</strong>
      </header>

      <div className="notes-browser-layout">
        <nav className="notes-index" aria-label="Week8 前端笔记">
          {NOTES.map((note) => (
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

        <article ref={articleRef} className="markdown-reader" key={active.id}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            skipHtml
            components={{
              table: ({ children }) => <div className="markdown-table"><table>{children}</table></div>,
              a: ({ href, children }) => {
                const external = href?.startsWith("http://") || href?.startsWith("https://");
                return external ? (
                  <a href={href} target="_blank" rel="noreferrer">{children}</a>
                ) : (
                  <span className="markdown-local-link" title={href}>{children}</span>
                );
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
      </div>
    </section>
  );
}
