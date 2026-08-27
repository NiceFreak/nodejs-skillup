#!/usr/bin/env node
// reproduce-close-race.js v4
// 用法: PORT=3001 RUNS=100 CLOSE_MODE=afterListen node reproduce-close-race.js
// 模式: inCallback | afterListen | sync

const net = require('net');

const PORT = parseInt(process.env.PORT || 3001, 10);
const HOST = process.env.HOST || '127.0.0.1';
const RUNS = parseInt(process.env.RUNS || 100, 10);
const PROBE_TIMEOUT = parseInt(process.env.PROBE_TIMEOUT || 200, 10);
const CLOSE_MODE = process.env.CLOSE_MODE || 'afterListen';
const SYNC_CLOSE_TIMEOUT = parseInt(process.env.SYNC_CLOSE_TIMEOUT || 50, 10); // sync 模式专用

// ---------- 端口探测（辅助） ----------
function probePort(port, host, timeout = PROBE_TIMEOUT) {
    return new Promise((resolve) => {
        const socket = net.connect({ port, host }, () => {
            socket.destroy();
            resolve('connected');
        });
        socket.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') resolve('refused');
            else resolve('error');
        });
        setTimeout(() => {
            socket.destroy();
            resolve('timeout');
        }, timeout);
    });
}

// ---------- 单次迭代 ----------
function runOne(mode, runIndex) {
    return new Promise((resolve) => {
        const server = net.createServer((socket) => {
            socket.end('ok');
        });

        let callbackFired = false;
        let listeningAtCallback = false;
        let addressOk = false;
        let closeDone = false;
        let probeResult = 'pending';
        let resolved = false;

        const finish = () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            clearTimeout(syncCloseTimer);
            resolve({ callbackFired, listeningAtCallback, addressOk, probeResult, runIndex });
        };

        const timer = setTimeout(() => {
            if (!closeDone) {
                try { server.close(); } catch (_) { /* ignore */ }
                closeDone = true;
            }
            if (probeResult === 'pending') probeResult = 'timeout';
            finish();
        }, 3000);

        // sync 模式专用短兜底：若 close 回调在 50ms 内未触发，主动置 closeDone
        let syncCloseTimer = null;

        // ---------- listen ----------
        server.listen(PORT, HOST, () => {
            callbackFired = true;
            listeningAtCallback = server.listening;
            try { addressOk = server.address() !== null; } catch (_) { addressOk = false; }

            if (mode === 'inCallback') {
                setImmediate(() => {
                    server.close(() => { closeDone = true; if (probeResult !== 'pending') finish(); });
                });
            }

            probePort(PORT, HOST).then((result) => {
                if (probeResult === 'pending') {
                    probeResult = result;
                    if (closeDone) finish();
                }
            });

            if (closeDone && probeResult !== 'pending') {
                finish();
            }
        });

        server.on('error', (err) => {
            clearTimeout(timer);
            clearTimeout(syncCloseTimer);
            if (!resolved) {
                resolved = true;
                resolve({
                    callbackFired: false,
                    listeningAtCallback: false,
                    addressOk: false,
                    probeResult: 'error',
                    runIndex,
                    error: err.code,
                });
            }
        });

        // ---------- close 注册（listen 调用之后、回调之外） ----------
        if (mode === 'afterListen') {
            setImmediate(() => {
                server.close(() => {
                    closeDone = true;
                    if (probeResult !== 'pending') finish();
                });
            });
        } else if (mode === 'sync') {
            // sync 模式：同步 close，但 close 回调可能不触发
            // 加短兜底保证迭代不卡死
            try {
                server.close(() => {
                    closeDone = true;
                    if (probeResult !== 'pending') finish();
                });
                // 若 close 回调迟迟不触发（常见于从未 listening），50ms 后主动完成
                syncCloseTimer = setTimeout(() => {
                    if (!closeDone) {
                        closeDone = true;
                        if (probeResult !== 'pending') finish();
                    }
                }, SYNC_CLOSE_TIMEOUT);
            } catch (_) {
                closeDone = true;
                if (probeResult !== 'pending') finish();
            }
        }
        // inCallback 模式不在外部注册 close
    });
}

// ---------- 主循环 ----------
async function main() {
    console.log(`[类2复现] 模式: ${CLOSE_MODE}, 目标 ${HOST}:${PORT}, 轮数 ${RUNS}`);
    console.log(`[类2复现] 探测超时 ${PROBE_TIMEOUT}ms, sync模式兜底 ${SYNC_CLOSE_TIMEOUT}ms\n`);

    const stats = {
        total: 0,
        callbackFired: 0,
        listeningAtCallbackTrue: 0,
        addressOk: 0,
        probeConnected: 0,
        probeRefused: 0,
        probeTimeout: 0,
        probeError: 0,
        falseActive: 0,
    };

    for (let i = 0; i < RUNS; i++) {
        const result = await runOne(CLOSE_MODE, i);
        stats.total++;

        if (result.callbackFired) {
            stats.callbackFired++;
            if (result.listeningAtCallback) stats.listeningAtCallbackTrue++;
            else stats.falseActive++;
        }
        if (result.addressOk) stats.addressOk++;

        const p = result.probeResult;
        if (p === 'connected') stats.probeConnected++;
        else if (p === 'refused') stats.probeRefused++;
        else if (p === 'timeout') stats.probeTimeout++;
        else if (p === 'error') stats.probeError++;

        if ((i + 1) % 10 === 0) {
            console.log(`[进度] ${i + 1}/${RUNS}，falseActive 当前: ${stats.falseActive}`);
        }
    }

    console.log('\n========== 复现结果 ==========');
    console.log(`总轮数:          ${stats.total}`);
    console.log(`A - 回调触发:    ${stats.callbackFired}`);
    console.log(`  其中 listening=true: ${stats.listeningAtCallbackTrue}`);
    console.log(`B - addressOk:   ${stats.addressOk}`);
    console.log(`C - 探测连接成功: ${stats.probeConnected}`);
    console.log(`    探测拒绝:     ${stats.probeRefused}`);
    console.log(`    探测超时:     ${stats.probeTimeout}`);
    console.log(`    探测错误:     ${stats.probeError}`);
    console.log('--------------------------------');
    console.log(`🔍 假 active（A=true 且 listening=false）: ${stats.falseActive}`);

    if (stats.falseActive > 0) {
        console.log(`\n✅ 复现成功：在 ${stats.falseActive} 轮中观察到「回调触发但监听已关闭」的竞争现象。`);
        process.exit(0);
    } else {
        console.log(`\n❌ 未复现：${RUNS} 轮中无假 active 现象。`);
        console.log('   下一步：扩大样本至完整 server.js + 模拟负载。');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('[类2复现] 脚本异常:', err);
    process.exit(2);
});
