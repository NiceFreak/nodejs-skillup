查询优化深挖。先热身那个问题,再动手——这块的核心是"用 explain 看清代价,再针对性优化"。

**热身问题(先自己想,再动手):**

你的 `$lookup` 是:
```js
{ $lookup: {
    from: "users",
    localField: "_id",        // $group 后的 _id(userId)
    foreignField: "_id",      // user 的主键
    as: "userInfo"
}}
```

注意这里 `foreignField` 是 user 的 **`_id`**(主键)。**先问你一个判断:** user 的 `_id` 有没有索引?(提示:每个 MongoDB 文档的 `_id` 默认自带什么?)所以这个 `$lookup` 关联时,在 user 那边**是走索引还是全表扫**?

这个想清楚,你会发现你**这个特定的 `$lookup` 其实关联得挺高效**(因为关联的是主键)。但——如果换个场景就不一样了,这才是要深挖的:

**真正的性能陷阱在"关联非主键字段"时。** 假设你要按 order 的 `userId` 去关联(而不是 `$group` 后的 `_id`),或者关联 user 的 email、name 这种非主键字段——**那些字段默认没索引**,`$lookup` 就得在 user 集合里全表扫描找匹配。**这才是 `$lookup` 常见的性能杀手。**

---

**所以今天的深挖,分三步走(你动手):**

**第一步:给你现有的复杂管道跑 explain,看真实执行计划。**

Day1 你只 explain 了单集合 `$match`。现在 explain 带 `$lookup` 的完整管道。在 mongosh 里(或临时脚本),对客户消费报表那条管道加 `.explain("executionStats")`。

**重点看什么**(比 Day1 多了关联维度):
- `$match` 阶段:还是走 `status_1_createdAt_1` 索引吗?(你 Day1 建的那个)
- `$lookup` 阶段:MongoDB 怎么执行关联?会显示它对 user 集合是走索引还是扫描

先跑这个,把 explain 结果里跟 `$lookup` 相关的部分贴我,我们一起读。

**先自己回答热身问题**(user 的 `_id` 有没有索引、这个 lookup 高不高效),然后跑 explain。你答 + 跑,我看你对"关联性能"的判断准不准。

停一下——你这个判断**错了**,而且是个关键概念错误,必须纠正,否则你整个查询优化的基础是歪的。

**每个 MongoDB 文档的 `_id` 都自带一个索引,而且是唯一索引,自动创建、无法删除。**

回想你自己见过的证据——**你 Day2 用 `mongoose.set('debug', true)` 那次**,启动时打印过:
```
Mongoose: users.createIndex({ email: 1 }, { unique: true })
```
那是 email 的索引。但 `_id` 的索引你没看到 Mongoose 建,是因为**它不需要建——MongoDB 在创建任何集合时,自动为 `_id` 建好唯一索引**。这是 MongoDB 的铁律:`_id` 永远有索引,这也是为什么用 `_id` 查文档(`findById`)总是很快。

**你可以自己验证**:mongosh 里 `db.users.getIndexes()`,你一定会看到至少一个 `{ _id: 1 }` 的索引(名字叫 `_id_`)——它一直在那,你 Day1 建 order 的 `status_1_createdAt_1` 时也见过这个默认的 `_id_`。

**所以结论反过来:你这个 `$lookup` 恰恰是高效的。**

你的 `$lookup`:
```js
localField: "_id",        // $group 后的 userId
foreignField: "_id",      // ← user 的主键,自带索引!
```
你关联的是 user 的 **`_id` 主键**,它有索引。所以 `$lookup` 去 user 集合找匹配时,**走索引精准定位,不是全表扫**。这是最理想的关联方式——**关联主键,天然高效。**

---

**为什么这个纠正重要?——它决定了你对"关联性能"的正确认知:**

`$lookup` 高不高效,**取决于你关联的那个 `foreignField` 有没有索引**:
- 关联**有索引的字段**(主键 `_id`、或你显式建了索引的字段)→ 走索引 → 高效(你现在这样)
- 关联**没索引的字段**(比如 user 的 `name`、`email`、或某个普通字段)→ 全表扫描 → 慢

