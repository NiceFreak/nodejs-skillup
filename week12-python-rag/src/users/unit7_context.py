class Resource:
    def __enter__(self):
        print("enter: opened")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        name = exc_type.__name__ if exc_type else None
        print(f"exit: closed (exc_type={name})")
        return False


print("--- 场景 A：正常 ---")
with Resource():
    print("body A")

print("--- 场景 B：体内抛异常 ---")
try:
    with Resource():
        print("body B")
        raise ValueError("boom")
except ValueError as exc:
    print("caught:", exc)
