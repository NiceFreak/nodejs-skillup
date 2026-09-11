import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AE_TOPICS } from "./aiEngineerTopics";
import { NOTE_GROUPS, NOTES, noteHref, noteReturnHref } from "./noteSources";
import type { NoteReturnTarget, NoteSource } from "./noteSources";
import type { BoardMode } from "./types";

interface TocItem {
  id: string;
  section: string;
  baseSection: string;
  slug: string;
  label: string;
  level: 2 | 3;
}

const NOTE_LIST: readonly NoteSource[] = NOTES;
const NOTE_BY_REPO_PATH = new Map<string, NoteSource>(NOTE_LIST.map((note) => [note.repoPath, note]));

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

function hrefFragment(href: string): string | undefined {
  const fragment = href.split("#", 2)[1];
  if (!fragment) return undefined;
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

function headingSlug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function headingSection(label: string): string {
  return label.match(/^(\d+(?:\.\d+)*)\.?($|\s)/)?.[1] ?? headingSlug(label);
}

function keepVisible(container: HTMLElement | null, item: HTMLElement | null) {
  if (!container || !item) return;
  const viewport = container.getBoundingClientRect();
  const target = item.getBoundingClientRect();
  if (target.top < viewport.top) container.scrollTop -= viewport.top - target.top;
  else if (target.bottom > viewport.bottom) container.scrollTop += target.bottom - viewport.bottom;
}

export default function MarkdownNotes({
  mode,
  topic,
  section,
  onTopicChange,
  onSectionChange,
  onSectionReplace,
  returnTarget,
}: {
  mode: BoardMode;
  topic: string | null;
  section: string | null;
  onTopicChange: (id: string) => void;
  onSectionChange: (section: string | null) => void;
  onSectionReplace: (noteId: string, section: string | null) => void;
  returnTarget: NoteReturnTarget | null;
}) {
  // 展示状态只列不带 reviewOnly 的；复习状态全列。
  const visible = mode === "review" ? NOTE_LIST : NOTE_LIST.filter((note) => !note.reviewOnly);
  const requested = NOTE_LIST.find((note) => note.id === topic);
  // 深链指向一份只在复习状态的笔记、而当前是展示状态：给一句明确提示，
  // 而不是悄悄换成另一篇——后者会让人以为链接坏了或内容变了。
  const blocked = mode !== "review" && requested?.reviewOnly ? requested : null;
  const active = (blocked ? null : visible.find((note) => note.id === topic)) ?? visible[0];
  const returnTopic = returnTarget && (returnTarget.tab === "ai-w12" || returnTarget.tab === "ai-w13" || returnTarget.tab === "ai-engineer")
    ? AE_TOPICS.find((item) => item.id === returnTarget.topic)
    : undefined;
  const safeReturnTarget = returnTopic && returnTarget ? returnTarget : undefined;
  const articleRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLElement>(null);
  const indexScrollRef = useRef<HTMLElement>(null);
  const tocScrollRef = useRef<HTMLElement>(null);
  const activeSectionRef = useRef<string | null>(null);
  const onSectionReplaceRef = useRef(onSectionReplace);
  onSectionReplaceRef.current = onSectionReplace;
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [noteQuery, setNoteQuery] = useState("");
  const [revealedTopic, setRevealedTopic] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sectionNotice, setSectionNotice] = useState<string | null>(null);
  const contentVisible = mode === "demo" || revealedTopic === active.id;
  const activeTocItem = toc.find((item) => item.id === activeSection);
  const normalizedQuery = noteQuery.trim().toLocaleLowerCase("zh-CN");
  const filteredVisible = normalizedQuery
    ? visible.filter((note) => `${note.label} ${note.description} ${note.group}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery))
    : visible;

  // 切笔记或从复习门后揭示时才去拉正文。alive 标志防止快速连点时旧的 promise 后到、
  // 把上一篇的内容盖到当前这篇上。
  useEffect(() => {
    if (blocked || !contentVisible) {
      setText(null);
      setLoadError(null);
      return;
    }
    let alive = true;
    setText(null);
    setLoadError(null);
    setToc([]);
    setSectionNotice(null);
    void active.load().then(
      (body) => {
        if (alive) setText(body);
      },
      () => {
        if (alive) setLoadError(`无法载入 ${active.label}。请刷新页面后重试。`);
      },
    );
    return () => {
      alive = false;
    };
  }, [active, blocked, contentVisible]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const article = articleRef.current;
    if (!article) return;

    const headings = Array.from(article.querySelectorAll<HTMLHeadingElement>("h2, h3"));
    const keyCounts = new Map<string, number>();
    const nextToc = headings.map((heading, index) => {
      const label = heading.textContent?.trim() || `章节 ${index + 1}`;
      const sectionKey = headingSection(label);
      const duplicateIndex = (keyCounts.get(sectionKey) ?? 0) + 1;
      keyCounts.set(sectionKey, duplicateIndex);
      const uniqueKey = duplicateIndex === 1 ? sectionKey : `${sectionKey}~${duplicateIndex}`;
      const slug = headingSlug(label);
      const id = `note-${active.id}-section-${encodeURIComponent(uniqueKey)}`;
      heading.id = id;
      heading.dataset.noteSection = uniqueKey;
      heading.dataset.noteSectionBase = sectionKey;
      heading.dataset.noteSlug = slug;
      return {
        id,
        section: uniqueKey,
        baseSection: sectionKey,
        slug,
        label,
        level: heading.tagName === "H2" ? 2 : 3,
      } satisfies TocItem;
    });

    setToc(nextToc);
    const requested = section
      ? nextToc.find((item) => item.section === section || item.slug === section)
      : null;
    const initialSection = requested?.id ?? nextToc[0]?.id ?? null;
    activeSectionRef.current = initialSection;
    setActiveSection(initialSection);
    if (section && !requested) {
      setSectionNotice(`未找到章节 ${section}，已停在文首。`);
    } else {
      setSectionNotice(null);
      requested && document.getElementById(requested.id)?.scrollIntoView({ block: "start", behavior: "auto" });
    }

    let frame = 0;
    let setupFrame = 0;
    let settleFrame = 0;
    function updateActiveSection() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const toolbarBottom = toolbarRef.current?.getBoundingClientRect().bottom ?? 108;
        // 章节判定与 CSS 的 scroll-margin 使用同一条线；不同断点下工具栏高度与留白都会变，
        // 固定像素会让深链已经露出目标标题时仍误记为上一节并覆盖 URL。
        const anchorOffset = headings[0]
          ? Number.parseFloat(window.getComputedStyle(headings[0]).scrollMarginTop)
          : 0;
        const activationLine = Math.max(
          toolbarBottom + 12,
          Number.isFinite(anchorOffset) ? anchorOffset + 1 : 0,
        );
        const current = headings.reduce<HTMLHeadingElement | null>((match, heading) => (
          heading.getBoundingClientRect().top <= activationLine ? heading : match
        ), null) ?? headings[0];
        const currentId = current?.id ?? null;
        if (currentId !== activeSectionRef.current) {
          activeSectionRef.current = currentId;
          setActiveSection(currentId);
          const currentItem = nextToc.find((item) => item.id === currentId);
          onSectionReplaceRef.current(active.id, currentItem?.section ?? null);
        }
        frame = 0;
      });
    }

    // Markdown 首帧还会发生字体与表格布局；让 URL 目标先稳定两帧，再交给 scroll spy。
    // 否则监听器可能按中间位置把精确深链改写成上一节，之后又没有滚动事件来纠正。
    settleFrame = window.requestAnimationFrame(() => {
      setupFrame = window.requestAnimationFrame(() => {
        window.addEventListener("scroll", updateActiveSection, { passive: true });
      });
    });
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      if (frame) window.cancelAnimationFrame(frame);
      if (setupFrame) window.cancelAnimationFrame(setupFrame);
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
    };
  }, [active.id, contentVisible, section, text]);

  useLayoutEffect(() => {
    if (blocked) return;
    const item = Array.from(indexScrollRef.current?.querySelectorAll<HTMLElement>("[data-note-id]") ?? [])
      .find((element) => element.dataset.noteId === active.id) ?? null;
    keepVisible(indexScrollRef.current, item);
  }, [active.id, blocked, filteredVisible.length]);

  useLayoutEffect(() => {
    const item = Array.from(tocScrollRef.current?.querySelectorAll<HTMLElement>("[data-section-id]") ?? [])
      .find((element) => element.dataset.sectionId === activeSection) ?? null;
    keepVisible(tocScrollRef.current, item);
  }, [activeSection]);

  function jumpToSection(item: TocItem) {
    onSectionChange(item.section);
    document.getElementById(item.id)?.scrollIntoView({ block: "start", behavior: "auto" });
  }

  return (
    <section className={`notes-browser${safeReturnTarget ? " has-return" : ""}`}>
      <header className="notes-browser-head">
        <div>
          <span>仓库原文速览</span>
          <h2>学习笔记</h2>
          <p>直接读取现有 Markdown 源文件；更新笔记后重新构建即可同步，不维护前端副本。</p>
        </div>
        <strong>{visible.length} 份文档</strong>
      </header>

      <nav ref={toolbarRef} className="notes-reader-toolbar" aria-label="阅读导航">
        {safeReturnTarget && returnTopic && (
          <div className="notes-reader-return">
            <a
              className="notes-return"
              href={noteReturnHref(safeReturnTarget, mode)}
              data-return-tab={safeReturnTarget.tab}
              data-return-topic={safeReturnTarget.topic}
            >
              <span aria-hidden="true">←</span>
              返回 AI 工程专题：{returnTopic.title}
            </a>
          </div>
        )}
        <div className="notes-reader-current">
          <span>当前笔记</span>
          <strong>{blocked?.label ?? active.label}</strong>
          <small>{activeTocItem?.label ?? (contentVisible ? "正在读取章节" : "正文尚未展开")}</small>
        </div>

        <label className="notes-toolbar-picker notes-toolbar-note-picker">
          <span>笔记目录</span>
          <select
            value={blocked ? "" : active.id}
            onChange={(event) => onTopicChange(event.target.value)}
          >
            {blocked && <option value="">{blocked.label}（只在复习状态）</option>}
            {NOTE_GROUPS.map((group) => {
              const notes = visible.filter((note) => note.group === group);
              return notes.length > 0 ? (
                <optgroup key={group} label={group}>
                  {notes.map((note) => <option key={note.id} value={note.id}>{note.label}</option>)}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>

        <label className="notes-toolbar-picker notes-toolbar-section-picker">
          <span>章节导航</span>
          <select
            value={activeSection ?? ""}
            disabled={toc.length === 0}
            onChange={(event) => {
              const item = toc.find((candidate) => candidate.id === event.target.value);
              if (item) jumpToSection(item);
            }}
          >
            {toc.length === 0 && <option value="">暂无章节</option>}
            {toc.map((item) => (
              <option key={item.id} value={item.id}>{item.level === 3 ? `  ${item.label}` : item.label}</option>
            ))}
          </select>
        </label>
      </nav>

      <div className="notes-browser-layout">
        <aside className="notes-index-rail" aria-label="笔记目录">
          <header className="notes-rail-head">
            <div>
              <strong>笔记目录</strong>
              <span>{filteredVisible.length} / {visible.length}</span>
            </div>
            <label className="notes-filter">
              <span>筛选笔记</span>
              <input
                type="search"
                value={noteQuery}
                placeholder="标题、说明或分组"
                onChange={(event) => setNoteQuery(event.target.value)}
              />
            </label>
          </header>

          <nav ref={indexScrollRef} className="notes-index" aria-label="全部学习笔记" tabIndex={0}>
            {NOTE_GROUPS.map((group) => {
              const notes = filteredVisible.filter((note) => note.group === group);
              return notes.length > 0 ? (
                <section key={group} className="notes-index-group" data-note-group={group}>
                  <h3>{group}</h3>
                  {notes.map((note) => (
                    <a
                      key={note.id}
                      href={noteHref({ noteId: note.id }, mode, safeReturnTarget)}
                      data-note-id={note.id}
                      className={!blocked && note.id === active.id ? "on" : ""}
                      aria-current={!blocked && note.id === active.id ? "page" : undefined}
                    >
                      <strong>{note.label}</strong>
                      <span>{note.description}</span>
                    </a>
                  ))}
                </section>
              ) : null;
            })}
            {filteredVisible.length === 0 && <p className="notes-filter-empty">没有匹配的笔记</p>}
          </nav>
        </aside>

        {blocked ? (
          <section className="notes-recall">
            <span>{blocked.label} · 只在复习状态</span>
            <h3>{blocked.repoPath.startsWith("interview-prep/") ? "这是个人面试材料" : blocked.restrictionNote ? "这份笔记属于复习材料" : "这份笔记写的是一台在跑的服务器"}</h3>
            <p>
              {blocked.restrictionNote ?? (blocked.repoPath.startsWith("interview-prep/")
                ? "自评、答法骨架与未收口的部分都在里面，和「面试准备」板同一条口径：不进对外展示。"
                : "公网 IP、端口、systemd 单元行为与排障判据都在里面，和「部署上线」板同一条口径：不进对外展示。")}
              切到复习状态即可打开。
            </p>
          </section>
        ) : !contentVisible ? (
          <section className="notes-recall">
            <span>{active.label} · 阅读前回忆</span>
            <h3>{active.description}</h3>
            <p>先不打开原文，口述这份文档解决的核心问题、一个判断规则，以及一条证据或适用边界。</p>
            <button type="button" onClick={() => setRevealedTopic(active.id)}>
              {section ? "展开并定位目标章节" : "展开原文核对"}
            </button>
          </section>
        ) : (
          <>
            {loadError ? (
              <p className="notes-loading notes-load-error" role="alert">{loadError}</p>
            ) : text === null ? (
              <p className="notes-loading">正在载入 {active.label}…</p>
            ) : (
            <article ref={articleRef} className="markdown-reader" key={active.id}>
              {sectionNotice && <p className="notes-section-notice" role="status">{sectionNotice}</p>}
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
                    // 页内锚点不能直接写 window.hash：本应用的 hash 本身承担路由。
                    if (href.startsWith("#")) {
                      const targetSection = hrefFragment(href) ?? "";
                      const target = toc.find((item) => item.section === targetSection || item.slug === targetSection);
                      return (
                        <a
                          href={noteHref({ noteId: active.id, section: targetSection }, mode, safeReturnTarget)}
                          className="markdown-note-link"
                          onClick={(event) => {
                            event.preventDefault();
                            if (target) jumpToSection(target);
                            else onSectionChange(targetSection);
                          }}
                        >
                          {children}
                        </a>
                      );
                    }
                    // 先按当前文档目录解析完整仓库路径；basename 重名不能作为跳转依据。
                    const repoPath = resolveRepoPath(active.repoPath, href);
                    const targetNote = NOTE_BY_REPO_PATH.get(repoPath);
                    if (targetNote) {
                      const targetSection = hrefFragment(href);
                      return (
                        <a
                          href={noteHref(
                            { noteId: targetNote.id, section: targetSection },
                            mode,
                            safeReturnTarget,
                          )}
                          className="markdown-note-link"
                        >
                          {children}
                        </a>
                      );
                    }
                    // 其它本地路径（代码、目录）→ 指向 GitHub 上可浏览的地址，替代原先点不动的灰字。
                    const suffix = href.match(/[?#].*$/)?.[0] ?? "";
                    const gh = `${REPO_BLOB_BASE}/${repoPath}${suffix}`;
                    return <a href={gh} target="_blank" rel="noreferrer" title={href}>{children}</a>;
                  },
                }}
              >
                {text}
              </ReactMarkdown>
            </article>
            )}

            <aside className="notes-toc-rail" aria-label={`${active.label}章节导航`}>
              <header className="notes-rail-head">
                <div><strong>章节导航</strong><span>{toc.length} 节</span></div>
              </header>
              <nav ref={tocScrollRef} className="notes-toc" aria-label={`${active.label}全部章节`} tabIndex={0}>
                {toc.length > 0 ? (
                <ol>
                  {toc.map((item) => (
                    <li key={item.id} className={`level-${item.level}`}>
                      <a
                        href={noteHref(
                          { noteId: active.id, section: item.section },
                          mode,
                          safeReturnTarget,
                        )}
                        data-note-section={item.section}
                        data-section-id={item.id}
                        className={activeSection === item.id ? "on" : ""}
                        aria-current={activeSection === item.id ? "location" : undefined}
                        onClick={(event) => {
                          event.preventDefault();
                          jumpToSection(item);
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
              </nav>
            </aside>
          </>
        )}
      </div>
    </section>
  );
}
