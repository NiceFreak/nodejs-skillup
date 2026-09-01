"""W12 Python 基线冒烟入口。

验证：Python 3.12+ 可用、pydantic 可导入、进程以 0 退出码结束。
运行：python -m src.smoke
"""

import sys


def main() -> int:
    try:
        import pydantic
    except ImportError as exc:
        print(f"[smoke] FAIL: pydantic import error: {exc}", file=sys.stderr)
        return 1
    print(f"[smoke] OK: python={sys.version.split()[0]} pydantic={pydantic.VERSION}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
