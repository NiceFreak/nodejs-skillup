# Week 1 · Day 2(上午)— 索引初探:用 explain 看懂索引的价值

> **目标**:亲手造一批大数据,用 `explain` 对比「有索引 / 无索引」的执行差异,
> 把「索引到底快在哪」用具体数字钉死。

---

## 第一步 · 造一批足够大的测试数据

数据量太小,索引的差异看不出来,所以要造几万条。下面这个 `for` 循环属于样板,直接用:

```js
db.bigdata.drop()   // 先清掉可能存在的旧数据

const docs = []
for (let i = 0; i < 50000; i++) {
  docs.push({
    name: "User" + i,
    age: 18 + (i % 50),                      // 18~67 之间循环
    city: ["Guangzhou", "Shenzhen", "Beijing"][i % 3]
  })
}
db.bigdata.insertMany(docs)

db.bigdata.countDocuments()   // 确认插进去了,应该是 50000
```

跑完确认返回 **50000**。

---

## 第二步 · 测「无索引」的基线

现在 `bigdata` 上没有任何索引(除了默认的 `_id`)。对一个按 age 的查询跑 `explain`:

```js
db.bigdata.find({ age: 42 }).explain("executionStats")
```

返回内容很长,**只需要找这三个值**:

| 关注的字段 | 含义 | 基线结果 |
|---|---|---|
| `winningPlan.stage` | 用了哪种执行方式 | **`COLLSCAN`** |
| `executionStats.totalDocsExamined` | 实际扫描了多少文档 | **50000** |
| `executionStats.executionTimeMillis` | 耗时多少毫秒 | **27** |

> 先把「没有索引时有多慢、扫描了多少」这个基线钉死,等会建了索引再对比,差异才有冲击力。
>
> `COLLSCAN` = Collection Scan(全表扫描):没有索引,只能从头到尾一条条翻完整个集合。

---

## 第三步 · 给 age 建索引,再跑同样的 explain

```js
db.bigdata.createIndex({ age: 1 })          // 1 = 升序
db.bigdata.find({ age: 42 }).explain("executionStats")
```

还是找那三个值,和基线对比:

|  | 无索引(基线) | 有索引 |
|---|---|---|
| `stage` | `COLLSCAN` | **`IXSCAN`(外层套 `FETCH`)** |
| 扫描文档数 `totalDocsExamined` | 50000 | **1000** |
| 耗时 `executionTimeMillis` | 27ms | **4ms** |

`totalDocsExamined` 从 **5 万降到 1000** —— 这就是索引的核心价值:
它不再一条条翻全部数据,而是通过索引**直接定位**到 age=42 的那 1000 条
(5 万条里 age 在 18~67 循环,42 这一档正好约 1000 条)。
**扫描数从「全表」变成「正好等于结果数」,这是索引生效最硬的证据。** 耗时也跟着从 27ms 降到 4ms。

---

## 关键细节 · `FETCH` 与 `IXSCAN` 的分工

建索引后,`winningPlan` 的 stage 不是单纯的 `IXSCAN`,而是 `FETCH` 套着 `IXSCAN`:

```
FETCH
  └── IXSCAN   ← inputStage 里面这层
```

实际 explain 输出里确认到的:

```
executionStages.stage             = FETCH
executionStages.inputStage.stage  = IXSCAN
```

两层的分工(这是个值得真懂的点):

- **`IXSCAN`(Index Scan,索引扫描)**:先在索引里快速找到 age=42 对应的位置。
  索引里**只存了 age 的值和指向文档的指针**,没有完整文档。
- **`FETCH`(回表)**:拿着 `IXSCAN` 找到的指针,回到集合里把**完整文档**捞出来
  (因为 `find` 要的是整条数据,不只是 age 一个字段)。

所以 `FETCH → IXSCAN` 的意思是:**用索引定位,再回表取完整数据。**
这和无索引时的 `COLLSCAN`(直接硬扫全表)是本质区别 —— 只要看到 `IXSCAN`,就说明索引真的被用上了。

---

## 留个伏笔 · 覆盖查询(Covered Query)

> **如果查询只需要 age 这一个字段**(用投影 `{ age: 1, _id: 0 }`),
> MongoDB 还需要 `FETCH` 回表吗?还是光靠索引本身就够了?

