# Python 面试地板突击题库（JS/TS → Python 对照）

> 背景：JS 熟练（10年）、TS 有基础、Node 事件循环理解扎实；Python 生产经验为零。
> 目标：读懂、能推理、能诚实讲清水平，不求专家。不展开框架（Flask/FastAPI/Django/ORM）。
> 用法（2026-09-05 W12 D6 修订）：题库按「一题一问」进行——AI 逐题出示题面，本人独立作答后
> AI 当场 review；作答与 review 记录按规范回填到本文件每题之下。全部完成后打磨并发对比话术 +
> 收尾"最容易说错的5句"（2026-09-05 校准：完整错误 27 条见文末复盘；精选防错 10 句与并发话术
> 见文末「收尾一 / 收尾二」，数量由实测证据校准而非沿用原「5」）。
>
> 落盘：2026-09-03（W12 D4，Asia/Shanghai）。本文件是题库原文，答案由本人产出，AI 不预填。
> 每题回填区格式：本人作答（输出预测 / 为什么 / JS 对照 / 不确定点）→ AI review 结论 → 讲解要点。
> 此处逐题记录为 2026-09-05 起由 AI 回填；AI 不代写本人作答。

---

## Q1. 真值与 None

```python
values = [0, 1, "", "a", [], [0], None, {}, 0.0]
for v in values:
    print(bool(v))
```

逐个判断 True/False。Python 的 falsy 集合和 JS 的 falsy 集合有什么不一样（尤其空容器、浮点数）？

### 回填（2026-09-05 W12 D6）

**本人作答**：预测 `0→False, 1→True, ""→False, "a"→True, []→False, [0]→True, None→False, {}→True, 0.0→True`。
判定依据说不准，按 JS/TS 经验迁移；不确定 Python falsy 规则的实际机制。

**AI review**：前 6 项与 None 判定正确；`{}` 与 `0.0` 两项事实错误（实际均 `False`）。

**讲解要点**：

- Python 的 falsy 不是固定清单，而是由对象方法决定：`bool(x)` 优先调用 `x.__bool__()`；未定义时回退到 `x.__len__()`，长度 `0` 即为 False；两者都没有的对象恒为 True。所以"空容器"（`[]`/`{}`/`()`/`set()`/`""`）全部 falsy，是"长度 0"这条规则的推论。
- 数值零：`0`、`0.0`、`0j` 都 falsy；非零浮点数 truthy。JS 里没有独立的浮点零问题（`0.0 === 0` 同值），这点 Python 与 JS 结果一致，不是语言差异，是漏了浮点零。
- 与 JS 的差异集中在**空容器**：JS 中 `[]` 与 `{}` 都是 truthy，Python 中空容器 falsy；JS falsy 是固定集合（`false/0/-0/0n/""/null/undefined/NaN`），Python 则是可被 `__bool__`/`__len__` 扩展的机制，还包含 `None`（JS 无直接对应，最接近 `null`/`undefined`）。

**概念追问（本人 → AI）**：本人把 `bool(x)` 的规则理解为「Python 默认参数为 True，判断出现问题才转为 False」。

**AI 澄清**：方向对一半，措辞需修正。fallback 确实是 True；但不是「出现问题才转 False」。准确的图像是「对象有没有表达真假的能力」：实现 `__bool__` 的对象自己回答；只实现 `__len__` 的语言替它算 `len(x) > 0`；两者都没有的对象无法回答，语言按默认 True 兜底。`{}` 判 False 不是因为"出问题"，而是 `dict` 会通过 `__len__` 报出 0。修正后能解释 Q1 两个错误根源：容器 truthiness 由长度协议决定，与"是不是对象"无关；数值零由 `__bool__` 自述为假。JS `{}`/`[]` 恒 truthy 与 Python 自定义对象默认 True 是同一逻辑（无协议就默认真），差异只在 Python 给内建容器装了长度协议。

**本人理解确认**：本人表示大致理解（未做一句话复述，直接进入 Q2；理解核验顺延至题库收尾检查）。

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

### 回填（2026-09-05 W12 D6）

**本人作答**：Q2a 先预测「像 JS 数组一样修改成功，结果为 (99,2,3)」；看到追问后自我修正为「会报错，应类比 const 数组」。Q2b 看不出 d 与 s 的区别，不确定 tuple/dict/set 是什么；知道 JS Set 是集合，但不理解「字面量」。

**AI review**：Q2a 最终答案（报 TypeError）正确，但修正所依赖的 JS 类比错误——JS `const` 数组内容可变（实测 `const a=[1,2,3]; a[0]=99` 不报错），`const` 只禁止重新绑定不禁止修改内容，这同时修正了一个 JS 侧认知偏差。Q2b 未答出：`s` 与 `d` 写法相同，都是 dict。

**讲解要点**：

- Python tuple 是不可变序列，`a[0]=99` 抛 `TypeError: 'tuple' object does not support item assignment`。最接近的 JS 类比是 `Object.freeze([...])` + 严格模式（赋值抛 TypeError），或概念上的固定记录；`const` 数组不是好类比。
- dict 与 set 共用花括号语法，判定规则：条目标目带冒号（`键: 值`）→ dict；无冒号 → set。`{}` 是空 dict（历史遗留），空 set 必须写 `set()`。
- dict 概念上承担 JS 对象/Map 的职责；set 对应 JS `Set`。JS 的 Set 无字面量（必须 `new Set()`），Python set 有字面量（`{"a"}`）；「字面量」= 直接在代码写出的语法，不经过构造器。
- 容易踩坑：`{"a"}` 是含一个元素 `"a"` 的 set，`{"a": 1}` 是含一个键值对的 dict，空集合只能 `set()`。

