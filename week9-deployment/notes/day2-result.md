# 块 C：服务器现状核对（只读命令输出）

> 2026-08-11 通过腾讯云控制台网页终端执行（root），复制整理。以下为脱敏后的各命令输出与执行说明。所有命令均为只读，服务器未做任何写操作。

## 1. 当前监听的端口全集 `ss -tlnp`

```text
State  Recv-Q Send-Q Local Address:Port  Peer Address:Port  Process
LISTEN 0      4096   127.0.0.53%lo:53    0.0.0.0:*    users:(("systemd-resolve",pid=742,fd=14))
LISTEN 0      128          0.0.0.0:22    0.0.0.0:*    users:(("sshd",pid=72343,fd=3))
LISTEN 0      128             [::]:22       [::]:*    users:(("sshd",pid=72343,fd=4))
```

**注解**：
- 22 端口 = sshd，IPv4（`0.0.0.0`）+ IPv6（`[::]`）双栈监听，符合端口表「22 公网 0.0.0.0/0」。
- 53 端口 = systemd-resolved 本地 DNS stub（`127.0.0.53`，仅回环）——Ubuntu 22.04 标配，零外部暴露，不在 D1 端口表中，无需处理。
- 80/443/3000/27017 均未监听（Node=D2、Mongo=D3、Nginx=D4 才装）。

## 2. ufw 状态 `sudo ufw status verbose`

```text
Status: inactive
```

**注解**：Ubuntu 默认 inactive；当前 SSH 会话存活 ⇒ 放行无冲突。D2 执行时按问题 14：先 `allow 22` 再 `enable`。

## 3. apt 源 Node 版本 `apt-cache policy nodejs`

```text
nodejs:
  Installed: (none)
  Candidate: 12.22.9~dfsg-1ubuntu3.6
  Version table:
     12.22.9~dfsg-1ubuntu3.6 500
        500 http://mirrors.tencentyun.com/ubuntu jammy-updates/universe amd64 Packages
        500 http://mirrors.tencentyun.com/ubuntu jammy-security/universe amd64 Packages
     12.22.9~dfsg-1ubuntu3 500
        500 http://mirrors.tencentyun.com/ubuntu jammy/universe amd64 Packages
```

**注解**：Candidate = 12.22.9 < 20.6 ⇒ `--env-file` 不可用，apt 渠道淘汰（问题 12）。apt 源为腾讯云镜像 `mirrors.tencentyun.com`。

## 4. Node/npm 是否存在 `node -v; npm -v`

```text
/usr/local/qcloud/tat_agent/tmp/invt-778ssr0ftb.sh: line 11: node: command not found
/usr/local/qcloud/tat_agent/tmp/invt-778ssr0ftb.sh: line 11: npm: command not found
```

**注解**：node 与 npm 均未安装（命令由 tat_agent 临时脚本包装执行，报错行含脚本路径——已保留作为「未安装」证据，路径本身可忽略）。

## 5. 内存与 Swap `free -m`

```text
               total        used        free      shared  buff/cache   available
Mem:            1931         306         286           2        1338        1450
Swap:              0           0           0
```

**注解**：total 1931 MB / available 1450 MB / Swap = 0。与 D1 基线（1468 MB）差 18 MB，空载状态基本稳定。Swap=0 ⇒ 内存是 D2/D3 硬约束（问题 13）。

## 6. 磁盘可用 `df -h`

```text
Filesystem      Size  Used Avail Use% Mounted on
tmpfs           194M  984K  193M   1% /run
/dev/vda2        40G  4.5G   34G  12% /
tmpfs           966M   24K  966M   1% /dev/shm
tmpfs           5.0M     0  5.0M   0% /run/lock
```

**注解**：根分区 `/dev/vda2` 40G，可用 34G（12%）——磁盘不是约束，内存才是（问题 13 对照）。

## 7. systemd 服务列表 `systemctl list-units --type=service`

```text
60 loaded units listed. 全为基础/云厂商服务（acpid、apparmor、cloud-init*、cron、dbus、getty@tty1、
journald、networkd、rsyslog、snapd、ssh、systemd-*、tat_agent、unattended-upgrades、ufw 等）。
无任何 Node 或业务相关服务。
```

**注解**（节选关键服务）：
- **`unattended-upgrades.service` 运行中** ⇒ 系统会自动装安全更新，「服务器无人动过」的说法要修正为「服务器会自己动」。
- **`tat_agent.service`（腾讯云云助手）运行中** ⇒ 用户经控制台网页终端执行命令，属带外通道；问题 14/15 的「锁死验证」必须基于真 SSH 会话（网页终端不经 sshd，验证不了 SSH 是否锁死）。
- `ufw.service` 显示 `loaded active exited`——这是 ufw **服务单元**存在，不代表防火墙在过滤（实际状态见第 2 条 inactive）。

## 脱敏说明

已移除原控制台执行记录中的字段：实例 ID、实例名称、命令 ID、命令类型、执行路径、执行用户、起止时间、ExitCode、超时时间、命令内容页链接。保留各命令的实际输出与注解，足以支撑块 C 核对与块 D 输入，不含可识别的云账户/资源信息。