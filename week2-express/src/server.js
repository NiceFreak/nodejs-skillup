import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { JwtSecretConfigurationError } from './errors/userErrors.js';

let server = null;
let shuttingDown = false;
let dbConnected = false;
let startupResolve = null; // 用于手动控制启动完成的信号
let startupReject = null;
const startupDone = new Promise((resolve, reject) => {
    startupResolve = resolve;
    startupReject = reject;
});

const SHUTDOWN_TIMEOUT_MS = 30_000; // ES2021 新语法: 数字分隔符

async function startServer() {
    try {
        if (shuttingDown) {
            console.log('启动时已处于关停状态，放弃启动');
            startupResolve();
            return;
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET || JWT_SECRET.length < 32) {
            throw new JwtSecretConfigurationError();
        }

        await connectDB();
        dbConnected = true;

        if (shuttingDown) {
            console.log('启动过程中收到关停信号，放弃启动（数据库已连接）');
            startupResolve(); // 启动完成，但 dbConnected 为 true
            return;
        }

        const PORT = process.env.PORT || 3000;
        server = app.listen(PORT, () => {
            console.log(`服务运行端口: ${PORT}`);
        });
        startupResolve(); // 正常启动完成
    } catch (err) {
        console.error('启动失败:', err);
        startupReject(err);
        // 如果还未进入关停，立即退出
        if (!shuttingDown) {
            process.exit(1);
        }
    }
}

// 启动
startServer();

// 关停函数
const gracefulShutdown = (signal) => {
    if (shuttingDown) {
        console.log(`收到 ${signal}，但已在关闭中，忽略`);
        return;
    }
    shuttingDown = true;
    console.log(`收到 ${signal}. 优雅关闭中...`);

    const deadline = setTimeout(() => {
        console.error('关停超时，强制退出');
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    const performShutdown = async () => {
        try {
            // 等待启动完成（无论成功或失败）
            await startupDone.catch(() => { });
            // 如果启动失败，startupDone 被 reject 但我们已经忽略，继续清理

            // 1. 关闭 HTTP 服务器
            if (server) {
                await new Promise((resolve, reject) => {
                    server.close((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // 2. 断开数据库
            if (dbConnected) {
                await disconnectDB();
            }

            console.log(`${signal} 服务关闭`);
            clearTimeout(deadline);
            process.exitCode = 0;
            // 事件循环自然退出
        } catch (err) {
            console.error('关停过程中发生错误:', err);
            clearTimeout(deadline);
            process.exit(1);
        }
    };

    performShutdown();
};

process.on('SIGINT', () => gracefulShutdown('中断信号(SIGINT)'));
process.on('SIGTERM', () => gracefulShutdown('终止信号(SIGTERM)'));
