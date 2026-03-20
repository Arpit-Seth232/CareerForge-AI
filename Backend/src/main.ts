import dotenv from "dotenv";
dotenv.config();
import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler";
import { ServerPort, FRONTEND_URL } from "./config.js";

const app = express();
app.set("etag", false);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ["http://localhost:8080", FRONTEND_URL],
  credentials: true,
}));
app.use(morgan("dev"));
app.use(helmet());

// Routes
app.use("/api/v1", router);

// Centralized error handler (must be registered after routes)
app.use(errorHandler);

const PORT = ServerPort;

const server = app.listen(PORT, () => {
  console.log(`------Server is running on Port : ${PORT}`);
  console.log(`Server listening: ${server.listening}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`\n❌ Error: ${bind} is already in use`);
      console.error(`   1. Kill the process using port ${PORT}: lsof -ti:${PORT} | xargs kill -9`);
      console.error(`   2. Or change the PORT in your .env file\n`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
