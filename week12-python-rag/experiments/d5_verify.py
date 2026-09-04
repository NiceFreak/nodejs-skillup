"""D5 诊断验证脚本：Step 4（契约断言）+ Step 5（反证复现 RuntimeError）。

运行：.venv/bin/python -m experiments.d5_verify
预期：绿色输出 "All passed"，无 AssertionError。
"""

import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

import httpx

# 导入原模块
import experiments.d5_diagnosis_fetcher as fetcher


async def step4_contract_verification():
    """Step 4: 三条契约的可证伪证据。"""
    print("[Step 4] 开始验证三条契约...")

    # 1. 契约②：正常路径 + 严格结果匹配
    res1, elapsed1 = await fetcher.run(["fast", "slow", "fast"])
    expected1 = [("fast", 200), ("slow", "TIMEOUT"), ("fast", 200)]
    assert res1 == expected1, f"契约②失败: 结果不匹配 {res1} != {expected1}"
    print(f"  契约②通过 (耗时 {elapsed1:.3f}s, 结果匹配)")

    # 2. 契约① 顺序无关：首项超时不影响后续
    res2, elapsed2 = await fetcher.run(["slow", "fast"])
    expected2 = [("slow", "TIMEOUT"), ("fast", 200)]
    assert res2 == expected2, f"契约①失败 (顺序无关): 结果不匹配 {res2} != {expected2}"
    # 耗时检查：slow 被截断在 0.15s，加上最后 fast 0.05s，约 0.20s，不会到 0.30s+0.05
    assert elapsed2 < 0.35, f"契约①失败 (超时未截断): 耗时 {elapsed2:.3f}s 过长"
    print(f"  契约①通过 (首项超时未阻塞后续, 耗时 {elapsed2:.3f}s)")

    # 3. 契约③ 共享 + 无泄漏（monkeypatch 计数 + 检查关闭状态）
    original_build = fetcher.build_client
    call_count = 0
    captured_client = None

    def counting_build_client():
        nonlocal call_count, captured_client
        call_count += 1
        client = original_build()
        captured_client = client
        return client

    # 注意：必须 patch 原模块的全局引用
    with patch("experiments.d5_diagnosis_fetcher.build_client", counting_build_client):
        res3, elapsed3 = await fetcher.run(["fast", "fast"])
        # 调用次数 = 1
        assert call_count == 1, f"契约③失败: build_client 调用 {call_count} 次，应为 1"
        # run 返回后，client 处于关闭状态（run 的 finally 执行了）
        assert captured_client is not None
        assert captured_client.is_closed is True, "契约③失败: run 返回后 client 未关闭"
        print(
            f"  契约③通过 (build_client 调用 {call_count} 次, client.is_closed={captured_client.is_closed})"
        )

    print("[Step 4] 全部契约验证通过！\n")
    return True


async def step5_refutation():
    """Step 5: 反证实验 —— 把 aclose 加回，必须复现 RuntimeError。"""
    print("[Step 5] 开始反证实验（注入缺陷版 fetch_one）...")

    # 定义带缺陷的 fetch_one（包含 finally: await client.aclose()）
    async def fetch_one_bad(client: httpx.AsyncClient, path: str):
        url = f"http://mock/{path}"
        try:
            async with asyncio.timeout(fetcher.REQUEST_TIMEOUT):
                resp = await client.get(url)
                return path, resp.status_code
        except asyncio.TimeoutError:
            return path, "TIMEOUT"
        except httpx.HTTPError as exc:
            return path, f"HTTPERR:{type(exc).__name__}"
        finally:
            # 这就是原缺陷行
            await client.aclose()

    # Patch 原模块的 fetch_one 为缺陷版本
    with patch("experiments.d5_diagnosis_fetcher.fetch_one", fetch_one_bad):
        try:
            # 注意：为了更快触发，可以跑 ["fast", "slow"]，第二次请求必炸
            await fetcher.run(["fast", "slow"])
            # 如果没有抛出异常，则反证失败
            raise AssertionError("反证失败: 注入缺陷后未抛出 RuntimeError")
        except RuntimeError as e:
            # 校验是否为我们预期的异常
            if "Cannot send a request, as the client has been closed." in str(e):
                print("  反证通过: 成功复现 RuntimeError (client closed)")
                print(f"     异常消息: {e}")
                return True
            else:
                # 抛了别的 RuntimeError，不符合预期
                raise AssertionError(f"反证失败: 抛出了非预期 RuntimeError: {e}")


async def main():
    print("=== D5 诊断验证脚本 ===\n")

    try:
        # 先跑 Step 4
        await step4_contract_verification()
        # 再跑 Step 5
        await step5_refutation()

        print("\n 全部验证通过！")
        print("结论: 修复有效 (删除 finally 中的 aclose) 且反证成立 (加回必崩)。")
        sys.exit(0)
    except AssertionError as e:
        print(f"\n 验证失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
