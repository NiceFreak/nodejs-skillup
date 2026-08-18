# Nginx nginx.conf Logging 片段 — W10 D2 副本（2026-08-18）

> 对应 `/etc/nginx/nginx.conf` 的 http { } 块「Logging Settings」区。
> 服务器回滚基线：/etc/nginx/nginx.conf.bak.20260818

## 改动（http 块内替换 Logging Settings 区）

```nginx
	##
	# Logging Settings
	##

	# W10 D2：自定义 obs 格式（含 $request_id，四份 site 共用此 access.log）
	log_format obs '$time_iso8601 rid=$request_id $remote_addr "$request" '
	               '$status $body_bytes_sent rt=$request_time "$http_user_agent"';

	access_log /var/log/nginx/access.log obs;   # ← 必须显式指定 obs，否则仍是默认 combined
	error_log /var/log/nginx/error.log;
```

## 执行期新缺口（2026-08-18 本地副本阶段发现）

`log_format` 只是**定义**格式模板，**不自动生效**——`access_log` 指令必须指定用哪个 format。
- 现配置：`access_log /var/log/nginx/access.log;`（默认 combined）
- 若只加 `log_format` 不改这行 → 新格式**不会用上**，且 `nginx -t` 照样通过（语法合法）
- 这是「配置改了但没生效」的第三个实例（前两个：proxy_set_header location 屏蔽、/health 挡在 return 404 后）
- **验证⑤是唯一证伪手段**：access.log 里 grep 不到 `rid=` 开头 = 格式没生效

## 字段口径

- `$time_iso8601`：本机 TZ=UTC+8 → `2026-08-18T15:51:00+08:00`（P2 已拍板：接受偏移，runbook 写换算）
- `$request_id`：Nginx 内置（1.11.0+），32 位十六进制，每请求一个
- `rt=$request_time`：与 Node duration 是两个口径（D1 Q6），前缀区分