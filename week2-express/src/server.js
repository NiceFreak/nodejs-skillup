import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { JwtSecretConfigurationError } from './errors/userErrors.js';

let server = null;

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

const gracefulShutdown = async (signal) => {
    console.log(`收到 ${signal}. 优雅关闭中...`);
    server.close(async () => {
        try {
            await disconnectDB();
            console.log(`${signal} 服务关闭`);
            process.exit(0);
        } catch (err) {
            console.error('断开与 MongoDB 的连接中发生错误: ', err);
            process.exit(1);
        }
    });
};

process.on('SIGINT', () => gracefulShutdown('中断信号(SIGINT)'));
process.on('SIGTERM', () => gracefulShutdown('终止信号(SIGTERM)'));
