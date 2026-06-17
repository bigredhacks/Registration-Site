import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { Participant } from '../types/participant';
import { SaveTeamsBody, SaveTeamsSchema } from '../types/team';
import { TeamMatcher } from '../utils/teamMatcher';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * GET /api/teams
 *
 * Generates teams from participants in the given pool (does not save).
 * Query params: pool_id (default: 'default'), team_size (default: 4)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const poolId = (req.query.pool_id as string) || 'default';
    const teamSize = parseInt(req.query.team_size as string) || 4;

    const { data: participants, error } = await supabase
      .from('participants')
      .select('*')
      .eq('pool_id', poolId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!participants || participants.length === 0) {
      res.json({ teams: [], message: 'No participants found in pool' });
      return;
    }

    const teams = TeamMatcher.formTeams(participants as Participant[], teamSize, poolId);

    res.json({
      pool_id: poolId,
      team_size: teamSize,
      total_participants: participants.length,
      total_teams: teams.length,
      teams: teams.map((team, index) => ({
        team_number: index + 1,
        members: team,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/teams/save
 *
 * Persists generated teams to Supabase.
 * Deletes existing teams for the pool before inserting new ones.
 */
router.post(
  '/save',
  validate({ body: SaveTeamsSchema }),
  async (req: Request<{}, {}, SaveTeamsBody>, res: Response) => {
    try {
      const { pool_id, teams } = req.body;

      // Delete existing teams for this pool
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('pool_id', pool_id);

      if (deleteError) {
        res.status(500).json({ error: deleteError.message });
        return;
      }

      // Insert new teams
      for (const team of teams) {
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .insert({ team_number: team.team_number, pool_id })
          .select()
          .single();

        if (teamError) {
          res.status(500).json({ error: teamError.message });
          return;
        }

        // Insert team members
        const memberRows = team.members.map((m) => ({
          team_id: teamData.id,
          participant_id: m.participant_id,
        }));

        const { error: membersError } = await supabase
          .from('team_members')
          .insert(memberRows);

        if (membersError) {
          res.status(500).json({ error: membersError.message });
          return;
        }
      }

      res.status(201).json({ message: 'Teams saved successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/teams/saved
 *
 * Retrieves saved teams with their members for a given pool.
 * Query param: pool_id (default: 'default')
 */
router.get('/saved', async (req: Request, res: Response) => {
  try {
    const poolId = (req.query.pool_id as string) || 'default';

    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        members:team_members (
          id,
          participant_id,
          participant:participants (
            id, email, full_name, hacker_type,
            frontend_experience, backend_experience, design_experience, hardware_experience,
            frontend_preference, backend_preference, design_preference, hardware_preference,
            any_role_preference,
            frontend_skills, backend_skills, design_skills, hardware_skills
          )
        )
      `)
      .eq('pool_id', poolId)
      .order('team_number', { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