答案下午揭晓 —— 它叫**「覆盖查询(Covered Query)」**:
当查询要的字段全都在索引里时,**可以跳过 `FETCH`、直接从索引返回结果**,连回表都省了,更快。
这是复合索引深度的一部分,先记着这个疑问。

---

## 小结

| 维度 | 无索引 | 有索引 |
|---|---|---|
| 执行方式 | `COLLSCAN`(全表扫描) | `IXSCAN` + `FETCH`(索引定位 + 回表) |
| 扫描文档数 | 50000 | 1000 |
| 耗时 | 27ms | 4ms |

**一句话**:索引让查询从「翻遍全表」变成「直接定位到目标」,
扫描量从全表降到约等于结果数,这就是它快的根本原因。
`explain("executionStats")` 是验证索引是否真正生效的标准手段。

Day 2 下午
做**复合索引的字段顺序**,顺便揭晓上午那个悬念。

还是你自己敲。现在 `bigdata` 上已经有一个 `{ age: 1 }` 索引了,我们加一个复合索引来做对比实验。

**第一步 · 建一个复合索引**

```js
db.bigdata.createIndex({ city: 1, age: 1 })
```

注意这个索引的字段顺序是**先 city,后 age**。记住这个顺序,接下来整个实验就是看这个顺序怎么影响查询。

**第二步 · 跑三个不同的查询,各看 stage 和 totalDocsExamined**

分别跑下面三条,每条都加 `.explain("executionStats")`,记下它的 `stage`(IXSCAN 还是 COLLSCAN)和 `totalDocsExamined`:

```js
// A: 只按 city 查
db.bigdata.find({ city: "Guangzhou" }).explain("executionStats")

// B: 按 city + age 一起查
db.bigdata.find({ city: "Guangzhou", age: 42 }).explain("executionStats")

// C: 只按 age 查
db.bigdata.find({ age: 42 }).explain("executionStats")
```

**做之前先猜一下**(这步很重要,别跳过):这个索引是 `{ city: 1, age: 1 }`(先 city 后 age)。你觉得 A、B、C 三个查询里,哪些能用上这个复合索引(走 IXSCAN)、哪些用不上(走 COLLSCAN)?

先写下你的猜测和理由,再去跑。猜错没关系——猜了再验证,比直接看答案记得牢。把你的猜测 + 三个查询的实际结果一起发我。

(C 这条要留意:它现在可能受你上午建的那个单独的 `{age:1}` 索引影响,我们到时候一起看怎么回事。)

