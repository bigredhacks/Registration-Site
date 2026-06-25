import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { Participant } from '../types/participant';
import { SaveTeamsBody, SaveTeamsSchema } from '../types/team';
import {
  CreateUserTeamBody,
  CreateUserTeamSchema,
  JoinUserTeamBody,
  JoinUserTeamSchema,
  generateInviteCode,
} from '../types/userTeam';
import { TeamMatcher } from '../utils/teamMatcher';
import { validate } from '../middleware/validate';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();
const adminRouter = Router();

const MAX_TEAM_SIZE = 4;

interface PublishedParticipant {
  id: string;
  user_id: string;
  full_name: string | null;
}

async function deleteEmptyUserTeams(teamIds: string[]) {
  if (teamIds.length === 0) return;

  for (const teamId of [...new Set(teamIds)]) {
    const { count, error } = await supabase
      .from('user_team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if (error) {
      throw error;
    }

    if ((count ?? 0) === 0) {
      const { error: deleteError } = await supabase
        .from('user_teams')
        .delete()
        .eq('id', teamId);

      if (deleteError) {
        throw deleteError;
      }
    }
  }
}

function normalizePublishedParticipant(value: unknown): PublishedParticipant | null {
  if (Array.isArray(value)) {
    return normalizePublishedParticipant(value[0]);
  }
  if (!value || typeof value !== 'object') {
    return null;
  }

  const participant = value as Record<string, unknown>;
  if (typeof participant.user_id !== 'string' || participant.user_id.length === 0) {
    return null;
  }

  return {
    id: String(participant.id ?? ''),
    user_id: participant.user_id,
    full_name: typeof participant.full_name === 'string' ? participant.full_name : null,
  };
}

// ─── User-managed team routes ──────────────────────────────────────────────

/**
 * GET /api/teams/me
 * Returns the caller's current team with members, or 404.
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const { data: membership, error: memberError } = await supabase
      .from('user_team_members')
      .select('team_id, joined_at')
      .eq('user_id', req.user!.id)
      .maybeSingle();

    if (memberError) {
      res.status(500).json({ error: memberError.message });
      return;
    }
    if (!membership) {
      res.status(404).json({ error: 'Not on a team' });
      return;
    }

    const { data: team, error: teamError } = await supabase
      .from('user_teams')
      .select('id, name, invite_code, created_by, created_at')
      .eq('id', membership.team_id)
      .single();

    if (teamError) {
      res.status(500).json({ error: teamError.message });
      return;
    }

    const { data: members, error: membersError } = await supabase
      .from('user_team_members')
      .select('user_id, joined_at')
      .eq('team_id', membership.team_id);

    if (membersError) {
      res.status(500).json({ error: membersError.message });
      return;
    }

    // Hydrate members with profile/email so the UI can show names.
    const userIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name')
      .in('id', userIds);

    const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

    res.json({
      ...team,
      members: (members ?? []).map((m) => {
        const p = profilesById.get(m.user_id);
        const fullName =
          p?.full_name ||
          [p?.first_name, p?.last_name].filter(Boolean).join(' ') ||
          'Teammate';
        return {
          user_id: m.user_id,
          full_name: fullName,
          joined_at: m.joined_at,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/teams/create
 * Creates a team owned by the caller and adds them as the first member.
 * 409 if the caller is already on a team.
 */
