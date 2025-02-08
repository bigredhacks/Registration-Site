import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import dotenv from "dotenv";

// Routers
import layoutsRouter from './routes/layouts';

dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });
connectDB();

//initialize express server
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/layouts', layoutsRouter);

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));