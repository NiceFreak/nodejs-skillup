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

const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (err) {
        throw new DatabaseConnectionError('Failed to disconnect from the database', { cause: err });
    }
};

export { connectDB, disconnectDB };
