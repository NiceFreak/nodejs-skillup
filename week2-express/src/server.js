import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { JwtSecretConfigurationError } from './errors/userErrors.js';
import { logger } from './config/logger.js';

let server = null;
let shuttingDown = false;
let dbConnected = false;
let startupResolve = null;
let startupReject = null;
const startupDone = new Promise((resolve, reject) => {
    startupResolve = resolve;
    startupReject = reject;
});

const SHUTDOWN_TIMEOUT_MS = 30_000;

async function startServer() {
    try {
        if (shuttingDown) {
            logger.warn('启动时已处于关停状态，放弃启动');
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
            logger.warn('启动过程中收到关停信号，放弃启动（数据库已连接）');
            startupResolve();
            return;
        }

        const PORT = process.env.PORT || 3000;
        const HOST = process.env.HOST || '127.0.0.1';
        server = app.listen(PORT, HOST, () => {
            logger.info(`服务运行端口: ${HOST}:${PORT}`);
        });
        startupResolve();
    } catch (err) {
        logger.error({ error: err.message, stack: err.stack }, '启动失败');
        startupReject(err);
        if (!shuttingDown) {
            process.exit(1);
        }
    }
}

startServer();

const gracefulShutdown = (signal) => {
    if (shuttingDown) {
        logger.warn(`收到 ${signal}，但已在关闭中，忽略`);
        return;
    }
    shuttingDown = true;
    logger.warn(`收到 ${signal}. 优雅关闭中...`);

    const deadline = setTimeout(() => {
        logger.error('关停超时，强制退出');
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    const performShutdown = async () => {
        try {
            await startupDone.catch(() => { });
            if (server) {
                await new Promise((resolve, reject) => {
                    server.close((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
            if (dbConnected) {
                await disconnectDB();
            }
            logger.info(`${signal} 服务关闭`);
            clearTimeout(deadline);
            process.exitCode = 0;
        } catch (err) {
            logger.error({ error: err.message, stack: err.stack }, '关停过程中发生错误');
            clearTimeout(deadline);
            process.exit(1);
        }
    };

    performShutdown();
};

process.on('SIGINT', () => gracefulShutdown('中断信号(SIGINT)'));
process.on('SIGTERM', () => gracefulShutdown('终止信号(SIGTERM)'));
