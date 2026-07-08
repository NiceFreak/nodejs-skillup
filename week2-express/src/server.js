import app from './app.js'
import { connectDB, disconnectDB } from './config/db.js';

let server = null;

async function startServer() {
  try {
    await connectDB();
    const PORT = process.env.PORT || 3000;
    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

startServer();

const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await disconnectDB();
      console.log(`${signal} Server closed`);
      process.exit(0);
    } catch (err) {
      console.error('Error during disconnecting from MongoDB:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
