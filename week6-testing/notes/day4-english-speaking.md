# W6 Day 4 · Technical English Speaking

## Topic

Using evidence to evaluate a MongoDB index

## Speaking Script

Today I revisited how I evaluate MongoDB query optimization. I used to think that adding an index should make a query faster, but that statement is too vague without evidence. In my experiment, I ran the same `$lookup` against the users name field before and after creating a name index. Before the index, `explain` reported three collection scans, no index usage, and fifteen documents examined. After creating `name_1`, collection scans dropped to zero, `indexesUsed` showed `name_1`, and documents examined dropped to zero. This comparison matters because the query and dataset stayed the same; the index was the changed variable. Still, I would not claim that every lookup needs this index or that the measured timing predicts production performance. My practical rule is to inspect `explain`, compare the workload before and after, and separate observed metrics from broader assumptions.

## Speaking Check

- Word count: 138
- Estimated speaking time: about 57–64 seconds at 130–145 words per minute
- Tone check: conversational engineering explanation with observed metrics, a practical conclusion, and explicit evidence limits
- Pronunciation: MongoDB /MONG-go dee-bee/; metrics /MET-riks/
