import dotenv from "dotenv";
dotenv.config();
import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index";
import { ServerPort } from "./config";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:8080",
  credentials: true
}));
app.use(morgan("dev"));
app.use(helmet());
app.use("/api/v1", router);
const PORT = ServerPort;

app.listen(PORT, () => {
  console.log(`------Server is running on Port : ${PORT}`);
});
