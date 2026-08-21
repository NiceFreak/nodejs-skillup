// W9 术语 ↔ 白话对照（展示资产）。
//
// 来源锁定 week9-roadmap-d1-d4.md §8.1 / §8.2 / §8.3——**不新造白话**。
// 那份对照表本身是 W9 笔记里可理解性含量最高的资产，但它躺在文末附录里，
// 读者看拓扑图时不会翻回去。这里把它接到标签上，需要时一键切过去。
//
// 范围刻意收窄：只挂**确实还是术语**的那些标签。板上大部分说明文字本来就是白话
// （「门卫：公网只认它」「仓库：只有同机的 Node 能连上」），给它们再套一层切换
// 只会变成 roadmap 警告过的那种装饰。

export interface GlossaryEntry {
  id: string;
  term: string;
  plain: string;
  /** 来自 roadmap 的哪一节，便于回溯。 */
  from: "8.1" | "8.2" | "8.3";
}

export const W9_GLOSSARY: Record<string, GlossaryEntry> = {
  "trust-boundary": { id: "trust-boundary", term: "信任边界", plain: "外面能摸到哪一层", from: "8.1" },
  "plane-public": { id: "plane-public", term: "公网可达", plain: "外面摸得到", from: "8.1" },
  "plane-loopback": { id: "plane-loopback", term: "仅本机（loopback 内线）", plain: "只有本机自己跟自己通", from: "8.2" },
  "loopback": { id: "loopback", term: "loopback", plain: "本机自己跟自己通信的回路", from: "8.2" },
  "reverse-proxy": { id: "reverse-proxy", term: "反向代理", plain: "门卫转发", from: "8.1" },
  "least-privilege": { id: "least-privilege", term: "最小权限", plain: "只发够用的钥匙", from: "8.1" },
  "defense-in-depth": { id: "defense-in-depth", term: "纵深防御", plain: "两道闸门，坏一道还有一道", from: "8.1" },
  "attack-surface": { id: "attack-surface", term: "攻击面", plain: "攻击者能摸到的门有几扇", from: "8.1" },
  "out-of-band": { id: "out-of-band", term: "带外通道", plain: "不走 SSH 的另一条管理路", from: "8.2" },
  "fast-fail": { id: "fast-fail", term: "快失败", plain: "崩溃循环", from: "8.2" },
  "slow-fail": { id: "slow-fail", term: "慢失败", plain: "等依赖", from: "8.2" },
  "backoff": { id: "backoff", term: "退避", plain: "失败后等一等再重试，不立刻连打", from: "8.2" },
  "start-limit": { id: "start-limit", term: "StartLimitBurst", plain: "60 秒里最多重启几次", from: "8.2" },
  "contract": { id: "contract", term: "契约", plain: "开工前讲死的规矩", from: "8.2" },
  "settle": { id: "settle", term: "验收", plain: "把欠下的验证补掉", from: "8.2" },
  "memory-gate": { id: "memory-gate", term: "常驻内存上限", plain: "装新服务前先量余量", from: "8.2" },
  "anchor-check": { id: "anchor-check", term: "锚点核验", plain: "用已知量级的数字验证结果合理", from: "8.2" },
  "measured-word": { id: "measured-word", term: "可证伪", plain: "能说出失败长什么样", from: "8.1" },
};

/** roadmap §8.3：已经建立的类比，不要被「专业词」换回去。 */
export const W9_ANALOGIES = [
  { role: "Nginx", as: "门卫 / 接待" },
  { role: "systemd", as: "管家" },
  { role: "MongoDB", as: "仓库" },
  { role: "Node", as: "前台 / 店铺" },
  { role: "保留的 SSH 会话", as: "救生索" },
  { role: "监听地址 + 防火墙", as: "两道闸门" },
] as const;
