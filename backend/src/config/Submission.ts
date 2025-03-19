import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    skills: [{ type: String }],
    roles: [{ type: String }],
    firstTimeHacker: { type: Boolean, default: false },
}, { timestamps: true });

export const Submission = mongoose.model('Submission', submissionSchema);