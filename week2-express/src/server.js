import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { JwtSecretConfigurationError } from './errors/userErrors.js';

let server = null;
let shuttingDown = false;
const SHUTDOWN_TIMEOUT_MS = 30_000; // 端到端硬期限
// 数值分隔符(Numeric Separator) 是 ES2021 引入的语法特性
// 作用纯粹是提高大数字字面量的可读性
// 下划线只能用在数字之间, 不能用在开头或结尾(如 _30000 或 30000_ 是非法的)
// 在 Node.js 12+ 及现代浏览器中均可放心使用

async function startServer() {
    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET || JWT_SECRET.length < 32) {
            throw new JwtSecretConfigurationError();
        }
        await connectDB();
        const PORT = process.env.PORT || 3000;
        server = app.listen(PORT, () => {
            console.log(`服务运行端口: ${PORT}`);
        });
    } catch (err) {
        console.error('服务启动失败:', err);
        process.exit(1);
    }
}

startServer();

const gracefulShutdown = (signal) => {
    // 防重入：忽略后续信号
    if (shuttingDown) {
        console.log(`收到 ${signal}，但已在关闭中，忽略`);
        return;
    }
    shuttingDown = true;
    console.log(`收到 ${signal}. 优雅关闭中...`);

    // 端到端 deadline（从第一次信号开始计时）
    const deadline = setTimeout(() => {
        console.error('关停超时，强制退出');
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    // 执行关停链（异步，但不阻塞信号监听器）
    const performShutdown = async () => {
        try {
            // 1. 若 server 存在，等待 HTTP 连接排空
            if (server) {
                await new Promise((resolve, reject) => {
                    server.close((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // 2. 断开 MongoDB 连接（即使 server 为 null 也尝试）
            await disconnectDB();
            console.log(`${signal} 服务关闭`);

            // 正常完成：清除 deadline，设置退出码为 0，允许进程自然退出
            clearTimeout(deadline);
            process.exitCode = 0;
            // 给日志一些时间 flush，然后显式退出（防止挂起）
            setTimeout(() => process.exit(0), 100);
        } catch (err) {
            // 关停过程出现异常（如 DB 断开失败）
            console.error('关停过程中发生错误:', err);
            clearTimeout(deadline);
            process.exit(1);
        }
    };

    // 启动关停链，捕获未处理的 rejection 防止 unhandledRejection
    performShutdown().catch(() => { });
};

process.on('SIGINT', () => gracefulShutdown('中断信号(SIGINT)'));
process.on('SIGTERM', () => gracefulShutdown('终止信号(SIGTERM)'));
