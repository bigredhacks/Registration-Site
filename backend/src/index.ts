import express from 'express';
import cors from 'cors';
import { initDatabase, createTables } from './config/database';
import { ParticipantModel, Participant } from './models/Participant';
import { TeamModel } from './models/Team';
import { TeamMatcher } from './utils/teamMatcher';
import dotenv from 'dotenv';
import { z } from 'zod';

const participantSchema = z.object({
  email: z.string().email('Invalid email'),
  fullName: z.string().min(1, 'Full name is required'),
  frontendExperience: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  backendExperience: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  designExperience: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  hardwareExperience: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  frontendPreference: z.number().min(1).max(5),
  backendPreference: z.number().min(1).max(5),
  designPreference: z.number().min(1).max(5),
  hardwarePreference: z.number().min(1).max(5),
  anyRolePreference: z.number().min(1).max(5),
  frontendSkills: z.array(z.string()),
  backendSkills: z.array(z.string()),
  designSkills: z.array(z.string()),
  hardwareSkills: z.array(z.string()),
  hackerType: z.enum(['FirstTimeHacker', 'VeteranHacker']),
  poolId: z.string().optional().default('default')
});

const NODE_ENV = process.env.NODE_ENV || 'development';

dotenv.config({ path: `.env.${NODE_ENV}` });

const DB_PATH = process.env.DB_PATH || './database.sqlite';
const PORT = process.env.PORT || 5000;

// Initialize database
initDatabase(DB_PATH).then(() => {
  createTables();
}).catch(console.error);

//initialize express server
const app = express();

app.use(express.json());
app.use(cors());

// Participant registration API
app.post('/api/participants', async (req, res) => {
  try {
    const validatedData = participantSchema.parse(req.body);
    
    // Parse netId from email
    const netId = validatedData.email.split('@')[0];
    
    const participantData: Participant = {
      ...validatedData,
      netId
    };

    const participant = await ParticipantModel.create(participantData);
    console.log('Participant saved:', participant);
    res.status(201).json({
      success: true,
      data: participant,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        errors: error.errors,
      });
    } else {
      console.error('Error saving participant:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
});

// Get participants API
app.get('/api/participants', async (req, res) => {
  try {
    const poolId = (req.query.poolId as string) || 'default';
    const participants = await ParticipantModel.findAll(poolId);
    console.log('Participants fetched:', participants.length);
    res.status(200).json({
      success: true,
      data: participants,
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.delete('/api/participants/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await ParticipantModel.deleteById(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Participant not found',
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Participant deleted successfully',
    });
    return;
  } catch (error) {
    console.error('Error deleting participant:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
    return;
  }
});

// Delete all participants in a pool
app.delete('/api/participants', async (req, res) => {
  try {
    const poolId = (req.query.poolId as string) || 'default';
    const deletedCount = await ParticipantModel.deleteByPoolId(poolId);
    res.status(200).json({
      success: true,
      message: `Deleted ${deletedCount} participants from pool: ${poolId}`,
    });
  } catch (error) {
    console.error('Error deleting participants:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Team formation API
app.get('/api/teams', async (req, res) => {
  try {
    const teamSize = parseInt(req.query.size as string) || 4;
    const poolId = (req.query.poolId as string) || 'default';
    const participants = await ParticipantModel.findAll(poolId);

    if (participants.length < teamSize) {
      res.status(400).json({
        error: 'Not enough participants to form teams of the requested size',
      });
      return;
    }

    const teams = TeamMatcher.formTeams(participants, teamSize, poolId);
    
    res.json({
      success: true,
      data: teams.map((team, index) => ({
        teamNumber: index + 1,
        members: team.map((member) => ({
          id: member.id,
          email: member.email,
          fullName: member.fullName,
          netId: member.netId,
          frontendExperience: member.frontendExperience,
          backendExperience: member.backendExperience,
          designExperience: member.designExperience,
          hardwareExperience: member.hardwareExperience,
          frontendPreference: member.frontendPreference,
          backendPreference: member.backendPreference,
          designPreference: member.designPreference,
          hardwarePreference: member.hardwarePreference,
          anyRolePreference: member.anyRolePreference,
          frontendSkills: member.frontendSkills,
          backendSkills: member.backendSkills,
          designSkills: member.designSkills,
          hardwareSkills: member.hardwareSkills,
          hackerType: member.hackerType
        }))
      })),
    });
    return;
  } catch (error) {
    console.error('Error forming teams:', error);
    res.status(500).json({ error: 'Failed to form teams' });
    return;
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);

app.post('/api/teams/save', async (req, res) => {
    try {
        const { teams } = req.body;
        
        // Clear existing teams for the pool
        const poolId = req.body.poolId || 'default';
        await TeamModel.deleteByPoolId(poolId);
        
        // Save new teams
        const savedTeams = await Promise.all(teams.map(async (teamMembers: any, index: number) => {
            return await TeamModel.create({
                members: teamMembers,
                teamNumber: index + 1,
                poolId: poolId
            });
        }));

        res.status(201).json({
            success: true,
            data: savedTeams
        });
    } catch (error) {
        console.error('Error saving teams:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save teams'
        });
    }
});