**概念追问（本人 → AI）**：
- 问：如何区分 list 和 tuple？
- 答：三层区分。语法层看括号：`[]` list、`()` tuple。语义层是本质：list 可变、tuple 不可变，tuple 因此可哈希（能做 dict key / set 元素），list 不能。用途层：list 动态收集元素（同 JS 数组），tuple 存固定结构（坐标、多返回值）。坑：`(1)` 是 int（括号是数学分组），`(1,)` 才是单元素 tuple；空 tuple 是 `()`。JS 没有语法上分开的两种数组，数组天生可变，要只读需自己 `freeze`；Python 把「可变数组」和「不可变数组」做成两个类型并用解释器强制。
- 问：Q2 整体暴露的语法知识欠缺是哪些？
- 答：按暴露程度排序——① Python 容器四件套类型地图缺失（list/tuple/dict/set 对应 JS 什么、各自语义空白）；② 不可变性作为类型属性及连带影响（哈希、能否做 key）的直觉未建立；③ 字面量细节：`{}` 同时承载 dict/set 语法、空 set 必须 `set()`、单元素 tuple 要逗号；④ JS 侧认知偏差：`const` 数组内容可变；⑤ 「字面量」术语不熟。核心记忆锚：Python 用括号形状和冒号有无区分四种容器，并用不可变性把可变数组拆成 list/tuple 两个类型。

**本人理解确认**：本人确认 Python 空 set 必须写 `set()`，因为 `{}` 是空 dict。

**概念追问 2（本人 → AI）**：
- 问：dict 与 set 的关键区别未与第一次作答整合；为什么四件套放在一题考察？
- 答：① 与首次作答整合——本人「看不出 d/s 区别」的直觉正确，d 与 s 本就是同一种 dict，陷阱来自两处：变量名 `s` 暗示 set，以及 Python 的 `{}` 确实可能承载 set。类型由字面量决定不由变量名决定。dict 与 set 语义上清楚（dict 存键值映射、set 存裸元素、都基于哈希表），混的是语法层：花括号被两种类型复用，冒号有无是唯一分界。JS 中 `{}` 恒为对象、Set 必须 `new Set()`，因此 JS 开发者从不需要分辨「这个 `{}` 是 dict 还是 set」，迁移时容易漏掉这条分界线。② 出题逻辑——list↔tuple 构成可变性轴（同是有序序列，一个可变一个不可变）；dict↔set 构成哈希容器轴（一个存键值、一个只存裸元素）；JS 的 array/object/Map/Set 与 Python 四件套映射线交错（tuple 与 set 字面量是 JS 侧没有的语法），放一题考的是「有没有容器地图」，不是四个孤立记忆点。

**JS 侧容器补充（本人请求，ES6-ES9 关联）**：
- 本人 JS 10 年但对 Map 使用少、Set 使用多（去重场景）。
- Python dict 语义边界 ≈ JS Map（任意 hashable key、3.7+ 保证插入序、`d.items()` 遍历、`len(d)`），语法外衣像 Object 字面量；即 Python 没有「Object vs Map」的二选一，dict 默认就是加强版 Map。Python 的 key 可哈希规则对应 JS Map 的任意 key（均不限字符串）。
- 关键差异：JS Set 保插入序（`[...new Set([3,1,2])]` → `[3,1,2]`），Python set 不保序（哈希表、无 dict 的保序承诺）。「去重且保留原顺序」在 JS 白送，Python 需 `list(dict.fromkeys(arr))` 利用 dict key 唯一 + 保序。
- ES 特性伏笔（对应后续题，不在 Q2 展开）：ES7 `**` 幂运算符对应 Python `**`（兼作 dict 解包，Q6 `**kwargs` 用）；ES8 `Object.entries()` 是 Python `dict.items()` 的 JS 侧同类；ES8 `async/await` 留待 Q10 与 asyncio 对照；ES9 对象 spread `{...a, b}` 对应 Python `{**d, "k": v}` dict 合并。

---

## Q3. Comprehension

```python
nums = [1, 2, 3, 4, 5]
result = [n * 2 for n in nums if n % 2 == 0]
```

等价于哪两个 JS 方法链在一起？`result` 最终是什么？

### 回填（2026-09-05 W12 D6）

**本人作答**：JS 等价为 `nums.filter(n => n % 2 === 0).map(n => n * 2)`；`result` 为 `[4, 8]`。执行顺序描述为「先判断 for n in nums 是否为 nums 中的值，再判断 if 能否被 2 整除，得到临时数组后进入 n * 2」。并自疑「使用的是 filter 与 map 语法，不一定符合 python 的运算逻辑」。

**AI review**：三个结论（JS 等价、`[4,8]`、先过滤后映射的方向）全部正确，实测一致。一处表述偏差：把 `for n in nums` 的 `in` 理解成「判断 n 是否在 nums 中」——for 循环里 `in` 是迭代（依次取元素赋给 n），不是成员测试；成员测试是独立表达式 `n in nums`。Python 用同一个 `in` 表达两种语义，JS 则分开（`for...of` vs `includes()`），这是 JS 迁移者容易混的点。

**讲解要点**：

- list comprehension 结构：`[表达式① for 变量② in 可迭代对象 if 条件③]`；执行顺序是 ②→③→①（先遍历、再过滤、最后对通过的求表达式收集）。语法书写顺序 ≠ 执行顺序，表达式写在最前但最后执行，JS 没有前置表达式的数组写法，是最常读反的地方。
- filter 对应 if 条件，map 对应前置表达式；`filter().map()` 是完全正确的 JS 等价，无需自疑。
- 不是真的先生成临时数组再映射：语义等价 filter→map 链，实现是单次遍历直接收集。
- comprehension 有 list/dict/set/generator 四版：`[expr for ...]`、`{k: expr for ...}`、`{expr for ...}`、`(expr for ...)`，骨架相同、外层容器不同。

**概念追问（本人 → AI）**：
- 问：comprehension 是什么意思？
- 答：词源来自数学的 set-builder notation（集合构造式）与 axiom of comprehension（概括/分离公理）——用一条规则描述「从集合中选什么、变成什么」，而非逐个列举。Python 的 `[n*2 for n in nums if n%2==0]` 是该记号的直译：输出表达式（最前）→ 来源（for）→ 过滤条件（if），中文常译「列表推导式/生成式」。核心心智模型是「声明结果长什么样，容器被整体构造」，不是命令式循环 push。JS 标准无 comprehension 语法（Firefox 曾有、提案被撤回），等价功能只能靠 `filter().map()` 方法链表达——所以 JS 迁移者看到 comprehension 会自动翻译成 filter/map 链，Q3 的直觉正确；只需记住过滤在映射之前执行，与 `filter().map()` 顺序一致。

