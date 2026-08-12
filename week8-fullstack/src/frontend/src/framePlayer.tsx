// 逐帧播放器：展板里所有「按顺序发生的事」共用的时间轴控件。
//
// 起点是 W5 的 D4 数据流组（知识点 4/5/6）：把静态卡片换成可播放/可暂停/可单步的
// 帧序列后，用户第一次能停在「timer 已到期但 callback 还没执行」这类中间状态上。
// 这个能力此前只存在于 W5Board.tsx 内部，其余板（认证、OAuth2、W3、W6）各自手写了
// 一套「上一步 / 下一步」，既没有播放和重放，也没有逐帧解说。这里抽出来统一。
//
// 抽象边界：只抽「时间轴 + 控件 + 解说」这三件确定重复的东西，不抽图形 DSL——
// 每个专题的舞台长什么样仍由各自组件决定。
import { useEffect, useRef, useState, type ReactNode } from "react";

/** 是否偏好减少动效。脚本动画用 JS 定时推进，CSS 的 prefers-reduced-motion 管不到。 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

export interface FramePlayerOptions {
  /** 每帧停留毫秒数。 */
  interval?: number;
  /**
   * 按帧给停留时间。用于每帧信息量差别大的板：统一间隔要么让短帧拖沓，
   * 要么让长帧在读完之前就翻页。不传则退回固定 interval，其余板行为不变。
   */
  intervalAt?: (index: number) => number;
  /** 播到末帧后是否回到第 0 帧继续。 */
  loop?: boolean;
  /** 是否自动开始播放；reduced-motion 下一律不自动播放。 */
  autoPlay?: boolean;
}

/**
 * 帧序列播放器。用 JS 定时器推进而非纯 CSS，动画因此可暂停、可逐帧检查——
 * 对「理解某一步发生了什么」比自动跑完更有用。
 */
export function useFramePlayer(length: number, opts?: FramePlayerOptions) {
  const interval = opts?.interval ?? 850;
  const loop = opts?.loop ?? false;
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => (opts?.autoPlay ?? true) && !reduced);

  // 帧数会随路径切换变化（例如认证链按 401/403/200 停在不同长度）。
  // 长度缩短后必须夹住 index，否则会读到 undefined 帧。
  const lastLength = useRef(length);
  useEffect(() => {
    if (lastLength.current === length) return;
    lastLength.current = length;
    setIndex((i) => Math.min(i, Math.max(0, length - 1)));
  }, [length]);

  // 放进 ref：调用方几乎都会传内联箭头函数，直接进依赖会让效果每次渲染都重建定时器，
  // 逐帧推进就再也触发不了。
  const intervalAtRef = useRef(opts?.intervalAt);
  intervalAtRef.current = opts?.intervalAt;
  const variable = !!opts?.intervalAt;

  const advance = () =>
    setIndex((i) => {
      if (i + 1 >= length) {
        if (loop) return 0;
        setPlaying(false);
        return i;
      }
      return i + 1;
    });

  useEffect(() => {
    if (!playing || length <= 1) return;
    // 变间隔用 setTimeout 逐帧重排；固定间隔保持原来的 setInterval 路径不动。
    if (variable) {
      const id = window.setTimeout(advance, intervalAtRef.current?.(index) ?? interval);
      return () => window.clearTimeout(id);
    }
    const id = window.setInterval(advance, interval);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- advance 只读 length/loop，二者已在依赖里
  }, [playing, length, interval, loop, variable, index]);

  const replay = () => {
    setIndex(0);
    setPlaying(!reduced);
  };
  const toggle = () => {
    if (index >= length - 1 && !loop) {
      setIndex(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };
  const step = (delta: number) => {
    setPlaying(false);
    setIndex((i) => Math.max(0, Math.min(length - 1, i + delta)));
  };
  /** 跳到指定帧（步骤轨道点击）。手动定位一律停止自动播放。 */
  const seek = (next: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(length - 1, next)));
  };
  return { index, playing, setIndex, seek, replay, toggle, step };
}

export type FramePlayer = ReturnType<typeof useFramePlayer>;

/** 统一的播放控件：上一步 / 播放·暂停 / 下一步 / 进度 / 重放。 */
export function FrameTransport({
  player,
  length,
  label,
}: {
  player: FramePlayer;
  length: number;
  label?: ReactNode;
}) {
  return (
    <div className="fp-transport">
      {label ? <span className="fp-transport-label">{label}</span> : null}
      <div className="fp-transport-ctrl">
        <button type="button" onClick={() => player.step(-1)} aria-label="上一步" disabled={player.index === 0}>
          ‹
        </button>
        <button
          type="button"
          className="play"
          onClick={player.toggle}
          aria-label={player.playing ? "暂停" : "播放"}
        >
          {player.playing ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          onClick={() => player.step(1)}
          aria-label="下一步"
          disabled={player.index >= length - 1}
        >
          ›
        </button>
        <span className="fp-transport-count">
          {player.index + 1} / {length}
        </span>
        <button type="button" className="fp-replay" onClick={player.replay}>
          ↺ 重放
        </button>
      </div>
    </div>
  );
}

/**
 * 逐帧解说。这是 role="status" 而不是普通段落：自动播放时画面在变，
 * 屏幕阅读器用户需要被告知「刚发生了什么」，否则整个动画对他们是静默的。
 */
export function FrameNarration({
  step,
  text,
  tone,
}: {
  step?: number;
  text: ReactNode;
  tone?: string;
}) {
  return (
    <p className={`fp-narration${tone ? ` ${tone}` : ""}`} role="status">
      {step !== undefined && <b>{step}</b>}
      <span>{text}</span>
    </p>
  );
}
