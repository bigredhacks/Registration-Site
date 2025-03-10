import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import dotenv from "dotenv";
import {z} from "zod";

const submissionSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email"),
    phone: z.string().min(1, "Phone is required"),
    skills: z.array(z.string()).min(1, "Skills are required"),
    roles: z.array(z.string())
});

const NODE_ENV = process.env.NODE_ENV || "development";

dotenv.config({ path: `.env.${NODE_ENV}` });

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const PORT = process.env.PORT || 5000;

connectDB(MONGO_URI);

//initialize express server
const app = express();


app.use(express.json());
app.use(cors());

app.post('/api/submit', (req, res) => {
    try {
        const validatedData = submissionSchema.parse(req.body);
        console.log(JSON.stringify(validatedData, null, 2));
        res.status(200).json({
            success: true,
            data: validatedData
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                success: false,
                errors: error.errors
            });
        } else {
            res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