**这才是 `$lookup` 性能的真正规律**,也是面试考点:"你的 `$lookup` 慢怎么优化?" → "看关联字段有没有索引,没有就给 foreignField 建索引。"

**你把它记反了**,可能因为:你看到"_id"就联想到"没专门建过索引",忘了 `_id` 是**默认自带**的。这个点纠正过来,你对索引的整个心智模型才正。

---

**验证一下,你去做:**

1. mongosh 里 `db.users.getIndexes()`,亲眼看 `_id_` 索引在不在(确认"_id 有索引")
2. 然后跑客户消费报表(带 `$lookup`)的 explain,看 `$lookup` 阶段——它对 users 的访问应该是走索引的

**跑之前先修正你的预判**:因为关联的是主键(有索引),这个 `$lookup` 应该**高效、走索引**。跑出来验证这个预判对不对。

**然后我给你设计一个"对照实验"**,让你亲眼看到"关联无索引字段"有多慢——那才是查询优化真正要练的:故意关联一个没索引的字段,explain 看它全表扫描,再给那个字段建索引,explain 看它变快。这个对照和你 Day1 的"加索引前后"是同一个套路,但用在关联上。

先 `getIndexes()` 确认 `_id` 有索引(纠正你的认知),再跑 `$lookup` 的 explain。贴我。

你又跑了个不带 `$lookup` 的版本——看最底下的 `command.pipeline`,只有 `$match → $group → $sort`,**没有 `$lookup` 阶段**。这是你客户报表的"早期版本"(还没加关联的那版)。所以这份 explain 里看不到关联性能,自然也分析不了 `$lookup`。

不过没关系,这份还是印证了 `$match` 走索引高效(`IXSCAN` + keys=docs=4,和之前一致)。但今天的核心——**关联性能**——还没测到。

**问题出在:你 reports.js 里的管道没带 `$lookup`。** 你要把管道换成**完整的客户报表**(含 `$lookup + $unwind + $project` 那版),再 explain。就是你 Day2 竖切进 repository 的那个 `getCustomerSpending` 里的完整管道。

**你去做:** 把 reports.js 的 aggregate 管道,换成带 `$lookup` 的完整版:
```js
[
  { $match: {...} },
  { $group: {...} },
  { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "userInfo" } },
  { $unwind: "$userInfo" },
  { $project: {...} },
  { $sort: {...} }
]
```
末尾加 `.explain("executionStats")`,跑。

---

**跑之前,先纠正并确认一件事——你上一条说"user 的 _id 没有索引",你去 `db.users.getIndexes()` 验证了吗?**

这个很重要,别跳过。mongosh 里:
```
use week2
db.users.getIndexes()
```
你会看到一个名为 `_id_`、key 是 `{ _id: 1 }` 的索引——**这就是 MongoDB 自动为 `_id` 建的默认索引。** 你亲眼看到它,才能把"_id 没索引"这个错误认知纠正过来。

**先做这个验证(`getIndexes()`),把结果贴我**,确认你看到了 `_id_` 索引。然后换成带 `$lookup` 的管道跑 explain。

这两步——(1)亲眼确认 `_id` 有索引、(2)explain 带 `$lookup` 的管道看关联怎么走——才能真正进入今天"关联性能优化"的正题。你现在连着跑错了两次管道,先把这两个做对。

week2> db.users.getIndexes()
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { email: 1 }, name: 'email_1', unique: true }
]

对,你亲眼看到了——`_id_` 索引就在那,`{ _id: 1 }`,MongoDB 自动建的,你没写过任何代码它就存在。这就纠正了上一条"_id 没索引"的误判。

**记住这个结论(索引心智模型的地基):**
- **`_id` 永远有索引**(自动、唯一、删不掉)——所以用 `_id`/主键查或关联,天然快
- 其他字段(email、userId、createdAt……)**默认没索引**,要你自己建(你 Day1 建的 `status_1_createdAt_1`、这里的 `email_1` 都是显式建的)

顺带你还看到 `email_1 unique: true`——这就是你 Day2 debug 时看到的那条 `createIndex`,也是为什么 email 不能重复(唯一索引在数据库层强制)。

