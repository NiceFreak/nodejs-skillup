import type { BoardMode } from "./types";

export const NOTE_GROUPS = [
  "W12 核心链",
  "面试材料",
  "W1-W2 基础",
  "W6 测试",
  "展板资料",
  "W11 发布流水线",
  "W10 可观测性",
  "W9 部署上线",
] as const;

export type NoteGroup = (typeof NOTE_GROUPS)[number];

interface NoteSourceShape {
  id: string;
  group: NoteGroup;
  label: string;
  description: string;
  /** 每份正文独立动态导入，只有真正打开时才下载对应 chunk。 */
  load: () => Promise<string>;
  file: string;
  repoPath: string;
  reviewOnly?: boolean;
  restrictionNote?: string;
}

const W12_RESTRICTION = "这份 W12 学习记录包含执行过程、复盘或内部验收信息，不进入对外展示。";

export const NOTES = [
  // 原有 42 项保持原顺序，确保无 topic 时的默认文档不变。
  { id: "qa", group: "面试材料", label: "面试问答稿", description: "W1–W6 的 37 道题与答法骨架（配套「面试准备」板）", load: () => import("../../../../interview-prep/backend-qa-sheet.md?raw").then((m) => m.default), file: "backend-qa-sheet.md", repoPath: "interview-prep/backend-qa-sheet.md", reviewOnly: true },
  { id: "dbqa", group: "面试材料", label: "DB 自测稿", description: "MongoDB 聚合 / 索引 10 题自测（尚未过，过完可把 DB 调回强项）", load: () => import("../../../../interview-prep/db-review-sheet.md?raw").then((m) => m.default), file: "db-review-sheet.md", repoPath: "interview-prep/db-review-sheet.md", reviewOnly: true },
  { id: "w1model", group: "W1-W2 基础", label: "W1 数据建模", description: "嵌入 / 引用 / 快照的四个判断维度、订单系统三个决策与多对多中间表（配套数据库板知识点 1）", load: () => import("../../../../week1-mongodb/notes/day1-data-modeling.md?raw").then((m) => m.default), file: "day1-data-modeling.md", repoPath: "week1-mongodb/notes/day1-data-modeling.md" },
  { id: "w1index", group: "W1-W2 基础", label: "W1 索引与 explain", description: "COLLSCAN 基线、复合索引最左前缀三查询对照与覆盖查询正反验证（配套知识点 6、7）", load: () => import("../../../../week1-mongodb/notes/day2-3-index.md?raw").then((m) => m.default), file: "day2-3-index.md", repoPath: "week1-mongodb/notes/day2-3-index.md" },
  { id: "w1mongoose", group: "W1-W2 基础", label: "W1 Mongoose 入门", description: "Schema 校验与两层防线：应用层 ValidationError 与数据库层 E11000 的区别", load: () => import("../../../../week1-mongoose/notes/day2-4-mongoose.md?raw").then((m) => m.default), file: "day2-4-mongoose.md", repoPath: "week1-mongoose/notes/day2-4-mongoose.md" },
  { id: "w2d1", group: "W1-W2 基础", label: "W2 D1 · 中间件管道", description: "原生 http 到 Express、洋葱结构与 next() 铁律、res.on('finish') 计时点与错误处理", load: () => import("../../../../week2-express/notes/day1-node-server-and-express.md?raw").then((m) => m.default), file: "day1-node-server-and-express.md", repoPath: "week2-express/notes/day1-node-server-and-express.md" },
  { id: "w2d2", group: "W1-W2 基础", label: "W2 D2 · 分层架构", description: "四层职责、单向依赖的根据、一个端点穿四层与 400 / 404 落在哪一层", load: () => import("../../../../week2-express/notes/day2-express-layers.md?raw").then((m) => m.default), file: "day2-express-layers.md", repoPath: "week2-express/notes/day2-express-layers.md" },
  { id: "w2d3", group: "W1-W2 基础", label: "W2 D3 · 接真库与错误分层", description: "Mongoose 连接、Create 端点，以及「错误翻译发生在离它最近的那层」", load: () => import("../../../../week2-express/notes/day3-connect-mongodb.md?raw").then((m) => m.default), file: "day3-connect-mongodb.md", repoPath: "week2-express/notes/day3-connect-mongodb.md" },
  { id: "w2d4", group: "W1-W2 基础", label: "W2 D4 · 两条响应路径", description: "闭卷复盘暴露的两处偏差、优雅关闭顺序、校验中间件重构与字段白名单归属", load: () => import("../../../../week2-express/notes/day4-CRUD.md?raw").then((m) => m.default), file: "day4-CRUD.md", repoPath: "week2-express/notes/day4-CRUD.md" },
  { id: "w6model", group: "W6 测试", label: "W6 心智模型", description: "测试与 CI：从「本地能跑」到「每次 push 可独立验证」", load: () => import("../../../../week6-testing/notes/week6-testing-ci-mental-model.md?raw").then((m) => m.default), file: "week6-testing-ci-mental-model.md", repoPath: "week6-testing/notes/week6-testing-ci-mental-model.md" },
  { id: "readme", group: "展板资料", label: "项目说明", description: "运行方式、页面路径与验收动线", load: () => import("../../../README.md?raw").then((m) => m.default), file: "README.md", repoPath: "week8-fullstack/README.md" },
  { id: "features", group: "展板资料", label: "能力速查", description: "代码里已经使用的 ES、TS、React 与 CSS", load: () => import("../../../notes/frontend-features-cheatsheet.md?raw").then((m) => m.default), file: "frontend-features-cheatsheet.md", repoPath: "week8-fullstack/notes/frontend-features-cheatsheet.md" },
  { id: "hooks", group: "展板资料", label: "Hooks 面试", description: "从类组件迁移到 Hooks 的判断地图", load: () => import("../../../notes/react-hooks-interview-map.md?raw").then((m) => m.default), file: "react-hooks-interview-map.md", repoPath: "week8-fullstack/notes/react-hooks-interview-map.md" },
  { id: "toolbox", group: "展板资料", label: "前端工具箱", description: "状态、布局、测试与生态选型", load: () => import("../../../notes/frontend-toolbox.md?raw").then((m) => m.default), file: "frontend-toolbox.md", repoPath: "week8-fullstack/notes/frontend-toolbox.md" },
  { id: "legacy", group: "展板资料", label: "存量项目", description: "旧项目判断、迁移策略与面试叙事", load: () => import("../../../notes/legacy-projects-and-staying-current.md?raw").then((m) => m.default), file: "legacy-projects-and-staying-current.md", repoPath: "week8-fullstack/notes/legacy-projects-and-staying-current.md" },
  { id: "deploy", group: "展板资料", label: "部署链路", description: "展板怎么上线：零后端双仓发布链路（可视化）", load: () => import("../../../notes/deploy-pipeline.md?raw").then((m) => m.default), file: "deploy-pipeline.md", repoPath: "week8-fullstack/notes/deploy-pipeline.md" },
  { id: "w11d3", group: "W11 发布流水线", label: "W11 D3 · 部署段与凭据", description: "P1–P7 与 D1–D5 逐题作答、前置核对、十二步执行记录与两个收工点的验证结果（配套 ③⑤ 与 ⑥·3）", load: () => import("../../../../week11-ci/notes/day3-deploy-credentials.md?raw").then((m) => m.default), file: "day3-deploy-credentials.md", repoPath: "week11-ci/notes/day3-deploy-credentials.md", reviewOnly: true },
  { id: "w11d2", group: "W11 发布流水线", label: "W11 D2 · controller 与第一条流水线", description: "九步执行记录、P1–P6 执行期决策，与当天十四条计划外事件的全量核对（配套 ⑥·2）", load: () => import("../../../../week11-ci/notes/day2-controller-setup.md?raw").then((m) => m.default), file: "day2-controller-setup.md", repoPath: "week11-ci/notes/day2-controller-setup.md", reviewOnly: true },
  { id: "w11d1", group: "W11 发布流水线", label: "W11 D1 · 发布契约", description: "Q1–Q18 逐题作答、九对冲突自查与五张表：阶段划分、权限清单、回滚判据、部署后验证（配套 ⑥·1 与 ②）", load: () => import("../../../../week11-ci/notes/day1-release-contract.md?raw").then((m) => m.default), file: "day1-release-contract.md", repoPath: "week11-ci/notes/day1-release-contract.md", reviewOnly: true },
  { id: "w11freeze", group: "W11 发布流水线", label: "W11 D1 · 收口记录", description: "契约冻结当天的六条事实核对、只读基线摘要与预测偏差表", load: () => import("../../../../week11-ci/notes/day1-contract-freeze.md?raw").then((m) => m.default), file: "day1-contract-freeze.md", repoPath: "week11-ci/notes/day1-contract-freeze.md", reviewOnly: true },
  { id: "w11plan", group: "W11 发布流水线", label: "W11 周计划", description: "D1–D5 节奏、九处需要拍板的冲突与本周的安全边界（D1✓ D2✓ D3✓）", load: () => import("../../../../week11-ci/notes/week11-plan.md?raw").then((m) => m.default), file: "week11-plan.md", repoPath: "week11-ci/notes/week11-plan.md", reviewOnly: true },
  { id: "w11viz", group: "W11 发布流水线", label: "W11 展板方法", description: "这块板怎么建的：九块设计、每块的最早开工日，以及两次收口后的重估与编码表", load: () => import("../../../../week11-ci/notes/week11-visualization-plan.md?raw").then((m) => m.default), file: "week11-visualization-plan.md", repoPath: "week11-ci/notes/week11-visualization-plan.md", reviewOnly: true },
  { id: "w10run", group: "W10 可观测性", label: "W10 排障 Runbook", description: "三类故障各自的症状 / 首查 / 判定分叉 / 修复 / 预防，加通用首查、三条监控盲区与速查表（配套 ⑧）", load: () => import("../../../../week10-observability/notes/runbook.md?raw").then((m) => m.default), file: "runbook.md", repoPath: "week10-observability/notes/runbook.md", reviewOnly: true },
  { id: "w10d5", group: "W10 可观测性", label: "W10 D5 · 收口日", description: "runbook 成篇 + 隔天不看笔记盲测两类 + 取整判据改字节级 + 假 active 读码定论（机制未验证）", load: () => import("../../../../week10-observability/notes/day5-wrapup.md?raw").then((m) => m.default), file: "day5-wrapup.md", repoPath: "week10-observability/notes/day5-wrapup.md", reviewOnly: true },
  { id: "w10d4", group: "W10 可观测性", label: "W10 D4 · 故障演练", description: "三类故障真注入生产机：五段式记录、预测 vs 实测偏差归因、三个监控盲区与残留核零", load: () => import("../../../../week10-observability/notes/day4-fault-drills.md?raw").then((m) => m.default), file: "day4-fault-drills.md", repoPath: "week10-observability/notes/day4-fault-drills.md", reviewOnly: true },
  { id: "w10d3", group: "W10 可观测性", label: "W10 D3 · 监控与弄红", description: "四项判据翻成能自己跑的检查，再逐项弄红一次：P1–P5 五问、九项验证实测、timer 与「谁监控监控本身」", load: () => import("../../../../week10-observability/notes/day3-monitoring-alerting.md?raw").then((m) => m.default), file: "day3-monitoring-alerting.md", repoPath: "week10-observability/notes/day3-monitoring-alerting.md", reviewOnly: true },
  { id: "w10d2", group: "W10 可观测性", label: "W10 D2 · 日志上线", description: "变更单四要素 + 七项验证实测 vs 期望 + 执行期四条新增事实（含查询串凭据那条阻断）", load: () => import("../../../../week10-observability/notes/day2-logging-rollout.md?raw").then((m) => m.default), file: "day2-logging-rollout.md", repoPath: "week10-observability/notes/day2-logging-rollout.md", reviewOnly: true },
  { id: "w10d1", group: "W10 可观测性", label: "W10 D1 · 观测契约", description: "记什么、不记什么、谁来关联、什么算红、哪些故障可以真做——Q1–Q15 与冲突自查七对", load: () => import("../../../../week10-observability/notes/day1-observability-contract.md?raw").then((m) => m.default), file: "day1-observability-contract.md", repoPath: "week10-observability/notes/day1-observability-contract.md", reviewOnly: true },
  { id: "w10plan", group: "W10 可观测性", label: "W10 周计划", description: "D1–D5 节奏、演练三档安全边界与本周黑白名单判断（D1✓ D2✓ D3✓ D4✓）", load: () => import("../../../../week10-observability/notes/week10-plan.md?raw").then((m) => m.default), file: "week10-plan.md", repoPath: "week10-observability/notes/week10-plan.md", reviewOnly: true },
  { id: "w10viz", group: "W10 可观测性", label: "W10 展板方法", description: "这块板怎么建的：分块设计、contract 档位、口径边界总表与「先做的会先过时」的阶段顺序", load: () => import("../../../../week10-observability/notes/week10-visualization-plan.md?raw").then((m) => m.default), file: "week10-visualization-plan.md", repoPath: "week10-observability/notes/week10-visualization-plan.md", reviewOnly: true },
  { id: "w9roadmap", group: "W9 部署上线", label: "W9 浓缩地图", description: "全周 D1–D5 的目标拓扑、两张面表、32 条认知修正与白话对照表（§6.4 是 D5 收口）", load: () => import("../../../../week9-deployment/notes/week9-roadmap-d1-d4.md?raw").then((m) => m.default), file: "week9-roadmap-d1-d4.md", repoPath: "week9-deployment/notes/week9-roadmap-d1-d4.md", reviewOnly: true },
  { id: "w9d5", group: "W9 部署上线", label: "W9 D5 · 收口日", description: "冷启动自愈 + 信任边界复核 + 能力检验 8 处当场修正 + Q8 还债 + admin 迁 443 + 变更单思维", load: () => import("../../../../week9-deployment/notes/day5-rebuild-closeout.md?raw").then((m) => m.default), file: "day5-rebuild-closeout.md", repoPath: "week9-deployment/notes/day5-rebuild-closeout.md", reviewOnly: true },
  { id: "w9demo", group: "W9 部署上线", label: "W9 Demo 讲稿", description: "从本地到线上中间多出来的是什么：8 分钟动线、演示前自检与三条对外呈现边界", load: () => import("../../../../week9-deployment/notes/day5-demo-script.md?raw").then((m) => m.default), file: "day5-demo-script.md", repoPath: "week9-deployment/notes/day5-demo-script.md", reviewOnly: true },
  { id: "w9perm", group: "W9 部署上线", label: "W9 权限速查表", description: "服务器上「你是谁」决定「你能碰什么」：三种身份、属主表与 12 条坑族", load: () => import("../../../../week9-deployment/notes/server-permission-cheatsheet.md?raw").then((m) => m.default), file: "server-permission-cheatsheet.md", repoPath: "week9-deployment/notes/server-permission-cheatsheet.md", reviewOnly: true },
  { id: "w9d4c", group: "W9 部署上线", label: "W9 D4-c · 展板 8081", description: "学习展板独立部署 + 登录门禁 + 构建产物分目录；服务边界 vs 暴露边界的心智", load: () => import("../../../../week9-deployment/notes/day4c-showcase-gate-deploy.md?raw").then((m) => m.default), file: "day4c-showcase-gate-deploy.md", repoPath: "week9-deployment/notes/day4c-showcase-gate-deploy.md", reviewOnly: true },
  { id: "w9d4b", group: "W9 部署上线", label: "W9 D4-b · 收敛与 HTTPS", description: "段 0 URL 面收敛（Q0–Q8）+ 8080 管理后台（A1–A9）+ D4-HTTPS 冻结与执行（H1–H4）", load: () => import("../../../../week9-deployment/notes/day4b-https-and-admin-plan.md?raw").then((m) => m.default), file: "day4b-https-and-admin-plan.md", repoPath: "week9-deployment/notes/day4b-https-and-admin-plan.md", reviewOnly: true },
  { id: "w9d4", group: "W9 部署上线", label: "W9 D4 · 反代", description: "Nginx 反代 + ufw 80 + 凭据轮换；附 Nginx 解决什么问题的概念问答", load: () => import("../../../../week9-deployment/notes/day4-http-reverse-proxy.md?raw").then((m) => m.default), file: "day4-http-reverse-proxy.md", repoPath: "week9-deployment/notes/day4-http-reverse-proxy.md", reviewOnly: true },
  { id: "w9d3", group: "W9 部署上线", label: "W9 D3 · 数据库", description: "MongoDB 接通 + 阶段 B 五项（seed / 端到端 / 重启 / 故障注入 / RSS）", load: () => import("../../../../week9-deployment/notes/day3-finish-d2-and-db.md?raw").then((m) => m.default), file: "day3-finish-d2-and-db.md", repoPath: "week9-deployment/notes/day3-finish-d2-and-db.md", reviewOnly: true },
  { id: "w9d2", group: "W9 部署上线", label: "W9 D2 · 主机", description: "最小权限用户、SSH 与 ufw、Node 运行时、systemd 七条契约", load: () => import("../../../../week9-deployment/notes/day2-host-and-node-service.md?raw").then((m) => m.default), file: "day2-host-and-node-service.md", repoPath: "week9-deployment/notes/day2-host-and-node-service.md", reviewOnly: true },
  { id: "w9d1", group: "W9 部署上线", label: "W9 D1 · 契约", description: "开工前讲死的边界：验收接口、端口表、失败路径、进程守护选型", load: () => import("../../../../week9-deployment/notes/day1-contract-freeze.md?raw").then((m) => m.default), file: "day1-contract-freeze.md", repoPath: "week9-deployment/notes/day1-contract-freeze.md", reviewOnly: true },
  { id: "w9plan", group: "W9 部署上线", label: "W9 周计划", description: "D1–D5 五天的目标、时间盒与勾选状态（全周已收口）", load: () => import("../../../../week9-deployment/notes/week9-plan.md?raw").then((m) => m.default), file: "week9-plan.md", repoPath: "week9-deployment/notes/week9-plan.md", reviewOnly: true },
  { id: "w9viz", group: "W9 部署上线", label: "W9 展板方法", description: "这块板怎么建的：板块设计、口径边界总表与逐块执行记录", load: () => import("../../../../week9-deployment/notes/week9-visualization-plan.md?raw").then((m) => m.default), file: "week9-visualization-plan.md", repoPath: "week9-deployment/notes/week9-visualization-plan.md", reviewOnly: true },

  // W12 核心链：三份中性技术材料进入展示状态，其余执行/复盘材料只在复习状态打开。
  { id: "w12concept", group: "W12 核心链", label: "W12 概念地图", description: "五个学习对象、当前已识别的连接关系、Bub 的位置与开放边界", load: () => import("../../../../week12-python-rag/notes/w12-concept-map.md?raw").then((m) => m.default), file: "w12-concept-map.md", repoPath: "week12-python-rag/notes/w12-concept-map.md" },
  { id: "w12bub", group: "W12 核心链", label: "W12 Bub 阅读报告", description: "turn 生命周期、tape 到 context，以及 model、tool、harness 的职责边界", load: () => import("../../../../week12-python-rag/notes/bub-reading-report.md?raw").then((m) => m.default), file: "bub-reading-report.md", repoPath: "week12-python-rag/notes/bub-reading-report.md" },
  { id: "w12demo", group: "W12 核心链", label: "W12 Demo 讲稿", description: "一次 tool call 为什么不等于 Agent：职责、step 循环与 context 重建", load: () => import("../../../../week12-python-rag/notes/week12-demo-script.md?raw").then((m) => m.default), file: "week12-demo-script.md", repoPath: "week12-python-rag/notes/week12-demo-script.md" },
  { id: "w12d2", group: "W12 核心链", label: "W12 D2 · 基线与迁移增量", description: "决策冻结、Python 项目基线与六个 TypeScript 到 Python 迁移单元", load: () => import("../../../../week12-python-rag/notes/day2-freeze-and-baseline.md?raw").then((m) => m.default), file: "day2-freeze-and-baseline.md", repoPath: "week12-python-rag/notes/day2-freeze-and-baseline.md", reviewOnly: true, restrictionNote: W12_RESTRICTION },
  { id: "w12d3", group: "W12 核心链", label: "W12 D3 · Bub 主链", description: "Bub 入口、对象创建与 turn、tape、context、职责三条主链的阅读记录", load: () => import("../../../../week12-python-rag/notes/day3-bub-main-chain.md?raw").then((m) => m.default), file: "day3-bub-main-chain.md", repoPath: "week12-python-rag/notes/day3-bub-main-chain.md", reviewOnly: true, restrictionNote: W12_RESTRICTION },
  { id: "w12d4", group: "W12 核心链", label: "W12 D4 · 异步与真实调用", description: "异步迁移、真实模型与工具调用、timeout、cancellation 和资源清理实验", load: () => import("../../../../week12-python-rag/notes/day4-async-and-real-calls.md?raw").then((m) => m.default), file: "day4-async-and-real-calls.md", repoPath: "week12-python-rag/notes/day4-async-and-real-calls.md", reviewOnly: true, restrictionNote: W12_RESTRICTION },
  { id: "w12d5", group: "W12 核心链", label: "W12 D5 · 诊断与收口", description: "独立诊断、Bub 验收、覆盖率基线与 W13 输入的收口记录", load: () => import("../../../../week12-python-rag/notes/day5-diagnosis-and-wrapup.md?raw").then((m) => m.default), file: "day5-diagnosis-and-wrapup.md", repoPath: "week12-python-rag/notes/day5-diagnosis-and-wrapup.md", reviewOnly: true, restrictionNote: W12_RESTRICTION },
  { id: "w12plan", group: "W12 核心链", label: "W12 周计划", description: "Python for AI Engineering、Bub 深读、每日节奏与周间接口", load: () => import("../../../../week12-python-rag/notes/week12-plan.md?raw").then((m) => m.default), file: "week12-plan.md", repoPath: "week12-python-rag/notes/week12-plan.md", reviewOnly: true, restrictionNote: W12_RESTRICTION },
  { id: "w12viz", group: "W12 核心链", label: "W12 展板方法", description: "AI 工程九块专题的十列视觉契约、冻结决策与接入边界", load: () => import("../../../notes/w12-ai-visualization-plan.md?raw").then((m) => m.default), file: "w12-ai-visualization-plan.md", repoPath: "week8-fullstack/notes/w12-ai-visualization-plan.md", reviewOnly: true, restrictionNote: W12_RESTRICTION },
] as const satisfies readonly NoteSourceShape[];

export type NoteId = (typeof NOTES)[number]["id"];
export type NoteSource = Omit<NoteSourceShape, "id"> & { id: NoteId };

export interface NoteTarget {
  noteId: NoteId;
  section?: string;
}

export interface NoteReturnTarget {
  tab: "ai-engineer";
  topic: string;
}

export function noteHref(
  target: NoteTarget,
  currentMode: BoardMode,
  returnTarget?: NoteReturnTarget,
): string {
  const note = (NOTES as readonly NoteSource[]).find((item) => item.id === target.noteId);
  const params = new URLSearchParams();
  if (currentMode === "review" || note?.reviewOnly) params.set("mode", "review");
  params.set("tab", "notes");
  params.set("topic", target.noteId);
  if (target.section) params.set("section", target.section);
  if (returnTarget) {
    params.set("returnTab", returnTarget.tab);
    params.set("returnTopic", returnTarget.topic);
  }
  return `#/showcase?${params.toString()}`;
}

export function noteReturnHref(target: NoteReturnTarget, currentMode: BoardMode): string {
  const params = new URLSearchParams();
  if (currentMode === "review") params.set("mode", "review");
  params.set("tab", target.tab);
  params.set("topic", target.topic);
  return `#/showcase?${params.toString()}`;
}
