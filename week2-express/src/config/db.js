import mongoose from 'mongoose';
import { DatabaseConnectionError } from '../errors/userErrors.js';

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;
    try {
        await mongoose.connect(uri);
    } catch (err) {
        throw new DatabaseConnectionError('数据库连接失败', { cause: err });
    }
};

const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (err) {
        throw new DatabaseConnectionError('数据库断开连接失败', { cause: err });
    }
};

export { connectDB, disconnectDB };
