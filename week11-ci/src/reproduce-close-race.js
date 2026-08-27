#!/usr/bin/env node
// reproduce-close-race.js v3
// 用法: PORT=3001 RUNS=100 CLOSE_MODE=afterListen node reproduce-close-race.js
// 模式: inCallback | afterListen | sync

const net = require('net');

const PORT = parseInt(process.env.PORT || 3001, 10);
const HOST = process.env.HOST || '127.0.0.1';
const RUNS = parseInt(process.env.RUNS || 100, 10);
const PROBE_TIMEOUT = parseInt(process.env.PROBE_TIMEOUT || 200, 10);
const CLOSE_MODE = process.env.CLOSE_MODE || 'afterListen';

// ---------- 端口探测（辅助，非主判据） ----------
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
    // net.createServer 回调只有一个 socket 参数（v1 已修，v3 保留）
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

    // ---------- listen ----------
    server.listen(PORT, HOST, () => {
      callbackFired = true;
      listeningAtCallback = server.listening;      // 主判据：回调触发时是否仍在监听
      try { addressOk = server.address() !== null; } catch (_) { addressOk = false; }

      // 仅 mode === 'inCallback' 时在回调内调度 close（对照原方式）
      if (mode === 'inCallback') {
        setImmediate(() => {
          server.close(() => { closeDone = true; if (probeResult !== 'pending') finish(); });
        });
      }

      // 异步探测（辅助，不阻塞 resolve）
      probePort(PORT, HOST).then((result) => {
        if (probeResult === 'pending') {
          probeResult = result;
          if (closeDone) finish();
        }
      });

      // 对于 inCallback 模式，close 已在上面调度；对于其他模式，close 在 listen 调用后已调度
      // 但若 close 调度在 listen 回调之前（afterListen/sync），此时可能已经关闭
      // 在这里检查是否 closeDone 已被外部置为 true
      if (closeDone && probeResult !== 'pending') {
        finish();
      }
    });

    server.on('error', (err) => {
      // listen 失败（如 EADDRINUSE），直接结束
      clearTimeout(timer);
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

    // ---------- close 注册（listen 调用之后、回调之外，与 cb 调度竞速） ----------
    // 对于 afterListen 和 sync 模式，close 在 listen 调用后立即注册
    // 注意：此时 server.listen 已调用，但回调尚未执行
    if (mode === 'afterListen') {
      // setImmediate 让 close 在当前事件循环的 check 阶段执行
      // 而 listen 回调在 poll 阶段可能先于或后于 check 阶段执行
      setImmediate(() => {
        server.close(() => {
          closeDone = true;
          if (probeResult !== 'pending') finish();
        });
      });
    } else if (mode === 'sync') {
      // 同步 close：立即尝试关闭，可能在 listen 回调之前执行
      try {
        server.close(() => {
          closeDone = true;
          if (probeResult !== 'pending') finish();
        });
      } catch (_) {
        closeDone = true;
        if (probeResult !== 'pending') finish();
      }
    }
    // inCallback 模式不在外部注册 close，而是在回调内调度
  });
}

// ---------- 主循环 ----------
async function main() {
  console.log(`[类2复现] 模式: ${CLOSE_MODE}, 目标 ${HOST}:${PORT}, 轮数 ${RUNS}`);
  console.log(`[类2复现] 探测超时 ${PROBE_TIMEOUT}ms\n`);

  const stats = {
    total: 0,
    callbackFired: 0,
    listeningAtCallbackTrue: 0,
    addressOk: 0,
    probeConnected: 0,
    probeRefused: 0,
    probeTimeout: 0,
    probeError: 0,
    falseActive: 0,          // 主判据：callbackFired && !listeningAtCallback
  };

  for (let i = 0; i < RUNS; i++) {
    const result = await runOne(CLOSE_MODE, i);
    stats.total++;

    if (result.callbackFired) {
      stats.callbackFired++;
      if (result.listeningAtCallback) stats.listeningAtCallbackTrue++;
      else {
        // 回调触发但 listening === false → 真正的假 active 候选
        stats.falseActive++;
      }
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
    console.log('\n❌ 未复现：100 轮中无假 active 现象。');
    console.log('   下一步：扩大样本至完整 server.js + 模拟负载。');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[类2复现] 脚本异常:', err);
  process.exit(2);
});