**所以你那个 `$lookup`(关联 user 的 `_id`)是走索引的、高效的。** 现在跑带 `$lookup` 的 explain 验证一下这个结论——把 reports.js 管道换成完整客户报表(含 `$lookup + $unwind + $project`),`.explain("executionStats")`,跑。

看 explain 里 `$lookup` 阶段对 users 的访问方式,应该能看到走 `_id` 索引的迹象。贴我那部分。

---

**跑完这个验证后,才是今天最有价值的部分——对照实验:关联"无索引字段" vs "有索引字段"。**

你现在的 `$lookup` 关联主键(有索引),很快。但真实项目里常需要关联**非主键字段**——那才是性能坑。我给你设计个对照,让你亲眼看到差距:

**实验:关联一个没索引的字段,看它全表扫描。**

比如,假设你要"按 email 关联"(而不是按 `_id`)。email 虽然你建了唯一索引,那换个真没索引的——比如给 order 加个查询,`$lookup` 关联 user 的 `name`(name 没索引)。或者更简单:

**用你已有的 order.userId 做实验。** order 的 `userId` 字段——你 `db.orders.getIndexes()` 看看它有没有索引?(大概率没有,你只建过 `status_1_createdAt_1`)。如果 order 反向被别的集合 `$lookup` 关联 userId,那就是扫描。

**先把带 `$lookup` 的 explain 跑出来看主键关联(快),然后我们造一个关联无索引字段的场景(慢),两个 explain 对比——这就是 Day1"加索引前后"的套路用在关联上。** 这个对照做出来,你的查询优化笔记就有"关联性能"这个有分量的章节了。

先跑带 `$lookup` 的 explain,贴我。