**本人理解确认**：本人确认「先遍历 → 再 if 过滤 → 最后算 n*2」的执行顺序与自己的理解一致；comprehension 术语已通过上述讲解建立。

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

### 回填（2026-09-05 W12 D6）

**本人作答**：`a[1:4]` 预测 `[1,2,3,4]`、`a[:3]` 预测 `[0,1,2,3]`（end 按包含理解）；`a[::2]`、`a[::-1]` 标注无法从 JS slice 经验推断，但凭题目提示猜测 `[0,2,4]` 与反转 `[5,4,3,2,1,0]`。半开区间不确定，自认「不具备相关知识」；JS slice 只知道传 start/end，不支持步进，反转写法忘记。

**AI review**：前两行 end 边界错误（实测 `a[1:4]`→`[1,2,3]`、`a[:3]`→`[0,1,2]`），但关键结论是——JS `slice(start,end)` 同样是半开区间，实测 `[0,1,2,3,4,5].slice(1,4)`→`[1,2,3]`，与 Python 边界规则一致。因此这不是 Python 新知识，而是 JS slice 边界记忆需校正；本人把两边都当未知，但 JS 侧本可用 10 年经验推出。后两行猜测正确：`a[::2]`→`[0,2,4]`、`a[::-1]`→反转。诚实标注不确定的行为符合契约。

**讲解要点**：

- Python `[start:end:step]` 与 JS `slice(start,end)` 边界同规则：end 不包含（半开区间 `[start,end)`），`slice(1,4)` 与 `a[1:4]` 都取下标 1,2,3。
- 省略规则：start 缺省=0（step 为负时=末尾），end 缺省=末尾；负 step 时 start/end 缺省值互换语义（从尾往前）。
- JS slice 只有 start/end，无 step；跳步需 `filter((_,i)=>i%2===0)` 或循环，反转需 `a.slice().reverse()` 或 `[...a].reverse()`（`reverse()` 改原数组，须先拷贝）。
- 负数索引：Python `a[-1]` 是常态；JS `a[-1]` 是 undefined（按字符串属性找），ES2022 才有 `a.at(-1)`。

**概念追问（本人 → AI）**：无。

**本人理解确认**：本人确认 Python `a[1:4]` 与 JS `[0,1,2,3,4,5].slice(1,4)` 都取下标 1、2、3，end 不包含、都是半开区间。

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

### 回填（2026-09-05 W12 D6）

**本人作答**：Q5a 预测输出 `0 a / 1 b / 2 c`、i 从 0 开始（正确）；enumerate 作用猜测「校验格式，类似 typeof」（错误）；JS 写法答「for 循环输出下标和 value」（方向对、可精确化）。Q5b 预测输出 `a 10 / b 20`、按下标匹配、长度不等时超出部分裁剪（均正确）；JS 模拟答 for 循环（方向对）。两小问均自认不确定、基于推测作答。

**AI review**：输出预测与配对语义全部正确（实测一致）。两个概念缺口：① enumerate 是编号器，不是校验器——逐个产出 (index, element) 元组消灭手动 counter，JS 精确对应是 `names.entries()` 或 `forEach((name,i))`；② **参数顺序坑**：Python `enumerate` 是 (index, value)，JS forEach/map 回调是 (value, index)，顺序正好相反，迁移者易写反导致不报错的错位。zip 语义正确：按下标配对成元组，长度取最短（实测 `zip(['a','b','c'],[10,20])` 丢弃 'c'）。

**讲解要点**：

- `enumerate(names)` = 编号器，产出 (index, element) 元组；无它时代价是手动 counter（i=0; i+=1）。JS 精确对应 `.entries()` 迭代器。
- 参数顺序坑：Python `for i, name in enumerate(...)` 是 index 在前；JS `forEach((name, i))` 是 value 在前。两边都是解构两个变量但顺序相反。
- `zip(a, b)` = 按下标配对成元组，结果长度 = 最短者；JS 无内建，`Array.from({length: Math.min(...)}, (_,i)=>[a[i],b[i]])` 是最接近语义的模拟（裸 map 以单侧为基准会有 undefined 风险）。
- enumerate/zip/range 都是**惰性迭代器**（按需产出），不是一次性算好的列表——与 JS generator 类似，与数组方法链不同；此概念在后续题反复出现。

**概念追问（本人 → AI）**：
- 问：enumerate/zip 算 Python 语法糖吗？标题写 range 但代码为何没考 range？
- 答：术语上不算。语法糖是语法层面的简化写法（可脱糖），如 comprehension→for+append、`a,b=b,a`→临时变量交换、`@decorator`→`f=decorator(f)`、with→try/finally；enumerate/zip/range 是内建函数/类型（普通函数调用），消灭样板的方式不同——语法糖靠改写法，迭代工具靠把常用迭代逻辑封装进内建对象。Q5 标题含 range 但两段代码均未使用，属标题比代码宽的真实不一致；range 在题中的结构性位置是 zip「手动 index 等价写法」里的数字源（`for i in range(min(len(...)))`）。
- range 补讲：`range(5)` 是惰性等差序列对象（不是列表），半开区间 `[start,stop)` 与 Q4 切片同规则；JS 无内建，最接近是计数器 for 循环或 `[...Array(n).keys()]`。JS「循环 N 次」`for(let i=0;i<N;i++)` 在 Python 是 `for i in range(N)`——把计数器+条件+递增压缩成可迭代对象。历史坑：Python 2 range 返回真列表、xrange 为惰性版，Python 3 合并为惰性 range，读到老代码出现 xrange 时知其为 Python 2 时代产物即可。

**本人理解确认**：本人确认 Python `enumerate` 是 (index, value)，JS `forEach`/`map` 是 (value, index)——顺序正好相反。

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

### 回填（2026-09-05 W12 D6）

**本人作答**：Q6a 预测 Python 输出 `['a']`、`['a','b']`（结果正确），判断「与 JS 一样」，理由「my_list 已创建为变量，第二次调用给其追加 b」（机制理解不完整）。Q6b 自认不确定，标注 JS 相关用法也不清楚、需要较多讲解。

