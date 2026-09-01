def greet(name: str, title: str | None = None) -> str:
    return f"{title} {name}" if title else f"你好，{name}"


# print(greet("小明"))
# print(greet("张", "博士"))
# print(greet("x", ""))