➜  src git:(main) ✗ node --env-file=.env reports.js
{
  "explainVersion": "2",
  "stages": [
    {
      "$cursor": {
        "queryPlanner": {
          "namespace": "week2.orders",
          "parsedQuery": {
            "$and": [
              {
                "status": {
                  "$eq": "completed"
                }
              },
              {
                "createdAt": {
                  "$gte": "2026-06-10T02:37:56.116Z"
                }
              }
            ]
          },
          "indexFilterSet": false,
          "queryHash": "48E9A00E",
          "planCacheShapeHash": "48E9A00E",
          "planCacheKey": "B8ABA72C",
          "optimizationTimeMillis": 0,
          "cursorType": "regular",
          "maxIndexedOrSolutionsReached": false,
          "maxIndexedAndSolutionsReached": false,
          "maxScansToExplodeReached": false,
          "prunedSimilarIndexes": false,
          "winningPlan": {
            "isCached": false,
            "queryPlan": {
              "stage": "GROUP",
              "planNodeId": 4,
              "inputStage": {
                "stage": "FETCH",
                "planNodeId": 2,
                "nss": "week2.orders",
                "inputStage": {
                  "stage": "IXSCAN",
                  "planNodeId": 1,
                  "nss": "week2.orders",
                  "keyPattern": {
                    "status": 1,
                    "createdAt": 1
                  },
                  "indexName": "status_1_createdAt_1",
                  "isMultiKey": false,
                  "multiKeyPaths": {
                    "status": [],
                    "createdAt": []
                  },
                  "isUnique": false,
                  "isSparse": false,
                  "isPartial": false,
                  "indexVersion": 2,
                  "direction": "forward",
                  "indexBounds": {
                    "status": [
                      "[\"completed\", \"completed\"]"
                    ],
                    "createdAt": [
                      "[new Date(1781059076116), new Date(9223372036854775807)]"
                    ]
                  }
                }
              }
            },
            "slotBasedPlan": {
              "slots": "$$RESULT=s22 env: { s5 = {\"status\" : 1, \"createdAt\" : 1} }",
              "stages": "[4] project [s22 = newObj(\"_id\", s18, \"orderCount\", s19, \"totalSpending\", s20, \"avgOrderValue\", s21)] \n[4] project [s19 = (convert ( s11, int32) ?: s11), s20 = doubleDoubleSumFinalize(s13), s21 = \n    if (s17 == 0ll) \n    then null \n    else (doubleDoubleSumFinalize(s16) / s17) \n] \n[4] group [s18] [s11 = count(), s13 = aggDoubleDoubleSum(s8), s16 = aggDoubleDoubleSum(s8), s17 = sum(\n    if ((typeMatch(s8, 1088) ?: true) || !(isNumber(s8))) \n    then 0ll \n    else 1ll \n)] spillSlots[s10, s12, s14, s15] mergingExprs[sum(s10), aggMergeDoubleDoubleSums(s12), aggMergeDoubleDoubleSums(s14), sum(s15)] \n[4] project [s18 = (s9 ?: null)] \n[2] fetch s1 = seek, s6 = result, s7 = recordId, s4 = inSnapshotId, s2 = inIndexIdent, s3 = inIndexKey, s5 = inIndexKeyPattern [s8 = totalAmount, s9 = userId] @\"74af615e-219b-4aaf-ae3e-8f6579463455\" \n[1] ixseek seekKeyLow = KS(3C636F6D706C6574656400788000019EAF64C01401) seekKeyHigh = KS(3C636F6D706C657465640078FFFFFFFFFFFFFFFFFE) [s3 = indexKey, s1 = recordId, s4 = snapshotId, s2 = indexIdent] [] @\"74af615e-219b-4aaf-ae3e-8f6579463455\" @\"status_1_createdAt_1\" forward "
            }
          },
          "rejectedPlans": []
        },
        "executionStats": {
          "executionSuccess": true,
          "nReturned": 3,
          "executionTimeMillis": 1,
          "totalKeysExamined": 4,
          "totalDocsExamined": 4,
          "executionStages": {
            "stage": "project",
            "planNodeId": 4,
            "nReturned": 3,
            "executionTimeMillisEstimate": 0,
            "opens": 1,
            "closes": 1,
            "saveState": 2,
            "restoreState": 1,
            "isEOF": 1,
            "projections": {
              "22": "newObj(\"_id\", s18, \"orderCount\", s19, \"totalSpending\", s20, \"avgOrderValue\", s21) "
            },
            "inputStage": {
              "stage": "project",
              "planNodeId": 4,
              "nReturned": 3,
              "executionTimeMillisEstimate": 0,
              "opens": 1,
              "closes": 1,
              "saveState": 2,
              "restoreState": 1,
              "isEOF": 1,
              "projections": {
                "19": "(convert ( s11, int32) ?: s11) ",
                "20": "doubleDoubleSumFinalize(s13) ",
                "21": "\n    if (s17 == 0ll) \n    then null \n    else (doubleDoubleSumFinalize(s16) / s17) \n"
              },
              "inputStage": {
                "stage": "group",
                "planNodeId": 4,
                "nReturned": 3,
                "executionTimeMillisEstimate": 0,
                "opens": 1,
                "closes": 1,
                "saveState": 2,
                "restoreState": 1,
                "isEOF": 1,
                "groupBySlots": [
                  18
                ],
                "expressions": {
                  "11": "count() ",
                  "13": "aggDoubleDoubleSum(s8) ",
                  "16": "aggDoubleDoubleSum(s8) ",
                  "17": "sum(\n    if ((typeMatch(s8, 1088) ?: true) || !(isNumber(s8))) \n    then 0ll \n    else 1ll \n) ",
                  "initExprs": {
                    "11": null,
                    "13": null,
                    "16": null,
                    "17": null,
                    "mergingExprs": {
                      "10": "sum(s10) ",
                      "12": "aggMergeDoubleDoubleSums(s12) ",
                      "14": "aggMergeDoubleDoubleSums(s14) ",
                      "15": "sum(s15) "
                    }
                  }
                },
                "usedDisk": false,
                "spills": 0,
                "spilledBytes": 0,
                "spilledRecords": 0,
                "spilledDataStorageSize": 0,
                "peakTrackedMemBytes": 482,
                "inputStage": {
                  "stage": "project",
                  "planNodeId": 4,
                  "nReturned": 4,
                  "executionTimeMillisEstimate": 0,
                  "opens": 1,
                  "closes": 1,
                  "saveState": 2,
                  "restoreState": 1,
                  "isEOF": 1,
                  "projections": {
                    "18": "(s9 ?: null) "
                  },
                  "inputStage": {
                    "stage": "fetch",
                    "planNodeId": 2,
                    "nReturned": 4,
                    "executionTimeMillisEstimate": 0,
                    "opens": 1,
                    "closes": 1,
                    "saveState": 2,
                    "restoreState": 1,
                    "isEOF": 1,
                    "numReads": 4,
                    "inputStage": {
                      "stage": "ixseek",
                      "planNodeId": 1,
                      "nReturned": 4,
                      "executionTimeMillisEstimate": 0,
                      "opens": 1,
                      "closes": 1,
                      "saveState": 2,
                      "restoreState": 1,
                      "isEOF": 1,
                      "indexName": "status_1_createdAt_1",
                      "keysExamined": 4,
                      "seeks": 1,
                      "numReads": 5,
                      "indexKeySlot": 3,
                      "recordIdSlot": 1,
                      "snapshotIdSlot": 4,
                      "indexIdentSlot": 2,
                      "outputSlots": [],
                      "indexKeysToInclude": "00000000000000000000000000000000",
                      "seekKeyLow": "KS(3C636F6D706C6574656400788000019EAF64C01401) ",
                      "seekKeyHigh": "KS(3C636F6D706C657465640078FFFFFFFFFFFFFFFFFE) "
                    }
                  }
                }
              }
            }
          }
        }
      },
      "nReturned": 3,
      "executionTimeMillisEstimate": 1
    },
    {
      "$lookup": {
        "from": "users",
        "as": "userInfo",
        "localField": "_id",
        "foreignField": "_id",
        "unwinding": {
          "preserveNullAndEmptyArrays": false
        }
      },
      "nReturned": 3,
      "executionTimeMillisEstimate": 1,
      "totalDocsExamined": 3,
      "totalKeysExamined": 3,
      "collectionScans": 0,
      "indexesUsed": [
        "_id_"
      ]
    },
    {
      "$project": {
        "orderCount": true,
        "totalSpending": true,
        "avgOrderValue": true,
        "userId": "$_id",
        "customerName": "$userInfo.name",
        "customerEmail": "$userInfo.email",
        "_id": false
      },
      "nReturned": 3,
      "executionTimeMillisEstimate": 1
    },
    {
      "$sort": {
        "sortKey": {
          "totalSpending": -1
        }
      },
      "totalDataSizeSortedBytesEstimate": 2316,
      "usedDisk": false,
      "spills": 0,
      "spilledBytes": 0,
      "spilledRecords": 0,
      "spilledDataStorageSize": 0,
      "nReturned": 3,
      "executionTimeMillisEstimate": 1,
      "peakTrackedMemBytes": 2316
    }
  ],
  "queryShapeHash": "D249F3C216A7B98D210842A99C15A723424A430450396CB555D9D3774AFDD0CE",
  "peakTrackedMemBytes": 482,
  "serverInfo": {
    "host": "macbookpro.cn.ibm.com",
    "port": 27017,
    "version": "8.3.4",
    "gitVersion": "4b03e7daaa316c78b9bf433046dba81637d581c0"
  },
  "serverParameters": {
    "internalQueryFacetBufferSizeBytes": 104857600,
    "internalDocumentSourceGroupMaxMemoryBytes": 104857600,
    "internalQueryMaxBlockingSortMemoryUsageBytes": 104857600,
    "internalDocumentSourceSetWindowFieldsMaxMemoryBytes": 104857600,
    "internalQueryFacetMaxOutputDocSizeBytes": 104857600,
    "internalLookupStageIntermediateDocumentMaxSizeBytes": 104857600,
    "internalQueryProhibitBlockingMergeOnMongoS": 0,
    "internalQueryMaxAddToSetBytes": 104857600,
    "internalQueryFrameworkControl": "trySbeRestricted",
    "internalQueryPlannerIgnoreIndexWithCollationForRegex": 1
  },
  "command": {
    "aggregate": "orders",
    "pipeline": [
      {
        "$match": {
          "status": "completed",
          "createdAt": {
            "$gte": "2026-06-10T02:37:56.116Z"
          }
        }
      },
      {
        "$group": {
          "_id": "$userId",
          "orderCount": {
            "$sum": 1
          },
          "totalSpending": {
            "$sum": "$totalAmount"
          },
          "avgOrderValue": {
            "$avg": "$totalAmount"
          }
        }
      },
      {
        "$lookup": {
          "from": "users",
          "localField": "_id",
          "foreignField": "_id",
          "as": "userInfo"
        }
      },
      {
        "$unwind": "$userInfo"
      },
      {
        "$project": {
          "_id": 0,
          "orderCount": 1,
          "totalSpending": 1,
          "avgOrderValue": 1,
          "userId": "$_id",
          "customerName": "$userInfo.name",
          "customerEmail": "$userInfo.email"
        }
      },
      {
        "$sort": {
          "totalSpending": -1
        }
      }
    ],
    "cursor": {},
    "$db": "week2"
  },
  "ok": 1
}

