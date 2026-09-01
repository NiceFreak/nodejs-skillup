# W12 D2（9/1 周二）技术英语口语稿

## Topic

Exception chaining and error translation in Python, learned by migrating from TypeScript.

## Speaking Script

When I moved from TypeScript to Python, the thing that took me longest was error translation. In TypeScript, I would catch a low-level error and rethrow a business error with a cause, like `throw new EmailConflictError(msg, { cause: error })`. Python has the same idea, but the syntax is different. You write `raise UserValidationError(...) from exc`. The original exception is automatically attached to `__cause__`, so the traceback shows the whole chain: first the Pydantic validation error, then your business error as the direct cause. I tested this by catching a Pydantic `ValidationError`, rethrowing a `UserValidationError`, and checking `__cause__.__class__.__name__` — it returned `ValidationError`. This matters because in a layered service, the repository translates storage errors into business errors, and the caller handles only one type.

## Speaking Check

- 词数：约 131（120–150 ✅）
- 预计时长：约 1 分钟（130–145 wpm）
- 口语感检查：对话式、第一人称、无论文语气；只用了今天实测的异常链与错误翻译内容。
- 必要发音：`__cause__`（dunder cause）、`traceback`（treis-bak）、`rethrow`。
