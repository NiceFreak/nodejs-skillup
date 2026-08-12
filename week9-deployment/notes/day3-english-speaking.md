# W9 Day 3（8/12）技术英语口语稿

## Topic

How I made a Node.js API production-grade on a fresh Ubuntu server: loopback-only binding, MongoDB with authentication, and systemd supervision — before any reverse proxy.

## Speaking Script

When I deployed a Node.js service to a production server this week, the first decision was who it should listen on. The app binds to 127.0.0.1 by default, not 0.0.0.0. The database is also loopback-only and requires authentication, so even a local process without credentials cannot read it.

Next, systemd supervises the process. I wrote a unit with Restart=on-failure, a ten-second restart delay, and a start-limit burst so the service cannot spin in an infinite restart loop. The unit runs as a dedicated non-login user, reads `.env` through Node's `--env-file`, and declares After=mongod.service plus Wants=mongod.service to order startup without making Node die when MongoDB is down.

Before moving behind Nginx, I verified the app manually, then confirmed both processes were active and listening on 127.0.0.1. The public path still needs a reverse proxy in the next step.

## Speaking Check

- 词数：137（120–150 范围内）
- 预计时长：约 1 分钟（按 130–145 词/分钟）
- 口语感：第一人称、短句、含真实验证步骤（手动验证 → systemd active → loopback 监听），不像论文
- 事实边界：systemd 单元字段、loopback 绑定、认证实测均为今天真实发生；「Nginx 是下一步」明确标注未做
- 发音提示：`systemd`（读 system-dee，常连读为 /ˈsɪstəmdɪː/）、`Wants=`（不逐字母拼，读 wants）、`loopback`（/ˈluːpbæk/）