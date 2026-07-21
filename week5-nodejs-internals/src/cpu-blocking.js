// 两组实验仅修改 CPU_TARGET
const CPU_TARGET = 20;   // 对照1: 20ms  |  对照2: 2000ms
const TIMER_DELAY = 100;

// --- 时间点 1: timer 注册 ---
const timerRegTime = Date.now();

setTimeout(() => {
    // --- 时间点 4: callback 开始执行 ---
    const callbackStart = Date.now();
    const actualWait = callbackStart - timerRegTime;
    const lateAmount = actualWait - TIMER_DELAY;

    console.log('--- timer callback 执行 ---');
    console.log('callback 实际等待时间:', actualWait, 'ms');
    console.log('timer 迟到量:', lateAmount, 'ms');
    console.log('CPU 实际执行时长:', cpuEndTime - cpuStartTime, 'ms');
}, TIMER_DELAY);

// --- 时间点 2: CPU 开始 ---
const cpuStartTime = Date.now();

// 同步 CPU 密集任务（忙等）
while (Date.now() - cpuStartTime < CPU_TARGET) {
    // 空循环，占满主线程
}

// --- 时间点 3: CPU 结束 ---
const cpuEndTime = Date.now();
console.log('CPU 任务结束，实际耗时:', cpuEndTime - cpuStartTime, 'ms');
