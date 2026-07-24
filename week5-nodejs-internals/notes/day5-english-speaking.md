# Week 5 Day 5 · English Speaking Practice

## Topic

Error ownership and process lifecycle in a Node.js service.

## Speaking Script

Today I worked on a practical question: who owns an error in a Node.js service? In Express 5, a synchronous throw inside a route and a rejection returned by an async handler both reach the error middleware. A floating rejected promise or an exception inside a detached timer does not. Those escape the request boundary and reach the process level. Stream handling follows the same idea. An awaited pipeline exposes failure as a rejected promise, while bare pipe calls need explicit error handling.

I also separated planned shutdown from fatal failure. On SIGTERM, the process can stop accepting new connections, let active requests finish within a deadline, disconnect from MongoDB, and exit with a meaningful code. An uncaught exception is different because the process state may no longer be trustworthy. My policy is to record minimal diagnostics, exit quickly, and let an external supervisor restart the instance.

## Speaking Check

- Word count: 147 words.
- Estimated speaking time: about 61–68 seconds at 130–145 words per minute.
- Tone check: conversational engineering explanation suitable for an interview or team discussion.
- Pronunciation: `SIGTERM` ("sig-term"); `uncaught` /ʌnˈkɔːt/.
