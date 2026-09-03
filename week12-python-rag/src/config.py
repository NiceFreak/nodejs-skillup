"""极简配置读取（白名单脚手架）。

顺序：已存在的环境变量优先；否则解析项目根 .env（KEY=VALUE 行，忽略 # 注释与空行）。
刻意不做引号展开等完整 dotenv 语义——key 无特殊字符，避免为模板引入额外依赖。
"""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_env(dotenv_path: Path = PROJECT_ROOT / ".env") -> None:
    if not dotenv_path.is_file():
        return
    for raw in dotenv_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ.setdefault(key, value)
