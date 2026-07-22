const crypto = require('crypto');

// 实验：对比 UV_THREADPOOL_SIZE=4 与 8 时，8 个 pbkdf2 任务的完成时间分布
// 环境变量必须在 Node 进程启动前设置（export 或行内赋值均可）。

const START = Date.now();        // 所有任务的共同时间零点
const TASKS = 8;
let completed = 0;

function runTask(id) {
    const password = 'secret';
    const salt = 'salt';
    const iterations = 100000;    // 使单任务耗时约 50~200ms（依硬件），足以显示排队效应
    const keylen = 64;
    const digest = 'sha256';

    crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
        if (err) throw err;

        // elapsed 为 callback 开始执行时相对 START 的端到端耗时。
        // 它包含了提交开销 + 线程池排队 + 实际计算 + 事件循环调度延迟。
        // 该值用于横向对比不同线程池大小下的完成时刻分布，而非精确测量某一段。
        const elapsed = Date.now() - START;
        console.log(`Task ${id}: ${elapsed} ms`);

        completed++;
        if (completed === TASKS) {
            console.log(`Total: ${Date.now() - START} ms`);
        }
    });
}

// 连续提交 8 个任务（主线程单线程，提交间隔为微秒级），
// 但实际执行时受线程池大小限制，任务不一定同时开始计算。
for (let i = 1; i <= TASKS; i++) {
    runTask(i);
}
