from pydantic import BaseModel, Field
from typing import Literal


# 1. 自定义业务异常
class UserValidationError(Exception):
    pass


# 2. 定义 Pydantic 模型（仅 email 字段，演示校验）
class User(BaseModel):
    email: str = Field(pattern=r"^\S+@\S+\.\S+$")
    name: str
    role: Literal["member", "admin"] = "member"


# 3. 翻译函数：内部构造模型，校验失败就抛业务异常
def create_user(email: str, name: str) -> User:
    try:
        user = User(email=email, name=name)
        return user
    except Exception as exc:  # 这里 exc 实际上是 ValidationError（Pydantic 的异常类）
        raise UserValidationError(f"用户数据校验失败: {exc}") from exc


# 4. 测试入口
if __name__ == "__main__":
    try:
        create_user(email="not-an-email", name="张三")
    except UserValidationError as e:
        print("=== 捕获到业务异常 ===")
        print(f"1. type(exc).__name__               -> {type(e).__name__}")
        print(f"2. exc.__cause__ 是什么？           -> {e.__cause__}")
        print(
            f"3. exc.__cause__.__class__.__name__ -> {e.__cause__.__class__.__name__}"
        )
        print("\n完整 traceback 如下（可以看到异常链）:")
        raise  # 重新抛出，显示完整 traceback（或者你可以去掉这一行只看打印）
