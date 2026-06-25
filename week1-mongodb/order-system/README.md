# 订单系统建模 demo(Week 1 待补产出)

把 day1 的三个建模决策落成真实数据,用 mongoose 实现。这是骨架——机制已搭好,**Schema 和数据由本人填**。

## 结构

```
order-system/
├── db.js                  # 连接/断开(样板,已写好)
├── models/
│   ├── user.model.js      # User Schema —— 你写(嵌入地址)
│   └── order.model.js     # Order Schema —— 你写(引用 user + 快照)
├── seed.js                # 造数据(机制已写,数据你填)
├── index.js               # 验证查询(机制已写,查询你填)
└── package.json
```

`seed.js` 与 `index.js` 都 import `models/` 里的同一套 Model —— 即"Model 只定义一处,造数据和跑查询共用"。

## 填写顺序

1. `models/user.model.js`、`models/order.model.js` —— 定义 Schema(对照 day1 决策 1/2/3)
2. `seed.js` —— 造 2~3 个 user、几条 order(难点:order 引用字段接 `users[i]._id`)
3. `index.js` —— 写验证查询(查某 user 的所有 order;确认快照独立于商品本体)

## 运行

```bash
npm install
# 确保 MongoDB 在跑(见 ../docker-compose.yml)
npm run seed     # 造数据
npm start        # 跑验证查询
```
