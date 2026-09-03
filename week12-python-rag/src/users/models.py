"""UserCreate / Address —— 与 prompts/prompt-v0.md §5 冻结 schema 对齐（D4 §6.1 真实校验用）。

契约源：prompts/prompt-v0.md 的 TypeScript interface ExtractedUser 及其注
（`addresses` 允许 null 或省略，与 `Optional[List[Address]] = None` 严格对齐）。
本文件是把冻结 schema 翻译为 Pydantic 模型的机械映射。
"""

from typing import Literal

from pydantic import BaseModel, Field


class Address(BaseModel):
    recipient: str
    phone: str
    province: str
    city: str
    detailAddress: str


class UserCreate(BaseModel):
    name: str
    email: str = Field(pattern=r"^\S+@\S+\.\S+$")
    age: int | None = None
    role: Literal["member", "admin"] = "member"
    addresses: list[Address] | None = None
