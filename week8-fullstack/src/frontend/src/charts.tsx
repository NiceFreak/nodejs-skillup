// 纯 SVG 图表组件（无第三方依赖）。
// 规格对照 dataviz 方法：细 mark（柱 ≤24px、数据端 4px 圆角、基线方角）、
// 1px 实线浅灰网格、坐标轴文字用 muted 墨色、单系列不放图例、
// hover 提供 tooltip 且命中区大于 mark、每张图配表格视图（在 Dashboard 层切换）。
import { useMemo, useRef, useState, type ReactNode } from "react";

// ---- 共用：tooltip 状态与容器 ----

interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

// [React] 自定义 Hook：以 use 开头、内部使用其他 Hook 的普通函数，
// 把「tooltip 状态 + 容器 ref + 显示/隐藏」打包复用给两个图表组件。
function useTooltip() {
  // [React] useState<T> 显式传入泛型参数：初始值是 null，若不写 <TipState | null>
  // TS 会把状态推断成只能是 null。
  const [tip, setTip] = useState<TipState | null>(null);
  // [React] useRef 拿真实 DOM：渲染后 .current 指向该 div，用于计算 tooltip 相对坐标
  const wrapRef = useRef<HTMLDivElement>(null);

  function show(evt: { clientX: number; clientY: number }, content: ReactNode) {
    // [ES2020] ?. 可选链：current 为 null（尚未挂载）时短路返回 undefined，不抛错
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top, content });
  }
  const hide = () => setTip(null);
  return { tip, wrapRef, show, hide };
}

function TooltipBox({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return (
    <div
      className="chart-tooltip"
      style={{ left: Math.max(4, tip.x + 12), top: Math.max(4, tip.y - 8) }}
    >
      {tip.content}
    </div>
  );
}

// ---- 共用：刻度取整 ----

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const rawStep = max / count;
  // [ES2016] ** 幂运算符：10 ** n 等价于 Math.pow(10, n)
  const pow = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rawStep) ?? rawStep;
  const ticks: number[] = [];
  // 最后一格必须 ≥ max，否则最大值的柱子会超出绘图区
  for (let v = 0; v < max + step; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export const fmtMoney = (v: number): string =>
  v >= 10000 ? `${(v / 10000).toFixed(v % 10000 === 0 ? 0 : 1)}万` : v.toLocaleString("zh-CN");

// 顶部 4px 圆角、基线方角的柱形 path（数据端圆角，基线端方角）
function roundedTopRect(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, w / 2, h);
  return [
    `M${x},${y + h}`,
    `L${x},${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `L${x + w - rr},${y}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `L${x + w},${y + h}`,
    "Z",
  ].join(" ");
}

// ---- 柱状图（月度趋势）----

export interface ColumnDatum {
  label: string; // x 轴短标签，如 "2月"
  value: number;
  detail: ReactNode; // tooltip 内容
}

