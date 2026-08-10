# Day 1 English Speaking（8/10）：Deployment Contract Freeze

## Topic

Defense in depth when deploying a Node service behind Nginx: the listening address and the firewall are two separate gates.

## Speaking Script

When we deploy a Node service behind Nginx on a single server, there are two separate gates that keep it internal. The listening address decides which network interfaces the process accepts connections on. `0.0.0.0` means the service accepts everything, including the public interface; `127.0.0.1` means it only accepts loopback traffic from the same machine. The firewall is a different gate: it filters incoming packets by destination port before they reach any process. So binding to `127.0.0.1` plus firewall rules is defense in depth. If the firewall rules are accidentally deleted, the public interface simply has no socket waiting, so external requests cannot reach Node. Nginx still forwards to `127.0.0.1:3000` because it runs on the same host. External users only see port 443.

## Speaking Check

- 词数：122 词（在 120–150 范围内）
- 预计时长：约 54–56 秒（按约 130–135 词/分钟），符合约 1 分钟目标
- 口语感检查：叙述式工程回答，无论文/文档腔；使用了“two separate gates”“simply has no socket waiting”等对话化表达；只包含当天建立的推理（监听地址、防火墙、纵深防御、Nginx 同机转发、端口 443）
- 技术准确性：事实与 D1 笔记第 2.6 节、问题 4 的结论一致；没有引入当天未覆盖的背景知识
- 必要发音提示：
  - `127.0.0.1`：口语读作 "one two seven dot zero dot zero dot one"
  - loopback：/ˈluːp.bæk/
  - defense in depth：/dɪˈfens ɪn depθ/，重音在 "defense" 和 "depth"