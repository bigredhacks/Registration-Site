import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import dotenv from "dotenv";

dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });
connectDB();

//initialize express server
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));