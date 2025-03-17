import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import dotenv from "dotenv";

// Routers
import layoutsRouter from './routes/layouts';
import formTypesRouter from './routes/events';

const NODE_ENV = process.env.NODE_ENV || "development";

dotenv.config({ path: `.env.${NODE_ENV}` });

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const PORT = process.env.PORT || 5000;

connectDB(MONGO_URI);

//initialize express server
const app = express();


// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/layouts', layoutsRouter);
app.use("/events", formTypesRouter);

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));