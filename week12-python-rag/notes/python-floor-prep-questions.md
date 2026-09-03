# Python 面试地板突击题库（JS/TS → Python 对照）

> 背景：JS 熟练（10年）、TS 有基础、Node 事件循环理解扎实；Python 生产经验为零。
> 目标：读懂、能推理、能诚实讲清水平，不求专家。不展开框架（Flask/FastAPI/Django/ORM）。
> 用法：全部作答后一起发回去，逐题批改，再打磨并发对比话术 + 收尾"最容易说错的5句"。
>
> 落盘：2026-09-03（W12 D4，Asia/Shanghai）。本文件是题库原文，答案由本人产出，AI 不预填。

---

## Q1. 真值与 None

```python
values = [0, 1, "", "a", [], [0], None, {}, 0.0]
for v in values:
    print(bool(v))
```

逐个判断 True/False。Python 的 falsy 集合和 JS 的 falsy 集合有什么不一样（尤其空容器、浮点数）？

---

## Q2. list / tuple / dict / set

```python
a = (1, 2, 3)
a[0] = 99
```

会发生什么？为什么？跟 JS 里最接近的类比是什么？

```python
d = {"a": 1}
s = {"a": 1}
```

`s` 是 dict 还是 set？为什么容易搞混？空 set 该怎么写？

---

## Q3. Comprehension

```python
nums = [1, 2, 3, 4, 5]
result = [n * 2 for n in nums if n % 2 == 0]
```

等价于哪两个 JS 方法链在一起？`result` 最终是什么？

---

## Q4. 切片

```python
a = [0, 1, 2, 3, 4, 5]
print(a[1:4])
print(a[:3])
print(a[::2])
print(a[::-1])
```

四行分别输出什么？后两行在 JS 的 `.slice()` 里有没有直接对应？没有的话通常怎么替代？

---

## Q5. for + enumerate / zip / range

```python
names = ["a", "b", "c"]
for i, name in enumerate(names):
    print(i, name)
```

JS 里最接近的写法是什么？`enumerate` 具体在做什么？

```python
names = ["a", "b"]
ages = [10, 20]
for name, age in zip(names, ages):
    print(name, age)
```

`zip` 在 JS 里怎么模拟（没有内建对应）？

---

## Q6. 默认参数 / *args / **kwargs

```python
def add_item(item, my_list=[]):
    my_list.append(item)
    return my_list

print(add_item("a"))
print(add_item("b"))
```

两次 `print` 分别输出什么？这跟 JS `function addItem(item, myList=[])` 的行为一样吗？为什么？

```python
def f(a, b=10, *args, **kwargs):
    print(a, b, args, kwargs)

f(1, 2, 3, 4, x=5, y=6)
```

输出是什么？`*args` / `**kwargs` 分别对应 JS 的哪种写法？

---

## Q7. `==` vs `is`

```python
a = [1, 2, 3]
b = [1, 2, 3]
c = a

print(a == b)
print(a is b)
print(a is c)
```

三行分别是什么？这跟 JS 的 `===` 是不是同一回事？

---

## Q8. 类与 self

```python
class Counter:
    def __init__(self, start=0):
        self.count = start

    def increment(self):
        self.count += 1
        return self.count

c = Counter()
c.increment()
print(c.increment())
```

翻成 JS class 大概长什么样？Python 方法第一个参数 `self` 对应 JS 里的什么？为什么 Python 要显式写、JS 不用？

---

## Q9. Type hints（对照 TS）

```python
def greet(name: str, age: int = 18) -> str:
    return f"{name} is {age}"

greet("Tom", "not a number")
```

这行调用在 TypeScript 里会怎样？在 Python 里会怎样？两者对"类型"的**约束力**有什么本质区别？

---

## Q10. 并发：GIL / asyncio vs Node 事件循环（重点）

```python
import asyncio
import time

async def task(name, delay):
    print(f"{name} start")
    time.sleep(delay)  # 注意：这里是 time.sleep，不是 asyncio.sleep
    print(f"{name} end")

async def main():
    await asyncio.gather(task("A", 2), task("B", 1))

asyncio.run(main())
```

1. A、B 会"并发"执行吗？最终打印顺序是什么？
2. 如果把 `time.sleep(delay)` 换成 `await asyncio.sleep(delay)`，结果会不会不一样？为什么？
3. 抛开代码本身：从你对 Node 事件循环的理解出发，GIL 存在的情况下，Python 的"并发"和 Node 的"并发"本质上是不是同一件事？
