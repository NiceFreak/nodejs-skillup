#!/usr/bin/env node
// reproduce-close-race.js
// 类 2「假 active」最小样本复现脚本
// 用法: PORT=3001 RUNS=100 node reproduce-close-race.js

const net = require('net');

// ---------- 环境变量 ----------
const PORT = parseInt(process.env.PORT || 3001, 10);
const HOST = process.env.HOST || '127.0.0.1';
const RUNS = parseInt(process.env.RUNS || 100, 10);
const PROBE_TIMEOUT = parseInt(process.env.PROBE_TIMEOUT || 200, 10);

// ---------- 端口探测（外部信号） ----------
function probePort(port, host, timeout = PROBE_TIMEOUT) {
    return new Promise((resolve) => {
        const socket = net.connect({ port, host }, () => {
            // 连接成功 → 内核在听（至少连接这一刻是）
            socket.destroy();
            resolve('connected');
        });

        socket.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
                resolve('refused');       // 内核无侦听者 → 假 active 的关键证据
            } else {
                resolve('error');         // 其他错误（如 ECONNRESET 可能表示曾有过但被关闭）
            }
        });

        const timer = setTimeout(() => {
            socket.destroy();
            resolve('timeout');         // 超时未响应 → 无法判定，保守计为「不一致」
        }, timeout);
    });
}

// ---------- 单次迭代 ----------
function runOne(runIndex) {
    return new Promise((resolve) => {
        const server = net.createServer((socket) => socket.end('ok'));

        let callbackFired = false;
        let addressOk = false;
        let probeResult = 'pending';
        let closeDone = false;
        let resolved = false;

        const checkAndResolve = () => {
            if (probeResult !== 'pending' && closeDone && !resolved) {
                resolved = true;
                clearTimeout(timer);
                resolve({ callbackFired, addressOk, probeResult, runIndex });
            }
        };

        // 兜底超时（防止任何分支挂起）
        const timer = setTimeout(() => {
            if (!closeDone) {
                try { server.close(); } catch (_) { /* ignore */ }
                closeDone = true;
            }
            if (!resolved) {
                resolved = true;
                resolve({ callbackFired, addressOk, probeResult: probeResult === 'pending' ? 'timeout' : probeResult, runIndex });
            }
        }, 3000);

        // ---------- listen ----------
        server.listen(PORT, HOST, () => {
            // 信号 A：回调触发
            callbackFired = true;

            // 信号 B：内部认定（server.address() 是否可用）
            try {
                addressOk = server.address() !== null;
            } catch (_) {
                addressOk = false;
            }

            // 1. 探测立即发起（与 close 竞争，而非在 close 之后）
            probePort(PORT, HOST).then((result) => {
                probeResult = result;
                checkAndResolve();
            });

            // 2. 在 listen 回调中立即调度 close（setImmediate 提供最大竞争窗口）
            setImmediate(() => {
                server.close(() => {
                    closeDone = true;
                    checkAndResolve();
                });
            });
        });

        // listen 失败处理（如端口被意外占用）
        server.on('error', (err) => {
            clearTimeout(timer);
            if (!resolved) {
                resolved = true;
                resolve({ callbackFired: false, addressOk: false, probeResult: 'error', runIndex, error: err.code });
            }
        });
    });
}

// ---------- 主循环（100 次） ----------
async function main() {
    console.log(`[类2复现] 开始 ${RUNS} 轮循环，目标 ${HOST}:${PORT}`);
    console.log(`[类2复现] 探测超时 ${PROBE_TIMEOUT}ms，close 竞争窗口 setImmediate\n`);

    const stats = {
        total: 0,
        callbackFired: 0,        // A
        addressOk: 0,            // B
        probeConnected: 0,       // C = true
        probeRefused: 0,
        probeTimeout: 0,
        probeError: 0,
        falseActive: 0,          // A=true && (C=false) → 复现判据
        errors: 0,
    };

    for (let i = 0; i < RUNS; i++) {
        const result = await runOne(i);
        stats.total++;

        if (result.callbackFired) stats.callbackFired++;
        if (result.addressOk) stats.addressOk++;

        if (result.probeResult === 'connected') stats.probeConnected++;
        else if (result.probeResult === 'refused') stats.probeRefused++;
        else if (result.probeResult === 'timeout') stats.probeTimeout++;
        else if (result.probeResult === 'error') stats.probeError++;

        if (result.error) stats.errors++;

        // 复现判据：回调触发（A=true）且 探测未连上（C=false，即 refused 或 timeout）
        if (result.callbackFired && (result.probeResult === 'refused' || result.probeResult === 'timeout')) {
            stats.falseActive++;
        }

        // 进度输出（每 10 轮）
        if ((i + 1) % 10 === 0) {
            console.log(`[进度] ${i + 1}/${RUNS}，当前假 active 计数: ${stats.falseActive}`);
        }
    }

    // ---------- 结果报告 ----------
    console.log('\n========== 复现结果 ==========');
    console.log(`总轮数:          ${stats.total}`);
    console.log(`A - 回调触发:    ${stats.callbackFired}`);
    console.log(`B - addressOk:   ${stats.addressOk}`);
    console.log(`C - 探测连接成功: ${stats.probeConnected}`);
    console.log(`    探测拒绝:     ${stats.probeRefused}`);
    console.log(`    探测超时:     ${stats.probeTimeout}`);
    console.log(`    探测错误:     ${stats.probeError}`);
    console.log(`错误数:          ${stats.errors}`);
    console.log('--------------------------------');
    console.log(`🔍 假 active（A=true 且 C=false）: ${stats.falseActive}`);

    if (stats.falseActive > 0) {
        console.log(`\n✅ 复现成功：在 ${stats.falseActive} 轮中观察到「回调触发但内核未绑定」的现象。`);
        process.exit(0);
    } else {
        console.log('\n❌ 未复现：100 轮中无假 active 现象。');
        console.log('   下一步：扩大样本至完整 server.js + 模拟负载。');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('[类2复现] 脚本异常:', err);
    process.exit(2);
});
