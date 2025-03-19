import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
    members: [{
        submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
        name: String,
        email: String,
        phone: String,
        skills: [String],
        roles: [String],
        firstTimeHacker: Boolean
    }],
    teamNumber: Number,
    createdAt: { type: Date, default: Date.now }
});

export const Team = mongoose.model('Team', teamSchema);