我猜测 C 会走 age 的单独索引影响, 使用这个单独索引查, 但是三个查询都会进索引, 不会有使用 COLLSCAN 的
第一步返回值: city_1_age_1
第二步: 
    A: 
        {
            explainVersion: '1',
            queryPlanner: {
                winningPlan: {
                stage: 'FETCH',
                inputStage: {
                    stage: 'IXSCAN',
                    keyPattern: {
                    city: 1,
                    age: 1
                    },
                    indexName: 'city_1_age_1',
                    indexBounds: {
                    city: [
                        '["Guangzhou", "Guangzhou"]'
                    ],
                    age: [
                        '[MinKey, MaxKey]'
                    ]
                    }
                }
                },
                rejectedPlans: []
            },
            executionStats: {
                executionSuccess: true,
                nReturned: 16667,
                executionTimeMillis: 49,
                totalKeysExamined: 16667,
                totalDocsExamined: 16667,
                executionStages: {
                stage: 'FETCH',
                nReturned: 16667,
                executionTimeMillisEstimate: 12,
                inputStage: {
                    stage: 'IXSCAN',
                }
                }
            },
            }
    B:
    {
        explainVersion: '1',
        queryPlanner: {
            winningPlan: {
            stage: 'FETCH',
            inputStage: {
                stage: 'IXSCAN',
                keyPattern: {
                city: 1,
                age: 1
                },
                indexName: 'city_1_age_1',
                isMultiKey: false,
                multiKeyPaths: {
                city: [],
                age: []
                },
                indexBounds: {
                city: [
                    '["Guangzhou", "Guangzhou"]'
                ],
                age: [
                    '[42, 42]'
                ]
                }
            }
            },
            rejectedPlans: [
            {
                stage: 'FETCH',
                filter: {
                city: {
                    '$eq': 'Guangzhou'
                }
                },
                inputStage: {
                stage: 'IXSCAN',
                keyPattern: {
                    age: 1
                },
                indexName: 'age_1',
                isMultiKey: false,
                multiKeyPaths: {
                    age: []
                },
                isUnique: false,
                isSparse: false,
                isPartial: false,
                indexVersion: 2,
                direction: 'forward',
                indexBounds: {
                    age: [
                    '[42, 42]'
                    ]
                }
                }
            }
            ]
        },
        executionStats: {
            executionSuccess: true,
            nReturned: 334,
            executionTimeMillis: 1,
            totalKeysExamined: 334,
            totalDocsExamined: 334,
            executionStages: {
            stage: 'FETCH',
            inputStage: {
                stage: 'IXSCAN',
                nReturned: 334,
                executionTimeMillisEstimate: 0,
                works: 335,
                advanced: 334,
                needTime: 0,
                needYield: 0,
                saveState: 0,
                restoreState: 0,
                isEOF: 1,
                keyPattern: {
                city: 1,
                age: 1
                },
                indexName: 'city_1_age_1',
                isMultiKey: false,
                multiKeyPaths: {
                city: [],
                age: []
                },
                isUnique: false,
                isSparse: false,
                isPartial: false,
                indexVersion: 2,
                direction: 'forward',
                indexBounds: {
                city: [
                    '["Guangzhou", "Guangzhou"]'
                ],
                age: [
                    '[42, 42]'
                ]
                },
                keysExamined: 334,
                seeks: 1,
                dupsTested: 0,
                dupsDropped: 0
            }
            }
        },
        ok: 1
        }
    C:
    {
        explainVersion: '1',
        queryPlanner: {
            winningPlan: {
            stage: 'FETCH',
            inputStage: {
                stage: 'IXSCAN',
                keyPattern: {
                age: 1
                },
                indexName: 'age_1',
                isMultiKey: false,
                multiKeyPaths: {
                age: []
                },
                isUnique: false,
                isSparse: false,
                isPartial: false,
                indexVersion: 2,
                direction: 'forward',
                indexBounds: {
                age: [
                    '[42, 42]'
                ]
                }
            }
            },
            rejectedPlans: []
        },
        executionStats: {
            executionSuccess: true,
            nReturned: 1000,
            executionTimeMillis: 3,
            totalKeysExamined: 1000,
            totalDocsExamined: 1000,
            executionStages: {
            stage: 'FETCH',
            inputStage: {
                stage: 'IXSCAN',
                nReturned: 1000,
                executionTimeMillisEstimate: 0,
                works: 1001,
                advanced: 1000,
                needTime: 0,
                needYield: 0,
                saveState: 1,
                restoreState: 1,
                isEOF: 1,
                keyPattern: {
                age: 1
                },
                indexName: 'age_1',
                isMultiKey: false,
                multiKeyPaths: {
                age: []
                },
                isUnique: false,
                isSparse: false,
                isPartial: false,
                indexVersion: 2,
                direction: 'forward',
                indexBounds: {
                age: [
                    '[42, 42]'
                ]
                },
            }
            }
        },
        }
运行结果(有删减), 但是证明了确实没有使用 COLLSCAN 的

你的实验做得很完整,而且你保留了 `rejectedPlans`——那里面藏着今天最值钱的东西。先说你猜测里对的部分,再纠正一个关键误解,这个误解不破,复合索引的核心就没真正get到。

**你猜对的:三个查询都没走 COLLSCAN,全走了索引。** 没错。但"都走了索引"这个表象,掩盖了一个更重要的问题——**它们走的不是同一个索引,而且 A 走的那个索引其实效率很差。** 这才是复合索引字段顺序的核心,你的数据正好暴露了它。

**逐个拆,看 `totalDocsExamined`(这才是关键,不是"有没有走索引"):**

**A(只查 city)**:走了 `city_1_age_1`,但 `totalDocsExamined: 16667`——它扫了 1.6 万条。你看 indexBounds:`city: ["Guangzhou","Guangzhou"]`,但 `age: [MinKey, MaxKey]`(整个范围)。意思是:索引先按 city 定位到 Guangzhou,然后 age 这一截没有任何过滤作用,把 Guangzhou 的人**全扫了**。这能用上索引,是因为 city 正好是复合索引的**第一个字段**。

**B(查 city + age)**:同样走 `city_1_age_1`,但 `totalDocsExamined: 334`——只扫了 334 条!indexBounds 这次是 `city: ["Guangzhou"]` + `age: [42, 42]`,两个字段都精确命中。这是复合索引**最理想**的用法:两个字段都用上了,扫描数最小。