**AI review**：Q6a Python 结果答对但 JS 对比判断错误——实测 JS 两次输出 `['a']`、`['b']`（不累积）。关键差异是默认参数求值时机：Python 的 `my_list=[]` 在 `def` 语句执行时创建一次、由函数对象持有、所有未传参的调用共享同一列表对象 → 累积；JS 的 `myList=[]` 每次调用重新求值 → 隔离。Q6b 实测输出 `1 2 (3, 4) {'x': 5, 'y': 6}`。

**讲解要点**：

- Python 默认参数在 def 时求值一次并绑定到函数对象；JS 默认参数每次调用重新求值。Python 侧正确写法用 None 哨兵 + 函数体内建空列表。
- Q6b 参数分配：a=1、b=2（显式传 2 覆盖默认值 10）、`*args` 收多余位置参数为**元组** `(3,4)`、`**kwargs` 收未匹配关键字参数为 **dict** `{'x':5,'y':6}`。
- JS 对应：`*args` ≈ rest 参数 `...args`（数组）；`**kwargs` 无完全等价，JS 用「命名参数 + 最后一个 options 对象」惯例模拟。
- `*`/`**` 调用侧反向用法：`f(*nums)` 列表解包成位置参数、`f(**d)` dict 解包成关键字参数，呼应 ES9 对象 spread。记忆锚：定义时收（元组/dict），调用时解包，同一对符号两个方向。

**概念追问（本人 → AI）**：
- 问：关键字参数和 *args 的判定标准是什么？元组是什么？调换顺序 `f(1, 2, x=5, y=6, 3, 4)` 输出会变吗？JS 的 ...args 用法忘记了，options 参数能理解。
- 答：① 判定标准只有一条——实参写法带不带 `名字=`。位置参数按顺序喂具名形参（a、b），喂剩的进 `*args`；关键字参数先按名字匹配具名形参，匹配不到名字的才进 `**kwargs`（实测 `f(a=1, x=5)` → a=1、x 进 kwargs）。对称总结：`*args` 收「多出来的位置参数」、`**kwargs` 收「叫不出名字的多余关键字参数」。② 元组即 Q2 学过的不可变序列，`*args` 收集容器固定是 tuple，`**kwargs` 固定是 dict。③ 调换顺序 `f(1,2,x=5,y=6,3,4)` 是 SyntaxError（positional argument follows keyword argument），编译期即失败、try 拦不住（实测整个脚本编译崩）；规则是位置参数必须全部在关键字参数之前，否则解释器无法判断位置归属。关键字参数可以乱序（实测 `f(b=2,a=1)` 合法），因为按名字认领。④ JS 对照：Python 定义处 `*args` ≈ JS rest（`function f(a, b=10, ...args)`、解构 `const [first, ...rest]`），调用处 `f(*nums)` ≈ JS spread（`f(...nums)`），同一符号靠「定义/调用」区分；区别是 JS 收进数组、Python 收进元组。Python `**kwargs` 等价物即本人熟悉的 JS options 对象模式，只是 Python 语法级收成 dict、无需手动声明最后一个参数。

**复习资产：参数分流全景图（本人两次误判后补充）**

```text
第 1 步 调用侧：实参按写法形态自动分成两堆
  f( 1,  2,  3,  4,  x=5,  y=6 )
     └─────┬──────┘   └───┬────┘
      位置参数堆         关键字参数堆
     （没有名字=）      （带名字=）
      只能整体在前         只能在后
  铁律：位置参数堆必须整体在关键字参数堆之前；
        从左到右一旦见到第一个 名字=，后面不允许再出现裸值
        （SyntaxError: positional argument follows keyword argument）

第 2 步 定义侧：形参是一排接收闸门
  def f( a,   b=10,   *args,     **kwargs )
        │     │        │           │
      第1闸  第2闸   位置溢出袋   关键字杂物袋
      必填   有默认   (tuple)      (dict)
      按位置接 按位置接  接位置多余的   接名字没人认领的

第 3 步 匹配流水线（两次扫描，顺序固定）
  第 1 趟：位置参数堆按顺序喂具名闸门，喂满后多的掉进 *args
  第 2 趟：关键字参数堆按名字找闸门认领，没人认领的掉进 **kwargs
  核心：两个袋子都装"没被闸门接住的剩货"，来源不同
```

- 关键字参数可乱序（按名字认领，实测 `f(b=2,a=1)` 合法）；位置参数顺序即一切。
- `f(x=5, 1, 2, y=6)` 非法不是 `2` 的问题，是 `1` 在关键字参数之后以裸值出现；裸值必须全部站在第一个 `名字=` 之前。
- JS 对照：`*args` ≈ rest 参数（数组 vs 元组）；`**kwargs` ≈ 本人熟悉的 JS options 对象模式（语法级自动收集成 dict）。

**四轮纠错汇总（2026-09-05 W12 D6，参数分流未掌握证据）**

| # | 本人判断的调用 | 实际结果 | 错误认知 | 真实规则 |
|---|---|---|---|---|
| 1 | `f(x=5, 1, 2, y=6)` 合法 | SyntaxError | 不知道裸值必须整体在前 | 裸值（位置参数）必须全部站在第一个 `名字=` 之前 |
| 2 | `f(1, 2, 3, x=5)` 中 `args=5` | `args=(3,)` | 关键字 `x=5` 的值 `5` 被当成会进 args | `*args` 只装多余的裸值；`5` 是关键字参数的值，跟着名字进 `**kwargs` |
| 3 | `f(1, 3, 4, b=2)` 合法 | TypeError: multiple values for 'b' | 不知道位置和关键字会撞同一形参 | 每个形参只能被赋值一次，位置或关键字二选一 |
| 4 | `f(b=2, a=1, 3)` 合法 | SyntaxError | 把「关键字参数之间可乱序」泛化成「所有实参可乱序」 | 乱序只适用于关键字之间；裸值的位置优先级最高，永远在最前 |

