import mongoose from "mongoose";

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;
    try {
        await mongoose.connect(uri);
    } catch (err) {
        throw err;
    }
}

// TODO:
// 优雅关闭: SIGINT / SIGTERM 时先 disconnectDB 再 exit

export { connectDB };
