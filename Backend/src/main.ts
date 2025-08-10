import dotenv from "dotenv";
dotenv.config();
import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(morgan("dev"));
app.use(helmet);
app.use(cors());
const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`------Server is running on Port : ${PORT}`);
});
