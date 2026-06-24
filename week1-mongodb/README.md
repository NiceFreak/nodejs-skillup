# Week 1 · MongoDB 基础 + 数据建模

本周主题:文档建模思维(嵌入 / 引用 / 快照)、CRUD 与查询、索引与查询性能(`explain`)。

学习产出以 **可复跑的实验 + 笔记** 形式呈现:起好 MongoDB,跑一次 seed 重建数据,就能照着笔记亲手复现「索引前后性能对比」。

---

## 快速开始(3 步)

```bash
# 1. 起 MongoDB(在本目录下)
docker compose up -d

# 2. 重建样例数据(practice 小数据集 + bigdata 5 万条)
mongosh "mongodb://root:example@localhost:27017/shop?authSource=admin" src/seed.js

# 3. 用 Compass 连同一个连接串,或继续用 mongosh 跑实验
```

连接串与上面一致:`mongodb://root:example@localhost:27017/shop?authSource=admin`(账号密码见 `docker-compose.yml`)。

---

## 看点:索引前后性能对比(本周核心成果)

下面是 `notes/day2-3-index.md` 里用 `explain("executionStats")` 实测出来的对比。判断索引好坏看的是**扫描文档数 `totalDocsExamined`**(相对量,可靠),而非绝对耗时(受机器/缓存影响)。

| 场景 | 执行方式 | 扫描文档数 | 说明 |
|---|---|---|---|
| 无索引,等值查 `age:42` | `COLLSCAN` | **50000** | 全表逐条翻 |
| 建 `{age:1}` 后,同一查询 | `IXSCAN` + `FETCH` | **1000** | 索引定位 + 回表取完整文档 |
| 只投影 `{age:1, _id:0}` | `PROJECTION_COVERED` | **0** | 覆盖查询,字段全在索引里,免回表 |

复现方式(seed 完成后,在 mongosh 里依 `notes/day2-3-index.md` 的步骤逐条跑 `explain`):索引是逐步建起来的——先测无索引基线,再 `createIndex`,差异才有冲击力。复合索引「最左前缀」和覆盖查询的对照实验也在同一篇里。

---

## 笔记导航

| 文件 | 内容 |
|---|---|
| `notes/day1-data-modeling.md` | 建模判断框架、订单系统三个决策、多对多中间表、查询速查 |
| `notes/day2-1-crud.md` | 增/改/删与原子操作符(`$set`/`$inc`/`$push`)、删除安全习惯 |
| `notes/day2-2-extra-practice.md` | 脱手实战:不看笔记从零重建,标记薄弱点 |
| `notes/day2-3-index.md` | 索引、`explain`、最左前缀、覆盖查询(本周核心) |

---

## 验收清单(对照 README 根目录的第 1 周清单)

- [x] Docker MongoDB 实例(`docker-compose.yml`)+ 可复跑的 seed 入口(`src/seed.js`)
- [x] 常用查询速查笔记(day1 第 5 节)
- [x] 建模取舍说明笔记,每个嵌入/引用决策写明理由(day1 第 1–2 节)
- [x] `explain()` 索引前后性能对比记录(day2-3)
- [ ] **订单系统文档结构设计** —— 把 day1 的三个决策写成一组示例文档(JSON),放进本目录。仅用本周已学的「文档结构」即可,不依赖第 2 周的 Mongoose Schema。
- [ ] Compass 连接成功截图(可选,作为环境就绪的展示证据)
