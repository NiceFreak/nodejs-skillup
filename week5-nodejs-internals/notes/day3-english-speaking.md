# Week 5 Day 3 · English Speaking Practice

## Topic

Node.js event loop, libuv threadpool, and `UV_THREADPOOL_SIZE`.

## Speaking Script

In Node.js, the event loop and the libuv thread pool have different responsibilities. JavaScript callbacks run on the main thread, while some expensive native operations, such as asynchronous PBKDF2, are offloaded to worker threads. This matters because async doesn't automatically mean JavaScript runs on another thread.

To verify this, I built a small test that submitted eight identical PBKDF2 tasks. With the default pool size of four, only four tasks could run at once, so the callbacks tended to arrive in two groups. When I increased UV_THREADPOOL_SIZE to eight, the callbacks were grouped more closely. However, that doesn't guarantee the total time will drop by half, because the workers still compete for the same CPU resources.

My main takeaway is that I should identify where the work actually runs before changing concurrency settings or trying to optimize performance.

## Speaking Check

- Word count: 138 words.
- Estimated speaking time: about 60-65 seconds.
- Tone check: conversational technical explanation suitable for an interview or team discussion.
- Pronunciation: say `PBKDF2` as "P-B-K-D-F two."