router.post(
  '/create',
  validate({ body: CreateUserTeamSchema }),
  async (req: Request<{}, {}, CreateUserTeamBody>, res: Response) => {
    try {
      const { data: existing } = await supabase
        .from('user_team_members')
        .select('team_id')
        .eq('user_id', req.user!.id)
        .maybeSingle();

      if (existing) {
        res.status(409).json({ error: 'Already on a team. Leave first.' });
        return;
      }

      // Try a few invite codes in case of unique-constraint collision.
      let team: { id: string; name: string; invite_code: string } | null = null;
      let lastError: string | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const invite_code = generateInviteCode();
        const { data, error } = await supabase
          .from('user_teams')
          .insert({
            name: req.body.name,
            invite_code,
            created_by: req.user!.id,
          })
          .select('id, name, invite_code')
          .single();

        if (!error && data) {
          team = data;
          break;
        }
        lastError = error?.message ?? 'unknown';
        if (!error?.message?.includes('duplicate')) break;
      }

      if (!team) {
        res.status(500).json({ error: lastError ?? 'Failed to create team' });
        return;
      }

      const { error: memberError } = await supabase
        .from('user_team_members')
        .insert({ team_id: team.id, user_id: req.user!.id });

      if (memberError) {
        // Roll back the team if we couldn't add the creator.
        await supabase.from('user_teams').delete().eq('id', team.id);
        res.status(500).json({ error: memberError.message });
        return;
      }

      res.status(201).json(team);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/teams/join
 * Joins the team identified by invite_code.
 * 404 if no team with that code; 409 if caller already on a team.
 */
router.post(
  '/join',
  validate({ body: JoinUserTeamSchema }),
  async (req: Request<{}, {}, JoinUserTeamBody>, res: Response) => {
    try {
      const { data: existing } = await supabase
        .from('user_team_members')
        .select('team_id')
        .eq('user_id', req.user!.id)
        .maybeSingle();

      if (existing) {
        res.status(409).json({ error: 'Already on a team. Leave first.' });
        return;
      }

      const { data: team, error: teamError } = await supabase
        .from('user_teams')
        .select('id, name, invite_code')
        .eq('invite_code', req.body.invite_code)
        .maybeSingle();

      if (teamError) {
        res.status(500).json({ error: teamError.message });
        return;
      }
      if (!team) {
        res.status(404).json({ error: 'Invalid invite code' });
        return;
      }

      const { count, error: countError } = await supabase
        .from('user_team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id);

      if (countError) {
        res.status(500).json({ error: countError.message });
        return;
      }
      if ((count ?? 0) >= MAX_TEAM_SIZE) {
        res.status(409).json({ error: `Team is full (max ${MAX_TEAM_SIZE} members).` });
        return;
      }

      const { error } = await supabase
        .from('user_team_members')
        .insert({ team_id: team.id, user_id: req.user!.id });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(201).json(team);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/teams/leave
 * Removes the caller from their team. If the team becomes empty, deletes it.
 */
router.post('/leave', async (req: Request, res: Response) => {
  try {
    const { data: membership, error: memberError } = await supabase
      .from('user_team_members')
      .select('team_id')
      .eq('user_id', req.user!.id)
      .maybeSingle();

    if (memberError) {
      res.status(500).json({ error: memberError.message });
      return;
    }
    if (!membership) {
      res.status(404).json({ error: 'Not on a team' });
      return;
    }

    const { error: deleteError } = await supabase
      .from('user_team_members')
      .delete()
      .eq('user_id', req.user!.id)
      .eq('team_id', membership.team_id);

    if (deleteError) {
      res.status(500).json({ error: deleteError.message });
      return;
    }

    const { count, error: countError } = await supabase
      .from('user_team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', membership.team_id);

    if (countError) {
      res.status(500).json({ error: countError.message });
      return;
    }

    if ((count ?? 0) === 0) {
      await supabase.from('user_teams').delete().eq('id', membership.team_id);
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Admin-only team-matcher routes ────────────────────────────────────────
// Mounted on a sub-router with requireAdmin so the guard is declared once
// rather than repeated in every handler.

router.use(adminRouter);
adminRouter.use(requireAdmin);

/**
 * GET /api/teams
 * Admin-only: runs the team matcher for a pool (does not save).
 */
adminRouter.get('/', async (req: Request, res: Response) => {
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
 * Admin-only: persists generated teams (replaces any existing teams in the pool).
 */
adminRouter.post(
  '/save',
  validate({ body: SaveTeamsSchema }),
  async (req: Request<{}, {}, SaveTeamsBody>, res: Response) => {
    try {
      const { pool_id, teams } = req.body;

      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('pool_id', pool_id);

      if (deleteError) {
        res.status(500).json({ error: deleteError.message });
        return;
      }

      // Two bulk inserts beat one-team-at-a-time: O(2) round-trips instead of
      // O(2N), so saving 25 teams of 4 stops being 50 sequential DB calls.
      const { data: insertedTeams, error: teamsError } = await supabase
        .from('teams')
        .insert(teams.map((t) => ({ team_number: t.team_number, pool_id })))
        .select('id, team_number');

      if (teamsError) {
        res.status(500).json({ error: teamsError.message });
        return;
      }

      const teamIdByNumber = new Map(
        (insertedTeams ?? []).map((t) => [t.team_number, t.id]),
      );
      const memberRows = teams.flatMap((t) =>
        t.members.map((m) => ({
          team_id: teamIdByNumber.get(t.team_number),
          participant_id: m.participant_id,
        })),
      );

      if (memberRows.length > 0) {
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
 * Admin-only: retrieves saved matcher teams with members for a pool.
 */
adminRouter.get('/saved', async (req: Request, res: Response) => {
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
            id, user_id, email, full_name, hacker_type,
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

/**
 * POST /api/teams/publish
 * Admin-only: publishes saved matcher teams into the real user team model.
 */
adminRouter.post('/publish', async (req: Request, res: Response) => {
  try {
    const poolId = String(req.body?.pool_id || req.query.pool_id || 'default');

    const { data: savedTeams, error: savedTeamsError } = await supabase
      .from('teams')
      .select(`
        id,
        team_number,
        members:team_members (
          participant:participants (
            id,
            user_id,
            full_name
          )
        )
      `)
      .eq('pool_id', poolId)
      .order('team_number', { ascending: true });

    if (savedTeamsError) {
      res.status(500).json({ error: savedTeamsError.message });
      return;
    }
    if (!savedTeams || savedTeams.length === 0) {
      res.status(404).json({ error: 'No saved matcher teams found for this pool' });
      return;
    }

    const usersToPublish = savedTeams.flatMap((team) =>
      (team.members ?? [])
        .map((member) => normalizePublishedParticipant(member.participant))
        .filter((participant): participant is PublishedParticipant => participant !== null)
        .map((participant) => participant.user_id),
    );

    if (usersToPublish.length === 0) {
      res.status(400).json({ error: 'Saved teams do not contain publishable user accounts' });
      return;
    }

    const { data: existingMemberships, error: existingMembershipsError } = await supabase
      .from('user_team_members')
      .select('team_id, user_id')
      .in('user_id', usersToPublish);

    if (existingMembershipsError) {
      res.status(500).json({ error: existingMembershipsError.message });
      return;
    }

    if ((existingMemberships ?? []).length > 0) {
      const impactedTeamIds = (existingMemberships ?? []).map((membership) => membership.team_id);
      const { error: deleteMembershipsError } = await supabase
        .from('user_team_members')
        .delete()
        .in('user_id', usersToPublish);

      if (deleteMembershipsError) {
        res.status(500).json({ error: deleteMembershipsError.message });
        return;
      }

      await deleteEmptyUserTeams(impactedTeamIds);
    }

    let publishedCount = 0;

    for (const savedTeam of savedTeams) {
      const members = (savedTeam.members ?? [])
        .map((member) => normalizePublishedParticipant(member.participant))
        .filter((participant): participant is PublishedParticipant => participant !== null);

      if (members.length === 0) {
        continue;
      }

      let createdTeam: { id: string } | null = null;
      let lastError: string | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const inviteCode = generateInviteCode();
        const { data: teamRow, error: createTeamError } = await supabase
          .from('user_teams')
          .insert({
            name: `${poolId} Match Team ${savedTeam.team_number}`,
            invite_code: inviteCode,
            created_by: req.user!.id,
          })
          .select('id')
          .single();

        if (!createTeamError && teamRow) {
          createdTeam = teamRow;
          break;
        }

        lastError = createTeamError?.message ?? 'Failed to create published team';
        if (!createTeamError?.message?.includes('duplicate')) {
          break;
        }
      }

      if (!createdTeam) {
        res.status(500).json({ error: lastError ?? 'Failed to create published team' });
        return;
      }

      const { error: insertMembersError } = await supabase
        .from('user_team_members')
        .insert(
          members.map((member) => ({
            team_id: createdTeam!.id,
            user_id: member.user_id,
          })),
        );

      if (insertMembersError) {
        await supabase.from('user_teams').delete().eq('id', createdTeam.id);
        res.status(500).json({ error: insertMembersError.message });
        return;
      }

      publishedCount += 1;
    }

    res.status(201).json({
      message: 'Matcher teams published to user teams',
      published_teams: publishedCount,
      affected_users: usersToPublish.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

export default router;