.explain("executionStats") 使用了 status_1_createdAt_1, $lookup` 不会看

这次跑对了——带 `$lookup` 的完整管道 explain 出来了。而且你不用怕这一大坨,今天状态不好,我直接帮你把**该看的三行**拎出来,你只要看懂这三行就够了,其余全是噪音。

**你昨天问"$lookup 高不高效、怎么看 executionStats"——答案就在这个 `$lookup` 阶段里,而且证明了你的关联是高效的。**

找到 explain 里 `$lookup` 那个 stage(在中间),就看这几行:

```json
"$lookup": { ... },
"totalDocsExamined": 3,
"totalKeysExamined": 3,
"collectionScans": 0,          ← 关键!
"indexesUsed": [ "_id_" ]      ← 关键!
```

**这两行就是答案:**

1. **`"indexesUsed": ["_id_"]`** —— `$lookup` 关联 user 时,**用了 `_id_` 索引**(就是你昨天 `getIndexes()` 看到的那个默认主键索引)。**走索引了,高效。**

2. **`"collectionScans": 0`** —— **零次全表扫描**。这是最直接的证据:关联过程中没有对 users 集合做任何全表扫描,全靠索引定位。

3. **`totalKeysExamined: 3, totalDocsExamined: 3, nReturned: 3`** —— 又是"三数相等"(和你 Day1 学的最优索引标志一样):扫3个索引键、取3个文档、返回3条,零浪费。

**所以结论坐实了:你这个 `$lookup` 高效,因为它关联的是 user 的 `_id` 主键(有索引),走 `_id_` 索引、零全表扫描。** 这就是昨天想让你验证的——**关联主键 = 走索引 = 快。**

---

**"$lookup 怎么看 executionStats"——你以后就看这两个字段:**

- **`indexesUsed`**:关联用了哪个索引(空的话 = 没用索引 = 危险信号)
- **`collectionScans`**:关联做了几次全表扫描(0 = 好,>0 = 关联字段没索引,慢)

**一句话判断 `$lookup` 性能:看 `collectionScans` 是不是 0、`indexesUsed` 里有没有东西。** 你这次 `collectionScans: 0` + 用了 `_id_`,满分。

这比读那一大坨 slotBasedPlan 简单多了——**`$lookup` 阶段有专门的这两个汇总字段,直接看它们就行,不用啃底层执行细节。**

---

**今天状态不好,查询优化到这里就够了,已经有可以写进笔记的结论了:**

> 客户消费报表的 `$lookup` 关联 user 主键 `_id`,explain 显示 `collectionScans: 0`、`indexesUsed: ["_id_"]`,走主键索引、零全表扫描,高效。判断 `$lookup` 性能的关键字段:`collectionScans`(应为0)和 `indexesUsed`(应非空)。

**那个"关联无索引字段会全表扫描"的对照实验,不用今天做了**——你状态不好,而且核心结论(关联主键高效、看 collectionScans/indexesUsed 判断)你已经拿到了。对照实验记进 backlog,以后有兴趣再玩。

---

**本周查询优化这块,到此其实够了。** 你有了:Day1 的"加索引前后对比"(COLLSCAN→IXSCAN) + 今天的"$lookup 关联性能怎么看"。查询优化笔记的素材齐了。
