import { parentPort, workerData } from 'worker_threads';

// 递归斐波那契（与主线程版本完全相同）
function fib(n) {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}

const result = fib(workerData.n);
parentPort.postMessage(result);
