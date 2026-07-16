# Hooks 面试地图：给写惯 React 16 类组件的人

> 背景：多年 React 16 及更低版本（类组件为主，hooks 使用强度低）+ Next 14/15 经验。
> 2026 年 React 面试的现实：**hooks 与函数组件是默认主考区（面试官假设你熟）**，
> 类组件已降级为「遗留知识」，只在错误边界（Error Boundary 仍必须是类）和
> 「迁移经验」类问题里出现。新热点是 React 19 的 Compiler / Actions / Server Components。
> 来源见文末。本仓库 `src/frontend/` 恰好用到了大部分考点模式，每节都指向真实代码行，
> 可以跑起来改着玩，比背题库有效。白名单资产，AI 整理维护。

## 一、先换心智模型（比记 API 重要）

类组件和 hooks 不是语法差异，是两种心智模型。面试里最能区分深度的就是这层：

| 类组件思维 | Hooks 思维 |
|---|---|
| 生命周期：「在某个时机做某事」 | **同步**：「让副作用与某些数据保持同步」 |
| 实例（this）跨渲染持续存在 | **每次渲染是一次独立的函数调用**，变量被当次闭包捕获 |
| `this.state` 永远指向最新状态 | 每次渲染「看到」的 state 是那一帧的快照 |
| `setState` 浅合并对象 | `useState` 的 setter **整体替换**（对象要自己展开合并） |

第二行是理解一切 hooks 陷阱的钥匙：**函数组件的每次渲染都是一次快照**。

## 二、高频考点与陷阱（按被问概率排序）

### 1. 闭包陷阱（stale closure）——必考

```jsx
const [count, setCount] = useState(0);
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000); // count 永远是 0
  return () => clearInterval(id);
}, []); // 空依赖：闭包捕获了首帧的 count
```

三种解法及取舍：
1. **函数式更新** `setCount(c => c + 1)`——不依赖外部闭包值，首选；
2. 把 `count` 加进依赖——正确但定时器每秒重建；
3. `useRef` 存最新值——绕过闭包，代价是失去响应式。

本仓库对照：`Dashboard.tsx` AuthProbePanel 的 `setLog(prev => [...])` 就是函数式更新
（注释 `[React] 函数式 setState`）。

### 2. useEffect 的完整语义——必考

- 依赖数组不是「什么时候执行」，是「效果与谁同步」；
- **cleanup 在下一次 effect 之前和卸载时都会执行**（不是只在卸载时）；
- 请求竞态：依赖变化连发两个请求，晚发的先回——cleanup 里置 ignore 标志或用 AbortController；
- 「useEffect 对应哪些生命周期」是过渡期问法，答映射后要主动补一句：更准确的模型是同步外部系统。

映射速查：`componentDidMount` ≈ 空依赖 effect；`componentDidUpdate` ≈ 有依赖 effect；
`componentWillUnmount` ≈ cleanup；`shouldComponentUpdate`/`PureComponent` ≈ `React.memo`。

本仓库对照：`Dashboard.tsx` 的 `useCallback(load) + useEffect([load])` 链——
「筛选条件变 → load 变 → effect 重跑」，这是「效果与数据同步」的活例子。

### 3. useMemo / useCallback：什么时候不用——高区分度

背「用于性能优化」只能拿及格分。加分点：
- 默认不用；先测量再优化，滥用本身有成本（依赖比较 + 内存）；
- 真正需要的三种场景：计算昂贵、引用相等性传给 memo 子组件、**作为其他 hook 的依赖**（本仓库 load 属于第三种）；
- 趋势题：**React 19 Compiler 自动记忆化**，手写 memo 正在退场——知道这个说明你在跟进。

本仓库对照：`charts.tsx` 的 `useMemo(() => niceTicks(max), [max])`；`Dashboard.tsx` 的 kpi。

### 4. useRef 的双职责

