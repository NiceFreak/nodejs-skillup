import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { JwtSecretConfigurationError } from './errors/userErrors.js';

let server = null;
let shuttingDown = false;
let dbConnected = false;
const SHUTDOWN_TIMEOUT_MS = 30_000;

async function startServer() {
    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET || JWT_SECRET.length < 32) {
            throw new JwtSecretConfigurationError();
        }

        // 启动前检查关停信号
        if (shuttingDown) {
            console.log('启动时已处于关停状态，放弃启动');
            process.exitCode = 1;
            return;
        }

        await connectDB();
        dbConnected = true;

        // 数据库连接后再次检查，防止在连接期间收到信号
        if (shuttingDown) {
            console.log('启动过程中收到关停信号，断开数据库并退出');
            try {
                await disconnectDB();
            } catch (err) {
                console.error('断开数据库失败（放弃启动）:', err);
            }
            process.exitCode = 1;
            return;
        }

        const PORT = process.env.PORT || 3000;
        server = app.listen(PORT, () => {
            console.log(`服务运行端口: ${PORT}`);
        });
        // 移除多余的 shuttingDown 检查（同步点不可达，且避免状态分支）
    } catch (err) {
        console.error('服务启动失败:', err);
        process.exit(1); // 启动失败仍强制退出，因无可用服务
    }
}

startServer();

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
            // 1. 如果服务器已启动，等待 HTTP 排空
            if (server) {
                await new Promise((resolve, reject) => {
                    server.close((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            } else if (dbConnected) {
                // 启动未完成但数据库已连接，跳转至断开数据库
                console.log('服务器尚未启动，直接断开数据库');
            } else {
                // 启动未完成且数据库未连接，直接退出
                clearTimeout(deadline);
                console.log('服务尚未完全启动，立即退出');
                process.exitCode = 0;
                return;
            }

            // 2. 断开 MongoDB 连接
            await disconnectDB();
            console.log(`${signal} 服务关闭`);

            // 正常完成：清除定时器，设置退出码，允许进程自然退出（确保日志冲刷）
            clearTimeout(deadline);
            process.exitCode = 0;
            // 函数返回，事件循环自然结束
        } catch (err) {
            console.error('关停过程中发生错误:', err);
            clearTimeout(deadline);
            process.exit(1); // 异常关停，强制退出
        }
    };

    // 启动关停链，错误已在内部捕获
    performShutdown();
};

process.on('SIGINT', () => gracefulShutdown('中断信号(SIGINT)'));
process.on('SIGTERM', () => gracefulShutdown('终止信号(SIGTERM)'));