**C(只查 age)**:注意!它走的是 `age_1`(你上午建的那个单独索引),**不是** `city_1_age_1`。为什么?这就是核心——

**关键认知:复合索引 `{city:1, age:1}` 遵循"最左前缀"原则。**

把复合索引想象成一本**先按城市、再按年龄排序的通讯录**。

- 查"广州的人"(A):能用,翻到广州那一段就行——但广州段内没按你要的其他条件细分,所以得整段扫(16667 条)。
- 查"广州 + 42岁"(B):最理想,先翻到广州、再在广州段里按年龄精确定位(334 条)。
- 查"所有42岁的人"(C):这本通讯录是**先按城市排**的,42岁的人散落在广州、深圳、北京各段里,没法用"先城市后年龄"的排序直接定位。所以这个复合索引**对"只查age"根本用不上**——MongoDB 只好改用你单独建的 `age_1` 索引。

**这就是"最左前缀"**:复合索引 `{city, age}` 能服务于"查 city"和"查 city+age",但**服务不了"只查 age"**,因为 age 不是最左字段。如果你当初没单独建 `age_1`,那 C 查询就只能 COLLSCAN 了。

**验证一下这个理解**——我给你做个对照实验,你来跑,看能不能用结果证明"最左前缀":

先把单独的 age 索引删掉,排除它的干扰:

```js
db.bigdata.dropIndex("age_1")
```

然后再跑一次 C(只查 age):

```js
db.bigdata.find({ age: 42 }).explain("executionStats")
```

**先猜**:删掉 `age_1` 后,只剩 `city_1_age_1` 这个复合索引。C 查询(只查 age)现在会走 IXSCAN 还是 COLLSCAN?按"最左前缀",你觉得是哪个?

猜完再跑,把 stage 和 totalDocsExamined 发我。如果结果是 COLLSCAN,你就亲手证明了"复合索引救不了非最左字段的查询"——这是面试高频考点,而你是用实验证出来的,不是背的。

按照最左前缀原则, age_1 索引被删除后, 查询 age: 42 应当找不到对应索引, 需要查询整个文档, 因此是 COLLSCAN

{

    winningPlan: {
      stage: 'COLLSCAN',
      filter: {
        age: {
          '$eq': 42
        }
      },
      direction: 'forward'
    },
    rejectedPlans: []
  },
  executionStats: {
    executionSuccess: true,
    nReturned: 1000,
    executionTimeMillis: 30,
    totalKeysExamined: 0,
    totalDocsExamined: 50000,
    executionStages: {
      stage: 'COLLSCAN',
      filter: {
        age: {
          '$eq': 42
        }
      },
      nReturned: 1000,
      executionTimeMillisEstimate: 1,
      works: 50001,
      advanced: 1000,
      needTime: 49000,
      needYield: 0,
      saveState: 50,
      restoreState: 50,
      isEOF: 1,
      direction: 'forward',
      docsExamined: 50000
    },
}
猜测是对的

你亲手证明了最左前缀原则——删掉 `age_1` 后,只查 age 立刻退回 `COLLSCAN / 50000`,因为复合索引 `{city, age}` 的 age 不在最左,救不了它。这不是背来的结论,是你自己用实验逼出来的,这种掌握程度才是真的。

把今天索引这块的完整认知钉一下,你现在应该能讲清这一整条:

**单字段索引** → 直接对应查询字段,有就走 IXSCAN。

**复合索引 `{city, age}` + 最左前缀**:
- 查 city(最左) → 能用,但若只有 city 一个条件,扫描数可能很大(A 的 16667)
- 查 city + age → 最理想,两段都精确,扫描数最小(B 的 334)
- 只查 age(非最左) → **用不上**,没有别的索引就 COLLSCAN(你刚证的 50000)

**一个延伸的实践结论**(面试和真实建索引都用得上):复合索引的**字段顺序不是随便排的**,要把"查询时最常用作精确匹配的字段"放在左边。如果你的业务经常"只按 age 查",那要么把 age 放复合索引最左,要么单独给 age 建索引——这正是你上午建的 `age_1` 当初在 C 查询里救场的原因。

**现在揭晓上午留的那个悬念**——覆盖查询(covered query)。还记得我问的吗:"如果查询只要 age 一个字段,还需要 FETCH 回表吗?"

