# Day 1 English Speaking Practice

## Topic

Keeping a Node.js service responsive with Worker Threads

## Speaking Script

Today I compared a CPU-heavy task on the Node.js main thread with the same task in a Worker Thread. Both versions calculated Fibonacci forty and took about 1.1 seconds, so the Worker did not make the calculation faster. The important difference was responsiveness. In the blocking version, the main thread could not process timers or another HTTP request. The heartbeat gap rose from 102 to 1,154 milliseconds, and a concurrent ping was delayed by hundreds of milliseconds. In the Worker version, the calculation ran on another thread. The event loop stayed available, the heartbeat remained near its baseline, and ping responses stayed around three milliseconds. My takeaway is that Workers are useful for expensive CPU work, such as image processing. They are unnecessary for short validation or normal asynchronous I/O, because thread startup and messaging also have a cost.

## Speaking Check

- Word count: 139 words
- Estimated speaking time: about 57-64 seconds at 130-145 words per minute
- Tone check: conversational, evidence-based, and suitable for an interview or team discussion
- Pronunciation: `Fibonacci` /fee-buh-NAA-chee/; `concurrent` /kuhn-KUR-uhnt/; `responsiveness` /ri-SPON-siv-nuhs/
