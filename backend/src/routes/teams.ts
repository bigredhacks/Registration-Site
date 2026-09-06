import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  CreateUserTeamBody,
  CreateUserTeamSchema,
  JoinUserTeamBody,
  JoinUserTeamSchema,
  generateInviteCode,
} from '../types/userTeam';
import { validate } from '../middleware/validate';
import { requireAdmin } from '../middleware/requireAdmin';
import adminTeamsRouter from './adminTeams';

const router = Router();

const MAX_TEAM_SIZE = 4;

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

router.use(requireAdmin, adminTeamsRouter);

export default router;