你今天每次 IXSCAN 后面都跟着一个 FETCH(回表取完整文档)。但有一种情况能省掉 FETCH:**如果你要的字段全部都在索引里,MongoDB 直接从索引返回,不用回表**。你来验证:

先重建 age 索引:

```js
db.bigdata.createIndex({ age: 1 })
```

然后跑一个**只投影 age、去掉 _id** 的查询(关键是 `_id: 0`,因为 _id 不在 age 索引里,留着它就得回表):

```js
db.bigdata.find({ age: 42 }, { age: 1, _id: 0 }).explain("executionStats")
```

**先猜**:这次 winningPlan 里还会有 FETCH 吗?还是只剩 IXSCAN?

理由想一下:你要的字段(age)正好就是索引本身存的内容,MongoDB 还需不需要回到集合里捞完整文档?

猜完跑,把 winningPlan 的 stage 结构发我。如果 FETCH 消失了、只剩 IXSCAN(可能叫 PROJECTION_COVERED),你就见到了索引的最高效形态——查询全程不碰集合,只读索引。

按照前面的解析, winningPlan 中应当只有 IXSCAN, 因为查询的内容都在索引中(去除了 _id)
{
  explainVersion: '1',
  queryPlanner: {
    winningPlan: {
      stage: 'PROJECTION_COVERED',
      transformBy: {
        age: 1,
        _id: 0
      },
      inputStage: {
        stage: 'IXSCAN',
        keyPattern: {
          age: 1
        },
        indexName: 'age_1',
        isMultiKey: false,
        multiKeyPaths: {
          age: []
        },
        isUnique: false,
        isSparse: false,
        isPartial: false,
        indexVersion: 2,
        direction: 'forward',
        indexBounds: {
          age: [
            '[42, 42]'
          ]
        }
      }
    },
    rejectedPlans: []
  },
  executionStats: {
    executionSuccess: true,
    nReturned: 1000,
    executionTimeMillis: 1,
    totalKeysExamined: 1000,
    totalDocsExamined: 0,
    executionStages: {
      stage: 'PROJECTION_COVERED',
      nReturned: 1000,
      executionTimeMillisEstimate: 0,
      works: 1001,
      advanced: 1000,
      needTime: 0,
      needYield: 0,
      saveState: 1,
      restoreState: 1,
      isEOF: 1,
      transformBy: {
        age: 1,
        _id: 0
      },
      inputStage: {
        stage: 'IXSCAN',
        nReturned: 1000,
        executionTimeMillisEstimate: 0,
        works: 1001,
        advanced: 1000,
        needTime: 0,
        needYield: 0,
        saveState: 1,
        restoreState: 1,
        isEOF: 1,
        keyPattern: {
          age: 1
        },
        indexName: 'age_1',
        isMultiKey: false,
        multiKeyPaths: {
          age: []
        },
        isUnique: false,
        isSparse: false,
        isPartial: false,
        indexVersion: 2,
        direction: 'forward',
        indexBounds: {
          age: [
            '[42, 42]'
          ]
        },
        keysExamined: 1000,
        seeks: 1,
        dupsTested: 0,
        dupsDropped: 0
      }
    }
  },
}
假设被验证

你猜对了,而且看到了那个关键词:`PROJECTION_COVERED`——FETCH 消失了,这就是**覆盖查询(covered query)**,索引的最高效形态。

把这个结构读懂:

- `IXSCAN` → 在 age 索引里定位 age=42
- `PROJECTION_COVERED` → 直接从索引返回 age 的值,**全程没有 FETCH**

对比你今天前面所有查询都是 `FETCH → IXSCAN`(定位后回表捞完整文档),这次是 `PROJECTION_COVERED → IXSCAN`,**完全不碰集合**。为什么能省掉回表?因为你要的字段(age)索引里本来就存着,`_id: 0` 又把唯一不在索引里的字段排除了——MongoDB 发现"你要的我索引里全有",就没必要回集合了。

**这个点的实践价值**(面试和真实优化都用得上):覆盖查询是索引优化的极致——查询只读索引、不读数据文件,最快。触发条件就两个:**查询的字段 + 返回的字段,全部包含在某个索引里**。所以高频的关键查询,有时会故意把"要返回的字段"也加进复合索引,就为了触发覆盖查询。你只要在投影里漏掉 `_id: 0`,FETCH 就会立刻回来——你可以顺手试一下,亲眼看 _id 怎么把覆盖查询打破(`find({age:42}, {age:1})` 不去掉 _id,看 FETCH 是不是回来了)。

