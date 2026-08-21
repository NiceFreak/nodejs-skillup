# W10 Day 5（8/21）技术英语口语稿

## Topic

Why fake red alerts don't prove monitoring works

## Speaking Script

When we built four health checks, we confirmed each could turn red by tweaking its threshold. But yesterday, when we injected real failures — filling the disk, breaking the reverse proxy, occupying the port — the checks stayed green. The disk was truly down to 3.8 gigabytes, yet the check said OK, because it compared the rounded display value instead of raw bytes. That taught me a key lesson: a green check only proves the comparison logic runs; it does not prove a real failure will trip it. So today I rewrote the disk check to compare byte-level values, re-injected the same failure, and finally saw the red alarm with the exact free space in the log. I also wrote a runbook recording symptoms, first commands, decision branches, fixes, and prevention for each failure. A delayed self-test — following the runbook a day later without notes — confirmed it works end to end.

## Speaking Check

- **词数**：约 149（目标 120–150 ✅）
- **预计时长**：约 1 分钟（135–145 词/分钟正常语速）
- **口语感检查**：主谓完整、短句为主、数字用可读形式（3.8 gigabytes）、术语（reverse proxy / byte-level / runbook / self-test）均为当天真实使用，无论文腔 ✅
- **必要发音**：
  - byte-level → /baɪt ˈlev.əl/（byte 读 /baɪt/ 不要读成 /bɪt/）
  - proxy → /ˈprɒk.si/
  - gigabytes → /ˈɡɪɡ.ə.baɪts/（美式常读 /ˈdʒɪɡ-/