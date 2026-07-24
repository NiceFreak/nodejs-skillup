import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// ---------- 共享计算函数 ----------
function fib(n) {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}

// ---------- 固定参数 ----------
const N = 40; // 确保主线程阻塞约 1 秒

// ---------- Heartbeat 监控 ----------
let prevHeartbeat = Date.now();
let maxHeartbeatGap = 0; // 相邻两次触发的最大间隔（毫秒）

setInterval(() => {
    const now = Date.now();
    const gap = now - prevHeartbeat;
    if (gap > maxHeartbeatGap) {
        maxHeartbeatGap = gap;
    }
    // 每 10 次打印一次当前状态（避免刷屏）
    if (Math.floor((now / 1000) % 10) === 0) {
        console.log(`[heartbeat] gap=${gap}ms, max=${maxHeartbeatGap}ms`);
    }
    prevHeartbeat = now;
}, 100);

// ---------- 路由 ----------
app.get('/ping', (req, res) => {
    res.json({ pong: Date.now() });
});

// 主线程阻塞版
app.get('/blocking', (req, res) => {
    maxHeartbeatGap = 0; // 重置，开始监测本次请求的影响
    const start = Date.now();
    const result = fib(N);
    const elapsed = Date.now() - start;
    res.json({ result, elapsed, mode: 'main-thread', maxHeartbeatGap });
});

// Worker 非阻塞版
app.get('/worker', (req, res) => {
    maxHeartbeatGap = 0; // 重置，开始监测本次请求的影响
    const start = Date.now();

    // 使用 ES Module 方式加载 Worker
    const worker = new Worker(path.join(__dirname, 'fib-worker.mjs'), {
        workerData: { n: N }
    });

    worker.on('message', (result) => {
        const elapsed = Date.now() - start;
        res.json({ result, elapsed, mode: 'worker', maxHeartbeatGap });
    });

    worker.on('error', (err) => {
        console.error('Worker error:', err);
        res.status(500).json({ error: err.message });
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        }
    });

    // 可选：设置超时，防止 Worker 卡死导致请求挂起
    const timeout = setTimeout(() => {
        worker.terminate();
        res.status(504).json({ error: 'Worker timeout' });
    }, 5000);

    // 若正常返回，清除超时
    const originalMessageHandler = worker.listeners('message')[0];
    worker.on('message', () => clearTimeout(timeout));
});

// ---------- 启动服务器 ----------
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Fibonacci N = ${N}`);
    console.log('Heartbeat interval: 100ms');
    console.log('Observe max heartbeat gap during heavy computation.\n');
});