---

到这里,**Day4 索引这块你不仅做完了,还做到了相当的深度**。盘一下你今天自己证出来的东西:

1. 索引基础:COLLSCAN 50000 → IXSCAN 1000,扫描数是索引价值的硬证据
2. FETCH + IXSCAN 两层分工:定位 + 回表
3. 复合索引 + 最左前缀:用对照实验证明了 `{city,age}` 救不了"只查 age"
4. 字段顺序的实践原则:最常精确匹配的放最左
5. 覆盖查询 PROJECTION_COVERED:字段全在索引里就免回表

这五点里,后三点(最左前缀、字段顺序、覆盖查询)是**面试高频、且大多数人只停留在"知道要建索引"而答不出**的深度。你是用 explain 一步步证出来的,这种理解面试官一问就能听出来是真懂还是背的。

这正是我之前说的"用提前量往深走,而不是往前赶"——你没有急着冲去学 Mongoose,而是把索引这块挖到了底,这个选择很对。

**Day4 索引完成,而且超额。** 把今天这五个点整理进笔记(尤其那两个对照实验:删 age_1 证最左前缀、加 _id:0 证覆盖查询,把"猜测→结果→结论"的过程记下来)。

测试: db.bigdata.find({ age: 42 }, { age: 1 }).explain("executionStats")
{
  explainVersion: '1',
  queryPlanner: {
    winningPlan: {
      stage: 'PROJECTION_SIMPLE',
      transformBy: {
        age: 1
      },
      inputStage: {
        stage: 'FETCH',
        inputStage: {
          stage: 'IXSCAN',
          keyPattern: {
            age: 1
          },
          indexName: 'age_1',
          isMultiKey: false,
          multiKeyPaths: {
            age: []
          },
          isUnique: false,
          isSparse: false,
          isPartial: false,
          indexVersion: 2,
          direction: 'forward',
          indexBounds: {
            age: [
              '[42, 42]'
            ]
          }
        }
      }
    },
    rejectedPlans: []
  },
  executionStats: {
    executionSuccess: true,
    nReturned: 1000,
    executionTimeMillis: 1,
    totalKeysExamined: 1000,
    totalDocsExamined: 1000,
    executionStages: {
      stage: 'PROJECTION_SIMPLE',
      nReturned: 1000,
      executionTimeMillisEstimate: 0,
      works: 1001,
      advanced: 1000,
      needTime: 0,
      needYield: 0,
      saveState: 1,
      restoreState: 1,
      isEOF: 1,
      transformBy: {
        age: 1
      },
      inputStage: {
        stage: 'FETCH',
        nReturned: 1000,
        executionTimeMillisEstimate: 0,
        works: 1001,
        advanced: 1000,
        needTime: 0,
        needYield: 0,
        saveState: 1,
        restoreState: 1,
        isEOF: 1,
        docsExamined: 1000,
        alreadyHasObj: 0,
        inputStage: {
          stage: 'IXSCAN',
          nReturned: 1000,
          executionTimeMillisEstimate: 0,
          works: 1001,
          advanced: 1000,
          needTime: 0,
          needYield: 0,
          saveState: 1,
          restoreState: 1,
          isEOF: 1,
          keyPattern: {
            age: 1
          },
          indexName: 'age_1',
          isMultiKey: false,
          multiKeyPaths: {
            age: []
          },
          isUnique: false,
          isSparse: false,
          isPartial: false,
          indexVersion: 2,
          direction: 'forward',
          indexBounds: {
            age: [
              '[42, 42]'
            ]
          },
          keysExamined: 1000,
          seeks: 1,
          dupsTested: 0,
          dupsDropped: 0
        }
      }
    }
  },
}
FETCH 确实回来了

把今天反复出现的这些 stage 名词系统讲一遍。它们都是 explain 输出里 `winningPlan` 的 `stage`,本质是**MongoDB 执行一个查询时,经过的一个个处理步骤**——你可以理解成查询的"执行流水线",每个 stage 是一道工序。

先讲今天遇到的核心三个,再补几个你之后会碰到的。

**COLLSCAN(collection scan,集合扫描)**
最笨的方式:没有可用索引,MongoDB 只能把整个 collection 从头到尾**一条条翻**,逐个检查符不符合条件。今天你无索引查 age=42 时,它扫了全部 50000 条——这就是 COLLSCAN。数据量小无所谓,数据量大就是性能灾难。看到 COLLSCAN,通常意味着"这里缺个索引"。

