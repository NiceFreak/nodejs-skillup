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

const N = 40;

// ---------- Heartbeat 监控 ----------
let prevHeartbeat = Date.now();
let maxHeartbeatGap = 0;

setInterval(() => {
    const now = Date.now();
    const gap = now - prevHeartbeat;
    if (gap > maxHeartbeatGap) {
        maxHeartbeatGap = gap;
    }
    if (Math.floor((now / 1000) % 10) === 0) {
        console.log(`[heartbeat] gap=${gap}ms, max=${maxHeartbeatGap}ms`);
    }
    prevHeartbeat = now;
}, 100);

// ---------- 辅助：等待至少一个心跳周期后返回 ----------
function waitForHeartbeatUpdate() {
    return new Promise(resolve => setTimeout(resolve, 150));
}

// ---------- 路由 ----------
app.get('/ping', (req, res) => {
    res.json({ pong: Date.now() });
});

// 主线程阻塞版
app.get('/blocking', async (req, res) => {
    maxHeartbeatGap = 0; // 重置
    const start = Date.now();
    const result = fib(N);
    const elapsed = Date.now() - start;
    // 等待心跳更新，确保 maxHeartbeatGap 反映计算期间的阻塞
    await waitForHeartbeatUpdate();
    res.json({ result, elapsed, mode: 'main-thread', maxHeartbeatGap });
});

// Worker 非阻塞版
// Worker 路由
app.get('/worker', async (req, res) => {
    maxHeartbeatGap = 0;
    const start = Date.now();
    const worker = new Worker(path.join(__dirname, 'fib-worker.mjs'), {
        workerData: { n: N }
    });

    let replied = false;
    const timeout = setTimeout(() => {
        if (!replied) {
            replied = true;
            worker.terminate();
            res.status(504).json({ error: 'Worker timeout' });
        }
    }, 5000);

    const respond = (data, status = 200) => {
        if (replied) return;
        replied = true;
        clearTimeout(timeout);
        res.status(status).json(data);
    };

    worker.on('message', (result) => {
        const elapsed = Date.now() - start;
        waitForHeartbeatUpdate().then(() => {
            respond({ result, elapsed, mode: 'worker', maxHeartbeatGap });
        });
    });

    worker.on('error', (err) => {
        console.error('Worker error:', err);
        respond({ error: err.message }, 500);
    });

    worker.on('exit', (code) => {
        if (code !== 0 && !replied) {
            respond({ error: `Worker exited with code ${code}` }, 500);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Fibonacci N = ${N}`);
    console.log('Heartbeat interval: 100ms');
    console.log('Observe max heartbeat gap during heavy computation.\n');
});