拿 DOM（`charts.tsx` useTooltip 的 `wrapRef`）+ 跨渲染可变容器（改 `.current` 不触发渲染）。
对照类组件：它就是「实例属性」在函数组件里的替身——面试官爱听这个映射。

### 5. Rules of Hooks 的「为什么」

不能在条件/循环里调用，因为 React 按**调用顺序**（内部链表/数组索引）把 hook 和状态配对；
条件调用会让后续所有 hook 错位。能讲出「顺序即身份」就超过多数候选人。

### 6. 自定义 Hook 设计

考察点是抽象品味：输入输出契约清晰、内聚一个关注点、命名 `useXxx`。
本仓库对照：`charts.tsx` 的 `useTooltip`（状态 + ref + 两个方法打包给两个图表复用）。

### 7. React 18 并发特性（概念题，Next 14/15 经验正好接上）

`useTransition`（低优先级更新）、`useDeferredValue`、`useSyncExternalStore`（第三方 store 接入）、
`Suspense`。你写过 Next 14/15，可以主动把话题引到 RSC / streaming——那是你的主场。

### 8. 状态管理选型（开放题）

标准答案框架：服务端状态（TanStack Query）和客户端状态（Zustand/Context）分开管；
Context 适合低频全局数据、不是状态管理器替代品（高频更新会全树重渲染）。
详见 `frontend-toolbox.md` 第 2 节。

## 三、类组件经验怎么在面试里变成资产

不要把 React 16 背景当短板藏着，把它讲成迁移能力：

- 「错误边界为什么还得用类组件」——你是真写过的人（`componentDidCatch/getDerivedStateFromError` 没有 hooks 等价物）；
- 「HOC / render props 为什么被自定义 Hook 取代」——嵌套地狱你亲历过，讲得出具体痛点；
- 「如果接手一个类组件为主的存量项目怎么办」——这题多数只写过 hooks 的候选人答不好，你反而是优势方。

一句话叙事：**「类组件时代的存量经验 + Next 14/15 的新范式经验，中间的 hooks 深度我用
自己的全栈项目补齐了」**——然后就可以指向本仓库。

## 四、Vue 3 怎么办：不预学

- React 岗位面试不考 Vue 3；JD 明确要求再学，届时是「按需 1-2 周」量级；
- 学过 hooks 之后 Composition API 是同构概念，粗映射：`ref/reactive` ≈ useState、
  `computed` ≈ useMemo、`watch/watchEffect` ≈ useEffect、`setup` 顶层 ≈ 函数组件体、
  组合式函数 ≈ 自定义 Hook。差异记一条即可：Vue 是真响应式（依赖追踪、组件函数只跑一次），
  React 是重渲染快照——所以 Vue 没有闭包陷阱和依赖数组。
- 结论：hooks 练扎实是「一鱼两吃」，它同时是 Vue 3 的最快入口。

## 五、怎么用本仓库练（不加排期，碎片时间）

1. 跑起前端（见 `../README.md`），打开 `Dashboard.tsx`，把 `load` 的 `useCallback` 去掉、
   把 effect 依赖改错，观察行为——陷阱亲手踩一遍胜过读十篇文章；
2. 给鉴权演示面板加一个「每 5 秒自动探测」开关：会自然撞上闭包陷阱 + cleanup + 函数式更新
   三个考点（15 分钟量级的小练习）；
3. 面试前把第二节从上到下自问自答一遍，答不出的回对应代码行。

## 参考来源（2026-07 检索）

- [2026 前端面试题汇总 · React 篇](https://frontend-interview.similarlabs.com/react/)（类组件已标记为遗留方案，错误边界除外）
- [深入理解 React Hooks 完整体系](https://frontend-interview.similarlabs.com/react/hooks)
- [100+ React 面试题（GreatFrontend 中译）](https://juejin.cn/post/7644100429681377306)
- [一文讲透 React Hooks 闭包陷阱](https://juejin.cn/post/7230819482012237861)
- [2026 最新 React 面试题](https://juejin.cn/post/7348651815759282226)