**IXSCAN(index scan,索引扫描)**
用索引来查:MongoDB 先在**索引**里定位到符合条件的位置。但要理解一个关键点——**索引里不存完整文档**,它只存了"被索引字段的值 + 一个指向完整文档的指针"。所以 IXSCAN 找到的是"位置/指针",不是数据本身。这就引出下一个。

**FETCH(回表/取文档)**
拿着 IXSCAN 找到的指针,**回到 collection 里把完整文档捞出来**。为什么需要这一步?因为你 `find` 通常要的是整条数据(name、city、score……),而索引里只有 age。所以流程是 `FETCH → IXSCAN`:先用索引定位(IXSCAN),再回表取完整文档(FETCH)。这俩today几乎总是成对出现。

**PROJECTION_COVERED(覆盖查询)**
今天最后见到的特殊情况:如果你要的字段**全都在索引里**(比如只查 age、只返回 age、还去掉了 _id),那 MongoDB 直接从索引返回,**不需要 FETCH 回表**。这时 FETCH 消失,换成 PROJECTION_COVERED。这是最高效的形态——全程只读索引、不碰数据文件。

---

把这四个串成一个画面,用"图书馆找书"的比方:

- **COLLSCAN** = 没有目录,从第一个书架开始一本本翻,翻完所有的书后带着大脑中记住的位置回去取书。
- **IXSCAN** = 查目录卡片,卡片上写着书名和"在 3 区 5 排"(指针),但卡片本身不是书。
- **FETCH** = 拿着"3 区 5 排"这个位置,走过去把书取下来。
- **PROJECTION_COVERED** = 你只想知道书名,而目录卡片上就写着书名——那看卡片就够了,根本不用去取书。

---

**几个你之后(尤其聚合、排序时)会遇到的 stage,先混个眼熟:**

- **SORT** = 在内存里排序。如果你 `sort()` 的字段没有索引支持,MongoDB 就得把结果捞出来现场排,数据量大时很耗内存(甚至会报超限错误)。看到 SORT 通常是"排序字段该建索引"的信号。
- **LIMIT / SKIP** = 对应你查询里的 `.limit()` 和 `.skip()`,限制返回条数、跳过前 N 条(分页用)。
- **PROJECTION_SIMPLE / PROJECTION_DEFAULT** = 处理投影(挑字段)的工序,和 COVERED 的区别是它还是得 FETCH 完整文档再挑,没省掉回表。
- **FETCH + filter** = 你在 B 查询的 rejectedPlans 里其实见过:用索引定位后,回表时还要再用某个条件过滤一遍(因为那个条件没在索引里)。

---

**怎么用这些名词做优化判断**(这才是它们的实战意义):

读 explain 时,你的目光顺序应该是:

1. **stage 是 COLLSCAN 吗?** → 是,大概率缺索引,这是最该警惕的。
2. **是 IXSCAN 吗?** → 好,用上索引了。
3. **能不能做到 PROJECTION_COVERED?** → 能的话(高频关键查询)更快。
4. **有没有意外的 SORT?** → 有的话考虑给排序字段加索引。

外加那个硬指标 `totalDocsExamined`:它越接近 `nReturned`(实际返回数),说明索引越精准;差得越远(扫了一堆、返回没几条),说明索引没建好或没建。

这套术语 + explain 读法,就是 MongoDB 性能优化的基本功。你今天等于把这套基本功用实验过了一遍,记笔记时把这个"stage 名词表 + 图书馆比方 + 优化判断顺序"一起收进去,以后看任何 explain 都有框架了。

补充:
MongoDB 中复合索引的使用和 MySQL 中复合索引的使用类似，也有最左匹配原则。即最左优先，在检索数据时从复合索引的最左边开始匹配。
复合索引创建的时候有一个基本的原则就是将选择性最强的列放到最前面。
选择性最高值得是数据的重复值最少，因为区分度高的列能够很容易过滤掉很多的数据。组合索引中第一次能够过滤掉很多的数据，后面的索引查询的数据范围就小了很多了。

覆盖查询的触发条件要写全三条:① 投影返回的字段在索引里、② 筛选条件的字段在索引里、③ `_id` 显式排除。
覆盖查询最硬的证据是 `totalDocsExamined: 0`,不是 stage 名字
