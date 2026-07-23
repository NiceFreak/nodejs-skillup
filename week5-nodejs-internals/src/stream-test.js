const { Writable } = require('stream');
const { setTimeout: setTimeoutPromise } = require('timers/promises');

// ============ 配置 ============
const PRODUCER_SPEED_MS = 10;      // producer 每 10ms 产生一个 chunk
const CONSUMER_DELAY_MS = 50;      // consumer 处理每个 chunk 需要 50ms
const HIGH_WATER_MARK = 5;          // Writable 内部缓冲阈值（字节数）
const TOTAL_CHUNKS = 30;           // 总共产生 30 个 chunk
const CHUNK_SIZE = 1;              // 每个 chunk 1 字节

// ============ 状态追踪 ============
let producerPaused = false;
let writeCount = 0;
let drainCount = 0;

// ============ 自定义慢 Writable ============
class SlowWritable extends Writable {
    constructor(options) {
        super(options);
    }

    _write(chunk, encoding, callback) {
        // writableLength 包含当前正在处理的 chunk，直到 callback() 被调用后才会移除
        console.log(`[consumer] 开始处理 chunk, 内部缓冲: ${this.writableLength} 字节`);
        setTimeout(() => {
            console.log(`[consumer] 处理完成, 内部缓冲: ${this.writableLength} 字节`);
            callback(); // 通知 Writable 完成，之后才会处理下一个 chunk
        }, CONSUMER_DELAY_MS);
    }
}

// ============ 创建 Writable ============
const writable = new SlowWritable({
    highWaterMark: HIGH_WATER_MARK,
    defaultEncoding: 'utf8',
});

// ============ 监听 drain 事件 ============
writable.on('drain', () => {
    drainCount++;
    console.log(`[drain] 第 ${drainCount} 次 drain 触发, 内部缓冲: ${writable.writableLength} 字节`);
    producerPaused = false;
});

// ============ Heartbeat（证明 event loop 未被阻塞）============
const heartbeatInterval = setInterval(() => {
    console.log(`[heartbeat] event loop 正常运行, 时间: ${Date.now()}`);
}, 200);

// ============ Producer ============
async function producer() {
    for (let i = 1; i <= TOTAL_CHUNKS; i++) {
        // 如果处于暂停状态，等待 drain 事件将 producerPaused 置为 false
        while (producerPaused) {
            await setTimeoutPromise(5); // 非阻塞轮询等待
        }

        const chunk = Buffer.alloc(CHUNK_SIZE, 'x');
        const canContinue = writable.write(chunk);
        writeCount++;

        if (!canContinue) {
            producerPaused = true;
            console.log(
                `[producer] write() 返回 false! (第 ${writeCount} 次 write), 内部缓冲: ${writable.writableLength} 字节`
            );
        } else {
            console.log(
                `[producer] write() 返回 true (第 ${writeCount} 次 write), 内部缓冲: ${writable.writableLength} 字节`
            );
        }

        // 模拟固定的生产间隔
        await setTimeoutPromise(PRODUCER_SPEED_MS);
    }

    // 所有数据已写入，结束流
    console.log('[producer] 所有 chunk 已交付，调用 end()');
    writable.end();
}

// ============ 结束处理 ============
writable.on('finish', () => {
    clearInterval(heartbeatInterval);
    console.log('\n============ 统计 ============');
    console.log(`总 write 次数: ${writeCount}`);
    console.log(`总 drain 次数: ${drainCount}`);
    console.log('[finish] 流正常结束');
});

writable.on('error', (err) => {
    clearInterval(heartbeatInterval);
    console.error('[error] 流出错:', err);
    process.exit(1);
});

// ============ 启动 ============
console.log('============ 背压 Demo 启动 ============');
console.log(`配置: 生产间隔 ${PRODUCER_SPEED_MS}ms, 消费延迟 ${CONSUMER_DELAY_MS}ms`);
console.log(`highWaterMark: ${HIGH_WATER_MARK} 字节, 总 chunk 数: ${TOTAL_CHUNKS}`);
console.log(`理论速率比: 生产者 ${1000 / PRODUCER_SPEED_MS} chunks/s, 消费者 ${1000 / CONSUMER_DELAY_MS} chunks/s\n`);

producer();
