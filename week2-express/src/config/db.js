import mongoose from "mongoose";
import { DatabaseConnectionError } from "../errors/userErrors.js";

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;
    try {
        await mongoose.connect(uri);
    } catch (err) {
        throw new DatabaseConnectionError('Failed to connect to the database', { cause: err });
    }
}

// TODO:
// 优雅关闭: SIGINT / SIGTERM 时先 disconnectDB 再 exit

export { connectDB };
