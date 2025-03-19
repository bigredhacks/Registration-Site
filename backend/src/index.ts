import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import dotenv from 'dotenv';
import { z } from 'zod';
import { Submission } from './config/Submission';
import { Team } from './config/Team';

const submissionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required'),
  skills: z.array(z.string()).min(1, 'Skills are required'),
  firstTimeHacker: z.boolean().optional().default(false),
  roles: z.array(z.string()),
});

const NODE_ENV = process.env.NODE_ENV || 'development';

dotenv.config({ path: `.env.${NODE_ENV}` });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const PORT = process.env.PORT || 5000;

connectDB(MONGO_URI);

//initialize express server
const app = express();

app.use(express.json());
app.use(cors());

// Form submission api
app.post('/api/submit', async (req, res) => {
  try {
    const validatedData = submissionSchema.parse(req.body);

    // Create new submission in MongoDB
    const submission = await Submission.create(validatedData);
    console.log('Submission saved:', submission);
    res.status(201).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        errors: error.errors,
      });
    } else {
      console.error('Error saving submission:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
});

// Forms retrival API
app.get('/api/submissions', async (req, res) => {
  try {
    const submissions = await Submission.find().sort({ createdAt: -1 });
    console.log('Submissions fetched:', submissions);
    res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
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
        error: 'Submission not found',
      });
      return;
    }
    res.status(200).json({
      success: true,
      data: submission,
    });
    return;
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
    return;
  }
});

app.get('/api/teams', async (req, res) => {
  try {
    const teamSize = parseInt(req.query.size as string) || 3;
    const submissions = await Submission.find({}).lean();

    if (submissions.length < teamSize) {
      res.status(400).json({
        error: 'Not enough participants to form teams of the requested size',
      });
      return;
    }

    const validatedSubmissions = submissions.filter((submission) => {
      try {
        submissionSchema.parse(submission);
        return true;
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.warn(`Invalid submission data: ${error.message}`, submission);
        }
        return false;
      }
    });

    const requiredRoles = ['Frontend', 'Backend', 'Designer'];
    const teams = [];
    
    // Separate first-time hackers and experienced hackers 
    let firstTimeHackers = validatedSubmissions.filter(p => p.firstTimeHacker);
    let experiencedHackers = validatedSubmissions.filter(p => !p.firstTimeHacker);
    
    // Sort both groups by number of roles
    firstTimeHackers.sort((a, b) => (a.roles?.length || 0) - (b.roles?.length || 0));
    experiencedHackers.sort((a, b) => (a.roles?.length || 0) - (b.roles?.length || 0));

    // First, try to form teams with first-time hackers
    while (firstTimeHackers.length >= teamSize) {
        const team = [];
        const usedRoles = new Set();

        // Team formation logic for first-time hackers
        for (const role of requiredRoles) {
            if (usedRoles.has(role)) continue;
            const candidate = firstTimeHackers.find(p => 
                p.roles?.[0] === role || 
                p.roles?.includes('Any')
            );
            if (candidate) {
                team.push(candidate);
                firstTimeHackers = firstTimeHackers.filter(p => p._id.toString() !== candidate._id.toString());
                usedRoles.add(role);
            }
        }

        // Fill remaining roles from first-time hackers
        for (const role of requiredRoles) {
            if (!usedRoles.has(role)) {
                const candidate = firstTimeHackers.find(p => 
                    p.roles?.includes(role) || 
                    p.roles?.includes('Any')
                );
                if (candidate) {
                    team.push(candidate);
                    firstTimeHackers = firstTimeHackers.filter(p => p._id.toString() !== candidate._id.toString());
                    usedRoles.add(role);
                }
            }
        }

        if (usedRoles.size < requiredRoles.length) {
            break;
        }

        while (team.length < teamSize && firstTimeHackers.length > 0) {
            team.push(firstTimeHackers[0]);
            firstTimeHackers = firstTimeHackers.slice(1);
        }

        teams.push(team);
    }

    // Combine remaining participants
    let availableParticipants = [...firstTimeHackers, ...experiencedHackers];

    // Continue with the existing team formation logic for mixed teams
    while (availableParticipants.length >= teamSize) {
        const team = [];
        const usedRoles = new Set();
    
        // First pass: assign participants with fewer roles
        for (const role of requiredRoles) {
            if (usedRoles.has(role)) continue;
    
            // Look for exact role match first
            const candidate = availableParticipants.find(p => 
                p.roles?.[0] === role || 
                p.roles?.includes('Any')
            );
    
            if (candidate) {
                team.push(candidate);
                availableParticipants = availableParticipants.filter(
                    p => p._id.toString() !== candidate._id.toString()
                );
                usedRoles.add(role);
            }
        }
    
        // Second pass: fill remaining roles with any available matches
        for (const role of requiredRoles) {
            if (!usedRoles.has(role)) {
                const candidate = availableParticipants.find(p => 
                    p.roles?.includes(role) || 
                    p.roles?.includes('Any')
                );
                if (candidate) {
                    team.push(candidate);
                    availableParticipants = availableParticipants.filter(
                        p => p._id.toString() !== candidate._id.toString()
                    );
                    usedRoles.add(role);
                }
            }
        }

      // Check if team size is valid
      if (usedRoles.size < requiredRoles.length) {
        break;
      }

      // Backfill
      while (team.length < teamSize && availableParticipants.length > 0) {
        team.push(availableParticipants[0]);
        availableParticipants = availableParticipants.slice(1);
      }

      teams.push(team);
    }

    res.json({
      success: true,
      data: teams.map((team, index) =>
        team.map((member) => ({
          _id: member._id,
          name: member.name,
          email: member.email,
          phone: member.phone,
          roles: member.roles || [],
          skills: member.skills || [],
        }))
      ),
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
        
        // Clear existing teams
        await Team.deleteMany({});
        
        // Save new teams
        const savedTeams = await Promise.all(teams.map(async (teamMembers: any, index: number) => {
            return await Team.create({
                members: teamMembers,
                teamNumber: index + 1
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