- 三层规则（可由一个原理推导：裸值靠"第几个"定位、带名值靠"名字"定位）：
  ① 裸值堆整体在最前；② 关键字之间可乱序、按名字认领；③ 每个形参只能被赋值一次。
- 根因：三次（#1/#3/#4）都在「写一个读起来自然的调用」而不是「先检查是否违反规则」——Python 函数调用合法性判定是规则驱动的，不是直觉驱动的。
- 附带修正：tuple ≠ Set。tuple 是不可变有序序列（≈ `Object.freeze([...])`），Set 是去重无序集合；`*args` 容器是 tuple。
- 合法实例：`f(1, 2, 3, x=5, y=6)` → `a=1, b=2, args=(3,4), kwargs={'x':5,'y':6}`。

**本人理解确认**：本人确认——「位置参数靠顺序配对，关键字参数靠名字配对，因此 1,2,3 是位置参数，x=5、y=6 是关键字参数」。用词已对齐官方术语（位置实参/关键字实参），分类依据为实参书写形式、与值类型无关。

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

### 回填（2026-09-05 W12 D6）

**本人作答**：预测输出 `true / false / false`。理由：`==` 比较值、`is` 比较是否同一对象。JS 对照：`===` 比较值严格相等，认为更贴近 Python `==`；`is` 认为 JS 无对应。

**AI review**：第 1、2 行正确（实测 `a==b` True、`a is b` False）；第 3 行错误（实测 `a is c` **True**），且与本人自述理由矛盾——`c=a` 是引用赋值不创建新对象，a 与 c 指向同一列表，本人理由正确但应用错误。JS 对照方向对一半需精化：JS `===` 是分裂的——对原始值比较值（近 Python `==`），对对象比较引用（**正是 Python `is` 的语义**，实测 `a===c` true、`a===b` false），因此「is 在 JS 无对应」不准确。

**讲解要点**：

- `c = a` 不复制列表，只是让 c 引用 a 的同一对象（与 JS `const c = a` 相同）。
- 三层映射：Python `==`（list 逐元素值比较）在 JS 中没有内建数组值比较，需 `JSON.stringify` 或手写遍历；Python `is`（身份比较）≈ JS `===` 应用于对象；JS `===` 应用于原始值才是值比较。
- 最值得记住的差异：Python `[1,2,3] == [1,2,3]` 是 True；JS `[1,2,3] === [1,2,3]` 是 false（引用比较）。
- 隐藏一致性：Python `==` 对未实现自定义比较的类默认退化为身份比较，与 JS 对象无值比较、`===` 即引用比较同一精神。

**概念追问（本人 → AI）**：
- 问：`c = a` 是同一个对象，是因为这个赋值方式使得 a 与 c 指向同一个内存地址吗？
- 答：方向正确，需区分语言语义与实现细节。实测 `id(a)==id(c)==4309089856`、`id(b)` 不同、`a is c` True。官方术语：Python 变量是名字（name）不是容器；`a = [1,2,3]` 是创建对象并把名字 a 绑定（bind）到它；`c = a` 是把名字 c 绑定到 a 当前绑定的同一对象，不创建不复制。`is` 比较对象身份（object identity）；`id()` 返回对象身份，CPython 中实现为内存地址——这是实现细节，语言只承诺同一对象 id 恒定、不同对象 id 不同。面试标准答法：`is` 比较对象身份，不是比较内存地址。

**本人理解确认**：本人确认 `c = a` 是给同一对象加第二个名字（引用绑定，非复制列表），修改通过 c 进行会同时反映在 a 上——二者是同一对象，不是两个内容相同的副本。

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

### 回填（2026-09-05 W12 D6）

**本人作答**：行为预测输出 `c = 2`（值正确，表述应为输出 `2`）。JS 翻译尝试未完成，自标语法不熟。`__init__` 判断为「类似 JS main 函数」（错误）。`self` 对应 `this`（方向正确），是否完全一致不确定；显式 self 原因「与 class 定义语法有关，不确定」。JS 侧写了 `let self = this` 与 `constructor Counter()`（均有偏差）。

**AI review**：输出 2 正确——关键在 `c.increment()` 被调用两次，第一次返回值未接住。`__init__` 不是 main：它是构造器，实例创建时自动调用、初始化属性，对应 JS `constructor`。`self` 对应 `this` 方向对，但机制不同：Python `self` 是普通参数名（非关键字、可改名、约定俗成），`c.increment()` 等价于 `Counter.increment(c)`——实例作为第一个实参隐式传入；JS `this` 是关键字、由调用方式动态决定。JS 翻译偏差：constructor 不加类名；class 方法内不需要 `let self = this`（那是 ES5 保存 this 的旧习惯）。

**讲解要点**：

- `__init__` ≠ main。Python 里 `__init__`（构造器）、`__init__.py`（包标记文件）、`__main__`/`if __name__ == "__main__"`（执行入口）是三件事，相似下划线符号易混。
- `self` 不是关键字，是方法定义第一个参数名（约定俗成）。`c.increment()` 是 `Counter.increment(c)` 的语法糖。
- JS 对照：`constructor` ↔ `__init__`；`this` ↔ `self`（但 this 是关键字、动态绑定，self 是普通参数、隐式传入）。
- 完整 JS 等价：`class Counter { constructor(start=0){ this.count=start; } increment(){ this.count+=1; return this.count; } }`；`new Counter()`。

**概念追问（本人 → AI）**：无。

**本人理解确认**：本人确认 Python 的 `self` 是普通参数名，必须显式出现在参数列表里接收被隐式传入的实例；JS 的 `this` 是关键字，不需要也不能声明，由调用上下文自动填充。

**JS class 复习与综合对照（本人要求补充）**：

JS class 最小形态（实测输出 2、`c.count` 为 2、`c instanceof Counter` 为 true）：

```js
class Counter {
  constructor(start = 0) {   // 构造器：new 时自动调用，不带类名
    this.count = start;      // 在实例上创建属性
  }
  increment() {              // 方法：不需要 function 关键字
    this.count += 1;
    return this.count;
  }
}
const c = new Counter();     // 实例化必须用 new
c.increment();
console.log(c.increment());  // 2
```

