# Week 1 · Mongoose 入门(Schema 校验与 CRUD)

承接 `week1-mongodb`(原生 MongoDB)的最后一块:用 Mongoose(ODM)在代码层加一层 Schema,把"随便存"变成"按规矩存"。

**展示看点:用一次运行同时演示"两层防线"**——Mongoose 应用层校验(`ValidationError`)与 MongoDB 数据库层约束(`E11000`)长得不一样、拦截时机也不同。

---

## 快速开始

```bash
# 0. 先确保 MongoDB 在跑(见 ../week1-mongodb/docker-compose.yml)
cd ../week1-mongodb && docker compose up -d && cd -

# 1. 装依赖
cd src && npm install

# 2. 运行 demo
node index.js
```

> 连接的是同一个 `shop` 库;脚本每次运行开头会 `deleteMany({})` 清空 `users` 集合,可重复跑。

---

## 你会观察到什么

1. **CRUD 正常链路**:create 5 条用户 → `find` 出来打印(按城市、按年龄)。
2. **三条违规被拦下**(本 demo 的核心):

   | 违规 | 拦截层 | 报错关键特征 |
   |---|---|---|
   | 缺 `name`(required) | Mongoose 应用层 | `validation failed ... Path \`name\` is required` |
   | `age: -5`(min) | Mongoose 应用层 | `validation failed ... less than minimum allowed value (0)` |
   | 重复 `email`(unique) | MongoDB 数据库层 | `E11000 duplicate key error` |

   **前两条 `validation failed` vs 第三条 `E11000`——报错格式不同,正是"两层防线"的可视化证据。** 原理见 `notes/day2-4-mongoose.md` 第 4 节。

---

## 文件

| 路径 | 说明 |
|---|---|
| `src/index.js` | 连库 + Schema + CRUD + 三个违规验证(核心代码,本人编写) |
| `src/package.json` | 依赖:mongoose |
| `notes/day2-4-mongoose.md` | 概念、最小链路踩坑、两层防线认知 |
