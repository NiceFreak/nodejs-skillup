# 演示截图清单

存放 Week 1 演示用截图。命名与 `../DEMO-SCRIPT.md` 里的引用一致,截好丢进本目录即可自动显示。
**每张都要在画面里证明一个具体事实**,不是随手截。

## A. 环境就绪(也是验收证据)

| 文件名 | 画面必须包含 |
|---|---|
| `01-compass-connected.png` | Compass 左侧绿色已连接 + `localhost:27017` + 展开 `shop` 看到 `practice`/`bigdata`/`users`/`orders` + `bigdata` 文档数 **50000** |

## B. 演示备份(现场挂了顶上)

| 文件名 | 画面必须包含 |
|---|---|
| `02-order-document.png` | 一条 `orders` 文档:`userId`(引用)+ `items[].name/price`(快照)+ `shippingAddress`(快照)+ `amount` 为 Decimal128 |
| `03-user-addresses.png` | 一条 `users` 文档,`addresses` 为嵌入数组 |
| `04-explain-collscan.png` | `stage: COLLSCAN` + `totalDocsExamined: 50000` |
| `05-explain-ixscan.png` | `IXSCAN` + `totalDocsExamined: 1000` |
| `06-leftmost-collscan.png` | 删 `age_1` 后只查 age → `COLLSCAN` / `50000`(最左前缀证明) |
| `07-explain-covered.png` | `PROJECTION_COVERED` + `totalDocsExamined: 0` |
| `08-two-layer-defense.png` | 终端三行:两条 `validation failed` + 一条 `E11000`,两种报错格式并排 |

## 截图技巧

explain 输出很长,只截关键字段。可先抽出来再截,画面更干净:

```js
const e = db.bigdata.find({ age: 42 }).explain("executionStats")
({ stage: e.queryPlanner.winningPlan.stage, examined: e.executionStats.totalDocsExamined })
```