- 语法要点：constructor 是固定名字不带类名（本人 Q8 曾写 `constructor Counter()` 为错）；class 方法不写 `function`；`new` 做三件事——创建空对象、调用 constructor 且 this 指向它、返回该对象；实例属性在实例上、方法在原型上（可暂不深究）。
- 本人 Q8 偏差修正：`let self = this` 不需要（class 方法内 this 已正确绑定，`var self = this` 是 ES5 回调时代旧习惯）；方法不是变量赋值，不能塞进 constructor 体内。

**综合判断（JS class vs Python class 差异本质）**：

> JS 的 class 是原型继承的语法糖，方法靠关键字 `this` 隐式获得调用者；Python 的 class 是真正的类，方法靠普通参数 `self` 显式接收实例。前者依赖调用方式，后者依赖参数传递。

- 差异一（实例从哪来）：JS 必须 `new`（负责创建对象并绑定 this）；Python `Counter()` 直接调用，`__init__` 第一个实参即新实例。
- 差异二（方法如何知道归属）：JS `this` 由调用语法决定（点在谁身上就是谁），方法脱离对象调用即丢失；Python `c.increment()` ≡ `Counter.increment(c)`，实例作为第一个实参显式传入，抽出后手动补实参仍可用。
- 差异三（为何一个写 self 一个不写）：`this` 是关键字、语言自动填；`self` 是普通参数名、必须显式接收被隐式传入的实例。写 self 的代价是啰嗦，收益是方法不依赖调用上下文绑定。
- 面试标准答法：「Python 的方法只是接收实例作为第一个参数的普通函数，self 是那个参数的约定名字；实例化与调用都基于参数传递，不依赖 JS this 那样的动态上下文绑定。」

---

## Q9. Type hints（对照 TS）

```python
def greet(name: str, age: int = 18) -> str:
    return f"{name} is {age}"

greet("Tom", "not a number")
```

这行调用在 TypeScript 里会怎样？在 Python 里会怎样？两者对"类型"的**约束力**有什么本质区别？

### 回填（2026-09-05 W12 D6）

**本人作答**：TS 中类型不匹配会编译报错（正确）；Python 中「应该也会报错」（错误，实际正常运行）；判断 Python type hints 是编译期检查、强制性（错误）。

**AI review**：TS 判断正确；Python 行为判断错误——实测 `greet("Tom", "not a number")` 正常运行输出 `Tom is not a number`，解释器不检查类型。`age: int` 的 `: int` 是元数据（annotation），运行时存入 `greet.__annotations__`，不参与字节码编译、不产生检查。Python 无编译期类型检查；type hints 是 PEP 484 渐进式类型，强制方是外部静态工具（mypy/pyright），不是语言本身。TS 翻译有语法错误（`=> return` 不合法），正确形态 `function greet(name: string, age: number = 18): string { return ... }`。

**讲解要点**：

- Python type hints 运行时行为：存为 `__annotations__` 字典元数据，解释器不检查、不拦截。
- TS vs Python 本质区别：TS 类型在编译期强制（tsc 报错不产出 JS），是语言的一部分；Python type hints 无牙齿，强制方是约定 + 外部静态工具。
- 渐进式类型（gradual typing）：动态类型语言给愿意用者提供的静态检查选项，不强迫所有人。
- 记忆锚：TS 的类型是栅栏（编译期强制）；Python 的 type hints 是便利贴（只有外部工具会看）。
- TS 正确对照写法：`function greet(name: string, age: number = 18): string { return \`${name} is ${age}\`; }`。

**概念追问（本人 → AI）**：
- 问：Python 相当于没有 TS 的强制类型检查，是不是更接近 JS？
- 答：运行时语义上对——Python 与 JS 同为动态类型、运行前不拦类型错误；但需精化：Python 不是「没有强制类型检查」，而是「默认不强制但语言内建可选静态层」。JS 语言本身无任何类型注解语法（要静态检查只能换 TS）；Python 语言内建 type hints（PEP 484，运行时存 `__annotations__`），是否强制取决于是否运行 mypy/pyright——同一份代码不改即可选择被静态检查，不需换语言。这正是渐进式类型（gradual typing）：Python = 动态类型 + 可选静态标注，代码不变、工具决定检查强度；TS = 加了类型的 JS 超集，tsc 是必经步骤、语言决定强度。三者排布：JS = 无类型层；Python = 有可选类型层（默认关）；TS = 有强制类型层（默认开）。

**本人理解确认**：本人确认 Python 运行时更像 JS，但多了一层 JS 没有的可选静态类型层（type hints + mypy/pyright），无需换语言；`age: int` 这类标注是写给开发者与静态工具的元数据，实际传非 int 时 Python 运行时不会报错。

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

### 回填（2026-09-05 W12 D6）

**本人作答**：Q10a 预测「A、B 会并发执行，顺序 A start, B start, B end, A end」，称 asyncio 特点是「可以串行执行」（用词反了）。Q10b 预测换成 asyncio.sleep 后顺序变为 A start, A end, B start, B end。Q10c 承认 GIL 含义不确定、Python 与 Node 并发不是同一件事但原因不记得，仅提 libuv 处理 io 与线程。

**AI review**：Q10a/Q10b 答案正好互换。原题用 `time.sleep`（同步阻塞，卡线程+卡事件循环），实测串行 A start→A end→B start→B end，总 3s；本人预测的交错顺序恰好是 `asyncio.sleep` 版的结果。Q10b 换 `asyncio.sleep` 后实测交错 A start, B start, B end, A end，总 2s——本人预测成串行了。核心误区：asyncio 特点是**并发（concurrency）**非串行；`time.sleep` 同步阻塞不让出，`asyncio.sleep` 异步挂起让出控制权给事件循环。Q10c 方向正确（两者并发不是同一件事）但机制记忆需激活。

**讲解要点**：