export function ColumnChart({
  data,
  valueFormat = fmtMoney,
  height = 240,
}: {
  data: ColumnDatum[];
  valueFormat?: (v: number) => string;
  height?: number;
}) {
  const { tip, wrapRef, show, hide } = useTooltip();
  const [hover, setHover] = useState<number | null>(null);

  const width = 640;
  const pad = { top: 18, right: 12, bottom: 28, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // [ES2015] 展开运算符把数组摊开成参数列表：Math.max(1, v1, v2, …)
  const max = Math.max(1, ...data.map((d) => d.value));
  // [React] useMemo：依赖 [max] 不变时复用上次计算结果，避免每次渲染重算刻度
  const ticks = useMemo(() => niceTicks(max), [max]);
  const scaleMax = ticks[ticks.length - 1];
  const y = (v: number) => pad.top + plotH - (v / scaleMax) * plotH;

  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.6);
  // reduce 求最大值下标：累积值 mi 是「当前最大元素的 index」，比先 map 再 indexOf 少一次遍历
  const maxIdx = data.reduce((mi, d, i) => (d.value > data[mi].value ? i : mi), 0);

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="柱状图">
        {/* 网格：1px 实线，贴近底色的浅灰 */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
              className={t === 0 ? "axis-line" : "grid-line"}
            />
            <text x={pad.left - 8} y={y(t) + 4} className="tick-text" textAnchor="end">
              {valueFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.left + band * i + band / 2;
          const barH = Math.max(0, pad.top + plotH - y(d.value));
          return (
            <g key={d.label}>
              {/* 命中区：整个 band，比 mark 宽 */}
              <rect
                x={pad.left + band * i}
                y={pad.top}
                width={band}
                height={plotH}
                fill="transparent"
                onPointerMove={(e) => {
                  setHover(i);
                  show(e, d.detail);
                }}
                onPointerLeave={() => {
                  setHover(null);
                  hide();
                }}
              />
              {d.value > 0 && (
                <path
                  d={roundedTopRect(cx - barW / 2, y(d.value), barW, barH)}
                  className="series-fill"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                  pointerEvents="none"
                />
              )}
              {/* 选择性直标：只标最大值 */}
              {i === maxIdx && d.value > 0 && (
                <text x={cx} y={y(d.value) - 6} className="value-text" textAnchor="middle">
                  {valueFormat(d.value)}
                </text>
              )}
              <text x={cx} y={height - 8} className="tick-text" textAnchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <TooltipBox tip={tip} />
    </div>
  );
}

// ---- 水平条形图（客户消费 Top N）----

export interface HBarDatum {
  label: string;
  value: number;
  detail: ReactNode;
}

export function HBarChart({
  data,
  valueFormat = fmtMoney,
}: {
  data: HBarDatum[];
  valueFormat?: (v: number) => string;
}) {
  const { tip, wrapRef, show, hide } = useTooltip();
  const [hover, setHover] = useState<number | null>(null);

  const width = 640;
  const rowH = 34;
  const pad = { top: 8, right: 64, bottom: 8, left: 120 };
  const height = pad.top + pad.bottom + rowH * Math.max(1, data.length);
  const plotW = width - pad.left - pad.right;

  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (v: number) => (v / max) * plotW;
  const barH = 18;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="条形图">
        <line
          x1={pad.left}
          x2={pad.left}
          y1={pad.top}
          y2={height - pad.bottom}
          className="axis-line"
        />
        {data.map((d, i) => {
          const cy = pad.top + rowH * i + rowH / 2;
          const w = Math.max(0, x(d.value));
          // 数据端（右侧）4px 圆角，基线端方角：复用竖版 path 旋转思路，直接画横版
          const r = Math.min(4, w, barH / 2);
          const path = [
            `M${pad.left},${cy - barH / 2}`,
            `L${pad.left + w - r},${cy - barH / 2}`,
            `Q${pad.left + w},${cy - barH / 2} ${pad.left + w},${cy - barH / 2 + r}`,
            `L${pad.left + w},${cy + barH / 2 - r}`,
            `Q${pad.left + w},${cy + barH / 2} ${pad.left + w - r},${cy + barH / 2}`,
            `L${pad.left},${cy + barH / 2}`,
            "Z",
          ].join(" ");
          return (
            <g key={d.label + i}>
              <rect
                x={0}
                y={pad.top + rowH * i}
                width={width}
                height={rowH}
                fill="transparent"
                onPointerMove={(e) => {
                  setHover(i);
                  show(e, d.detail);
                }}
                onPointerLeave={() => {
                  setHover(null);
                  hide();
                }}
              />
              <text
                x={pad.left - 8}
                y={cy + 4}
                className="tick-text"
                textAnchor="end"
              >
                {d.label.length > 8 ? `${d.label.slice(0, 7)}…` : d.label}
              </text>
              {w > 0 && (
                <path
                  d={path}
                  className="series-fill"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                  pointerEvents="none"
                />
              )}
              {/* 条形图：值标在条端外侧 */}
              <text x={pad.left + w + 8} y={cy + 4} className="value-text" textAnchor="start">
                {valueFormat(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <TooltipBox tip={tip} />
    </div>
  );
}

// ---- 统计卡（KPI 行）----

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}
