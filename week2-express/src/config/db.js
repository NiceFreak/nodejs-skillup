import mongoose from "mongoose";

const connectDB = async() => {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri).then(() => {
        console.log("MongoDB connected");
    }).catch((err) => {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    });
}

export default connectDB;