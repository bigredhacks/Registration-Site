import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import dotenv from "dotenv";
import {z} from "zod";
import { Submission } from './config/Submission';

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

app.post('/api/submit', async (req, res) => {
    try {
        const validatedData = submissionSchema.parse(req.body);
        
        // Create new submission in MongoDB
        const submission = await Submission.create(validatedData);
        console.log('Submission saved:', submission);
        res.status(201).json({
            success: true,
            data: submission
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                success: false,
                errors: error.errors
            });
        } else {
            console.error('Error saving submission:', error);
            res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
});

// Add this new endpoint
app.get('/api/submissions', async (req, res) => {
    try {
        const submissions = await Submission.find().sort({ createdAt: -1 });
        console.log('Submissions fetched:', submissions);
        res.status(200).json({
            success: true,
            data: submissions
        });
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
});

app.delete('/api/submissions/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const submission = await Submission.findByIdAndDelete(id);
        if (!submission) {
            res.status(404).json({
                success: false,
                error: "Submission not found"
            });
            return;
            
        }
        res.status(200).json({
            success: true,
            data: submission
        });
        return;
    
    } catch (error) {
        console.error('Error deleting submission:', error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
        return;
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