- `time.sleep` = 同步阻塞（卡线程、卡事件循环）→ async 函数内的任何同步操作都会阻塞整个事件循环；`asyncio.sleep` = 异步挂起（让出控制权）。
- 对照 Node：async 函数里调用同步 `fs.readFileSync` 同样卡整个进程——同步调用在事件循环模型里会阻塞，Python/Node 皆然。
- GIL（Global Interpreter Lock）：CPython 机制，同一时刻只有一个线程能执行 Python 字节码；多线程跑 CPU 密集代码无真正并行。
- Python 并发三工具：多线程 threading（I/O 密集，GIL 下 I/O 时释放锁可交错）、asyncio（I/O 密集，单线程事件循环+协程让出）、多进程 multiprocessing（CPU 密集，绕开 GIL）。
- Q10c 结论：Python asyncio 与 Node 事件循环的协作式并发（cooperative concurrency）是同一件事；但 Python 并发版图比 Node 宽——有线程（受 GIL 限制）与多进程（绕开 GIL），Node 单线程为主。Node 无 GIL 问题因其默认单线程；Python 有线程但不允许并行执行字节码。

**概念追问（本人 → AI）**：
- 问 1：time.sleep 串行、asyncio 并发，是否只是记错「串行」词义？答：是，串行=一次一个推进，并发=交错推进，已修正。
- 问 2：讲解中「async 函数跑在同一线程」里的 async 是否指 JS 的 async/await？答：不是——Q10 全程是 Python 代码（`async def` + `asyncio.run`）。「单线程+事件循环+协程让出」不是 JS 独有，Python asyncio 也是同一架构；协程们共享事件循环所在的那一条线程。这正是 Q10c 的「相似层」。
- 问 3：是否应尽量用异步操作避免进程卡死？答：工程倾向对，补边界——只有「等待外部资源」的 I/O 类操作能通过让出获益（网络/磁盘/睡眠）；纯 CPU 计算不等待任何东西，异步无意义、照样卡事件循环。第三方同步 API 在 async 里直接调用会阻塞事件循环，需 `asyncio.to_thread(...)` 丢给线程池。
- 问 4：Node 无 GIL 是否因为「没有多线程能力」？答：结论对但理由错。Node 有线程（libuv 线程池处理 fs/crypto/DNS、worker_threads 可做 CPU 并行）；无 GIL 的真正原因是 JS 主执行单线程、不存在多线程竞争同一份解释器状态的场景，故不需要 GIL 保护。Python 多线程共享解释器才需要 GIL。

**本人理解确认**：本人确认 Q10 的 async 是 Python 的（非 JS）；Node 无 GIL 的真正原因是 JS 主执行单线程、无竞争、不需 GIL 保护。


---

# 复盘：Q1-Q10 完整错误清单（2026-09-05 W12 D6）

> 来源：本文件各题回填区中本人实际说错 / 判错的表述（逐题 review 已记录）。用途：完整错误资产；
> 后续从其中挑选「面试压力下最容易脱口而出」的句子做防错演练，挑选与数量由本人决定。

| # | 出处 | 本人说错 / 判错的表述 | 正确表述 |
|---|---|---|---|
| 1 | Q1 | 空容器 `{}` 预测为 truthy | Python 空容器（`[]`/`{}`/`()`/`set()`/`""`）均为 falsy，依据 `__len__` 返回 0 |
| 2 | Q1 | `0.0` 预测为 truthy | 数值零（`0`/`0.0`/`0j`）均 falsy |
| 3 | Q2 | `s = {"a": 1}` 可能是 set（变量名 s 干扰） | 花括号内带冒号即为 dict，类型由字面量写法决定、不由变量名决定 |
| 4 | Q2 | 空 set 可以用 `{}` 表达 | `{}` 是空 dict；空 set 必须写 `set()` |
| 5 | Q2 | JS `const` 数组内容不可变 | JS `const` 只禁止重新绑定变量，不禁止修改数组内容（`a[0]=x` 合法） |
| 6 | Q2 | tuple 与 Set 混淆（Q6 再次出现） | tuple 是不可变有序序列（≈ freeze 数组），set 是去重无序集合 |
| 7 | Q3 | `for n in nums` 理解成「判断 n 是否在 nums 中」 | for 循环里的 `in` 是遍历（依次取元素赋给 n），成员测试是独立表达式 `n in nums` |
| 8 | Q3 | 自疑 `filter().map()` 不符合 Python 逻辑 | `filter().map()` 是完全正确的 JS 等价；comprehension 先过滤后映射，顺序一致 |
| 9 | Q4 | `a[1:4]` 与 `a[:3]` 的 end 按包含理解 | Python 切片与 JS `slice` 都是半开区间 `[start, end)`，end 不包含 |
| 10 | Q4 | JS `slice` 支持步进 / 反转语法 | JS slice 只有 start/end；反转需 `slice().reverse()` 或 `[...a].reverse()` |
| 11 | Q5 | `enumerate` 的作用猜测为「校验格式，类似 typeof」 | `enumerate` 产出 (index, element) 二元组的迭代器 |
| 12 | Q5 | 认为 Python 解构顺序与 JS 一致 | Python `enumerate` 是 (index, value)；JS `forEach`/`map` 回调是 (value, index)——顺序相反 |
| 13 | Q6 | 可变默认参数 `my_list=[]` 的行为判断为「与 JS 一样」 | Python 默认值在 `def` 执行时求值一次、所有调用共享（累积）；JS 默认参数每次调用重新求值（隔离） |
| 14 | Q6 | `f(x=5, 1, 2, y=6)` 认为是合法调用 | SyntaxError：位置实参出现在关键字实参之后 |
| 15 | Q6 | `f(1, 3, 4, b=2)` 认为是合法调用 | TypeError：形参 b 被位置实参 3 与关键字实参 b=2 双重赋值 |
| 16 | Q6 | `f(b=2, a=1, 3)` 认为是合法调用 | SyntaxError：把「关键字实参之间可乱序」错误泛化成「所有实参可乱序」，位置实参必须整体在前 |
| 17 | Q6 | 关键字实参的值（如 `x=5` 的 5）会进入 `*args` | `*args` 只收集多余的**位置**实参；关键字实参整体（名字+值）进 `**kwargs` |
| 18 | Q7 | `a is c`（`c = a` 后）判为 False | `c = a` 是引用绑定同一对象，`a is c` 为 True |
| 19 | Q7 | `is` 在 JS 中没有对应 | JS `===` 应用于对象时正是身份比较（Python `is` 的语义） |
| 20 | Q8 | `__init__` 判断为「类似 JS main 函数」 | `__init__` 是构造器（对应 JS `constructor`），不是程序入口 |
| 21 | Q8 | JS class 构造器写 `constructor Counter()` | constructor 是固定名字，不带类名 |
| 22 | Q9 | Python type hints 会在运行时报类型错误 | type hints 是元数据（存 `__annotations__`），运行时检查靠外部工具 mypy/pyright |
| 23 | Q10 | `time.sleep` 版认为 A、B 会并发交错执行 | `time.sleep` 是同步阻塞，卡线程与事件循环，实际串行（A→A end→B→B end） |
| 24 | Q10 | `asyncio.sleep` 版认为会串行执行 | `asyncio.sleep` 让出控制权给事件循环，实际并发交错 |
| 25 | Q10 | 认为「asyncio 特点是串行执行」 | asyncio 是并发（concurrency）：单线程事件循环 + 协程让出 |
| 26 | Q10 | Node 没有 GIL 是因为「没有多线程能力」 | Node 有线程（libuv 线程池、worker_threads）；无 GIL 的真正原因是 JS 主执行单线程、无多线程竞争解释器状态 |
| 27 | Q10 | 以为 Q10 代码里的 async 是 JS 的 | Q10 全程是 Python `async def` + `asyncio.run`；「单线程+事件循环+协程让出」是 Python asyncio 与 Node 共有的架构 |


