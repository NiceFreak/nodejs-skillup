// W5「Node.js 底层理解展示板」（展示资产，AI 搭建维护）。
// 定位：把本人已跑出的现象/结论用 UI 呈现，做展示即复盘。静态、无动画、纯前端。
import { W5_TOPICS, type W5Status, type W5Topic } from "./w5Topics";

const STATUS_LABEL: Record<W5Status, string> = {
  done: "已完成",
  active: "进行中",
  planned: "未开始",
};

export default function W5Board() {
  return (
    <div className="w5-board">
      <p className="w5-intro">
        W5 学到的运行时判断，学到多少展示多少——做展示时相当于一次复盘。内容取自本人 D1/D2 实验笔记；
        D3–D5 待学到后补齐。
      </p>
      <div className="w5-grid">
        {W5_TOPICS.map((t) => (
          <TopicCard key={t.day} topic={t} />
        ))}
      </div>
    </div>
  );
}

function TopicCard({ topic }: { topic: W5Topic }) {
  const planned = topic.status === "planned";
  return (
    <section className={`w5-card ${topic.status}`}>
      <div className="w5-card-head">
        <span className="w5-day">{topic.day}</span>
        <strong>{topic.title}</strong>
        <span className={`w5-status ${topic.status}`}>{STATUS_LABEL[topic.status]}</span>
      </div>
      <p className="w5-focus">{topic.focus}</p>

      {planned ? (
        <p className="w5-planned">{topic.plannedNote}</p>
      ) : (
        <>
          <div className="w5-block">
            <h4>可观察证据</h4>
            <ul className="w5-ev">
              {topic.evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {topic.bars && (
              <div className="w5-bars">
                {topic.bars.map((b) => (
                  <div key={b.label} className="w5-bar">
                    <span className="w5-bar-label">{b.label}</span>
                    <span className="w5-bar-track">
                      <span
                        className={`w5-bar-fill ${b.tone}`}
                        style={{ width: `${Math.max(2, (b.value / b.max) * 100)}%` }}
                      />
                    </span>
                    <span className="w5-bar-val">
                      {b.value} {b.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {topic.plannedNote && <p className="w5-partial">未完成：{topic.plannedNote}</p>}
          </div>

          {topic.judgment && (
            <div className="w5-block">
              <h4>运行时判断</h4>
              <p>{topic.judgment}</p>
            </div>
          )}
        </>
      )}

      <div className="w5-map">
        <span>映射回 Week2–4</span>
        {topic.mapping}
      </div>
    </section>
  );
}
