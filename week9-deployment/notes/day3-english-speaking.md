# W9 Day 3（8/12）技术英语口语稿

## Topic

How I verified a deployed Node.js stack end-to-end: seeded data, authenticated requests, real aggregation output, and two systemd failure behaviors — before touching the reverse proxy.

## Speaking Script

When I verified the deployed Node.js stack this week, the real test was not whether the process was alive, but whether real data flowed through the whole path. I seeded the database, registered an admin user, logged in to get a JWT, and called an aggregation endpoint. It returned six months of sales data. That evidence matters more than just seeing systemd report active.

Two systemd behaviors came out of the failure exercises. First, `Wants=mongod.service` means starting the app can pull up MongoDB automatically, so stopping the database does not kill the app. Second, the start-limit burst only triggers on fast failures. A quick config error stops the loop and marks the service failed; a slow database timeout keeps it restarting until the database recovers.

Before adding Nginx, I measured memory: MongoDB at 187 MB, Node at 84 MB, with about 1.4 GB available. That makes the next step safe.

## Speaking Check

- 词数：140（120–150 范围内）
- 预计时长：约 1 分钟（按 130–145 词/分钟）
- 口语感：第一人称、短句、因果清晰（验证 → 证据 → 两个 systemd 行为 → 内存闸门），像工程师复盘真实排障
- 事实边界：seed 2000/5057、JWT 登录、聚合 6 个月、Wants 连带拉起、StartLimitBurst 快失败、RSS 187/84/1388MB 均为今天真实执行；「Nginx 是下一步」明确未做
- 发音提示：`systemd`（读 system-dee，常连读为 /ˈsɪstəmdɪː/）、`Wants=`（不逐字母拼，读 wants）、`JWT`（/ˌdʒeɪ ˌdʌbəljuː ˈtiː/，或直接说 JSON web token）