---

# 收尾一：精选防错句（2026-09-05 W12 D6）

> 从复盘 27 条中按三条标准精选：① 压力下会脱口而出（凭 JS 直觉易说错）；② 说错会被当场识破的硬错误；
> ③ Python 面试高频。数量 10（原题库「5 句」低估，27 条全列无重点；10 为可脱口演练的量级，本人已校准确认）。

| # | 出处 | 防错句（面试时要能说对） | 入选理由 |
|---|---|---|---|
| S1 | Q1 | Python 空容器（`[]`/`{}`/`""`）都是 falsy | JS 直觉「空对象为真」最容易脱口而出 |
| S2 | Q2 | `{}` 是空 dict，空 set 必须写 `set()` | 经典送命题，两者都是高频考点 |
| S3 | Q2 | JS `const` 数组内容可变，`const` 只锁绑定 | 10 年 JS 也记错，面试会暴露 |
| S4 | Q3 | comprehension 先过滤后映射 = `filter().map()` | 曾自疑，且「推导式等价于什么」是常见题 |
| S5 | Q4 | Python 切片与 JS slice 都是半开区间 `[start, end)` | 边界题，一说「包含」立刻穿帮 |
| S6 | Q6 | 可变默认参数 `my_list=[]` 在 def 时求值一次、所有调用共享 | Python 第一经典陷阱，必考 |
| S7 | Q6 | 位置实参必须在关键字实参之前；关键字之间可乱序 | 当日四连错之根，最该防 |
| S8 | Q7 | Python `==` 比内容、`is` 比对象身份；`c = a` 后 `a is c` 为 True | 判反过的点：身份 vs 值 |
| S9 | Q9 | Python type hints 是元数据，运行时不报错，靠 mypy/pyright 检查 | 误判「运行时报错」的核心考点 |
| S10 | Q10 | async 里 `time.sleep` 阻塞整个事件循环（串行）；`asyncio.sleep` 才让出 | 并发方向题，答反过 |

---

# 收尾二：并发对比话术（2026-09-05 W12 D6，Q10c 面试回答）

> 问题：GIL 存在的情况下，Python 的"并发"和 Node 的"并发"本质上是不是同一件事？
> 用法：先按 45 秒完整版练习并录音核对，再压缩到 30 秒版；目标是不看稿能按「两层分法」讲清。

## 45 秒完整版

需要先分两层看。如果问的是 asyncio 和 Node 事件循环这一层，它们是同一件事——都是单线程事件循环 + 协作式并发：协程执行到 `await` 时把控制权交还给事件循环，事件循环去调度别的协程。所以 `asyncio.sleep` 版两个任务交错执行、总耗时接近较长任务，这就是协作式并发。

但如果把 Python 的并发版图整个拿出来，和 Node 就不一样了。Python 有三套并发工具：asyncio 是单线程事件循环；threading 是多线程，但受 GIL 限制——同一时刻只有一个线程能执行 Python 字节码，所以多线程跑 CPU 密集代码没有真正并行；要真正利用多核，得用 multiprocessing，每个进程有独立解释器，绕开 GIL。

Node 这边，JS 主执行是单线程的，不存在多线程竞争解释器状态的问题，所以根本没有 GIL 这个东西；要并行 CPU 密集任务得靠 worker_threads。

所以结论是：asyncio 与 Node 事件循环的协作式并发是同一件事；但 Python 的并发能力边界比 Node 宽——它有受 GIL 限制的线程和绕开 GIL 的进程，Node 单线程为主。一句话：GIL 限制的是 Python 多线程的并行能力，不影响 asyncio——asyncio 本来就在单线程上跑。

## 30 秒精简版

分两层：asyncio 和 Node 事件循环是同一件事——单线程 + 协作式并发，靠 await 让出。但 Python 版图更宽：threading 受 GIL 限制不能并行跑字节码，multiprocessing 才能绕开 GIL 用多核；Node 主执行单线程，没有 GIL 概念，CPU 并行要靠 worker_threads。所以 asyncio ≈ Node 事件循环，Python 整体 ≠ Node。

## 防脱口而出提醒（话术内易说错的 3 个点）

| 易说错 | 应说 |
|---|---|
| 「asyncio 是串行执行」 | asyncio 是并发（单线程事件循环 + 协作式让出） |
| 「Python 没有 GIL 问题的办法是 asyncio」 | asyncio 单线程本来就不涉及 GIL；GIL 限制的是 threading 的并行 |
| 「Node 没 GIL 因为没多线程」 | Node 有 worker_threads/libuv 线程池；无 GIL 是因为 JS 主执行单线程、无竞争 |

