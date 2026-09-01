"""冒烟测试：证明环境、import 与测试入口可用（D2 决策 2 判据）。"""

import sys

import pydantic


def test_smoke_environment():
    assert sys.version_info >= (3, 12), f"需要 Python 3.12+，当前 {sys.version}"


def test_smoke_pydantic_importable():
    assert pydantic.VERSION.startswith("2")
