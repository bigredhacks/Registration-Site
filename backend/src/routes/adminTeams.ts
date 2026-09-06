import { Router, Request } from 'express';
import { supabase } from '../config/supabase';
import { validate } from '../middleware/validate';
import { SaveTeamsSchema } from '../types/team';
import { generateInviteCode } from '../types/userTeam';
import { TeamMatcher } from '../utils/teamMatcher';
import {
  buildTeamOverview, readAllRows, rollbackSavedDraft, validateTeamAssignment,
  type MatchingParticipant, type MembershipRow, type ProfileRow,
  type SavedMemberRow, type SavedTeamRow, type TeamRegistration, type UserTeamRow,
} from '../utils/adminTeams';

const router = Router();
const busyPools = new Set<string>();
const poolFor = (req: Request) => String(req.body?.pool_id || req.query.pool_id || 'default');
const formFor = (req: Request) => String(req.query.form_key || 'registration');
const memberships = () => readAllRows<MembershipRow>((from, to) => supabase.from('user_team_members')
  .select('team_id,user_id').order('user_id').range(from, to));
const participants = (pool: string) => readAllRows<MatchingParticipant>((from, to) => supabase.from('participants')
  .select('*').eq('pool_id', pool).order('id').range(from, to));

async function savedDrafts(pool: string) {
  const teams = await readAllRows<SavedTeamRow>((from, to) => supabase.from('teams')
    .select('id,team_number').eq('pool_id', pool).order('id').range(from, to));
  const members: SavedMemberRow[] = [];
  for (let offset = 0; offset < teams.length; offset += 100) {
    const ids = teams.slice(offset, offset + 100).map((team) => team.id);
    members.push(...await readAllRows<SavedMemberRow>((from, to) => supabase.from('team_members')
      .select('id,team_id,participant_id').in('team_id', ids).order('id').range(from, to)));
  }
  return { teams: teams.sort((a, b) => a.team_number - b.team_number), members };
}

async function overview(pool: string, formKey: string) {
  const [teams, members, people, registrations, profiles, saved] = await Promise.all([
    readAllRows<UserTeamRow>((from, to) => supabase.from('user_teams').select('id,name,invite_code').order('id').range(from, to)),
    memberships(), participants(pool),
    readAllRows<TeamRegistration>((from, to) => supabase.from('registrations')
      .select('id,user_id,email,first_name,last_name,status,form_key').eq('form_key', formKey).order('id').range(from, to)),
    readAllRows<ProfileRow>((from, to) => supabase.from('profiles')
      .select('id,full_name,first_name,last_name').order('id').range(from, to)),
    savedDrafts(pool),
  ]);
  return buildTeamOverview({ teams, memberships: members, participants: people, registrations,
    profiles, savedTeams: saved.teams, savedMembers: saved.members });
}

router.get('/admin', async (req, res) => {
  try { res.json(await overview(poolFor(req), formFor(req))); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Could not load teams.' }); }
});

router.get('/', async (req, res) => {
  try {
    const size = Number(req.query.team_size || 4);
    if (!Number.isInteger(size) || size < 2 || size > 4) {
      res.status(400).json({ error: 'Team size must be between 2 and 4.' });
      return;
    }
    const pool = poolFor(req);
    const data = await overview(pool, formFor(req));
    const candidates = data.looking;
    const groups = candidates.length >= size ? TeamMatcher.formTeams(candidates, size, pool)
      : candidates.length >= 2 ? [candidates] : [];
    const used = new Set(groups.flatMap((group) => group.map((member) => member.id)));
    res.json({ pool_id: pool, team_size: size, total_participants: candidates.length,
      teams: groups.map((members, index) => ({ team_number: index + 1, members })),
      unmatched: candidates.filter((candidate) => !used.has(candidate.id)),
    });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Could not generate teams.' }); }
});

router.get('/saved', async (req, res) => {
  try {
    const data = await overview(poolFor(req), formFor(req));
    res.json(data.savedTeams.map((team) => ({ ...team,
      members: team.members.map((participant) => ({ id: participant.id, participant_id: participant.id, participant })),
    })));
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Could not load drafts.' }); }
});

router.post('/save', validate({ body: SaveTeamsSchema }), async (req, res) => {
  const pool = poolFor(req);
  if (busyPools.has(pool)) { res.status(409).json({ error: 'This pool is being updated. Try again.' }); return; }
  busyPools.add(pool);
  try {
    const [people, currentMembers, previous] = await Promise.all([participants(pool), memberships(), savedDrafts(pool)]);
    const teams = req.body.teams as Array<{ team_number: number; members: Array<{ participant_id: string }> }>;
    const assignmentError = validateTeamAssignment(teams, people, currentMembers);
    if (assignmentError) { res.status(409).json({ error: assignmentError }); return; }
    if (new Set(teams.map((team) => team.team_number)).size !== teams.length) {
      res.status(400).json({ error: 'Draft team numbers must be unique.' }); return;
    }
    const deleteDraftTeams = async (ids: string[]) => {
      const { error } = await supabase.from('teams').delete().in('id', ids);
      if (error) throw new Error(error.message);
    };
    if (previous.teams.length) await deleteDraftTeams(previous.teams.map((team) => team.id));
    const createdIds: string[] = [];
    try {
      const ids = new Map<number, string>();
      for (let offset = 0; offset < teams.length; offset += 500) {
        const inserted = await supabase.from('teams').insert(teams.slice(offset, offset + 500)
          .map((team) => ({ team_number: team.team_number, pool_id: pool }))).select('id,team_number');
        if (inserted.error) throw new Error(inserted.error.message);
        for (const team of inserted.data ?? []) { ids.set(team.team_number, team.id); createdIds.push(team.id); }
      }
      const memberRows = teams.flatMap((team) => team.members.map((member) => ({ team_id: ids.get(team.team_number), participant_id: member.participant_id })));
      for (let offset = 0; offset < memberRows.length; offset += 500) {
        const saved = await supabase.from('team_members').insert(memberRows.slice(offset, offset + 500));
        if (saved.error) throw new Error(saved.error.message);
      }
    } catch (error) {
      await rollbackSavedDraft(previous, createdIds, {
        deleteTeams: deleteDraftTeams,
        listTeams: async () => (await savedDrafts(pool)).teams,
        restoreTeams: async (rows) => {
          const restored = await supabase.from('teams').insert(rows.map((team) => ({ ...team, pool_id: pool })));
          if (restored.error) throw new Error(`Could not restore the previous draft: ${restored.error.message}`);
        },
        restoreMembers: async (rows) => {
          const restored = await supabase.from('team_members').insert(rows);
          if (restored.error) throw new Error(`Could not restore previous draft members: ${restored.error.message}`);
        },
      });
      throw error;
    }
    res.status(201).json({ message: 'Draft saved.' });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Could not save teams.' }); }
  finally { busyPools.delete(pool); }
});

router.post('/publish', async (req, res) => {
  const pool = poolFor(req);
  if (busyPools.has(pool)) { res.status(409).json({ error: 'This pool is being updated. Try again.' }); return; }
  busyPools.add(pool);
  const createdIds: string[] = [];
  try {
    const [saved, people, currentMembers] = await Promise.all([savedDrafts(pool), participants(pool), memberships()]);
    const teams = saved.teams.map((team) => ({ ...team, members: saved.members.filter((member) => member.team_id === team.id) }));
    const assignmentError = validateTeamAssignment(teams, people, currentMembers);
    if (assignmentError) { res.status(409).json({ error: assignmentError }); return; }
    const peopleById = new Map(people.map((person) => [person.id, person]));
    for (const team of teams) {
      let createdId: string | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const created = await supabase.from('user_teams').insert({ name: `${pool} Match Team ${team.team_number}`,
          invite_code: generateInviteCode(), created_by: req.user!.id }).select('id').single();
        if (!created.error && created.data) { createdId = created.data.id; break; }
        if (created.error?.code !== '23505' || attempt === 4) throw new Error(created.error?.message || 'Could not create team.');
      }
      if (!createdId) throw new Error('Could not create team.');
      createdIds.push(createdId);
      const inserted = await supabase.from('user_team_members').insert(team.members.map((member) => ({
        team_id: createdId, user_id: peopleById.get(member.participant_id)!.user_id,
      })));
      if (inserted.error) throw new Error(inserted.error.message);
    }
    // Consume this saved batch so a later repeat cannot republish it after members leave.
    const consumed = await supabase.from('teams').delete().in('id', saved.teams.map((team) => team.id));
    if (consumed.error) throw new Error(consumed.error.message);
    res.status(201).json({ published_teams: createdIds.length, affected_users: saved.members.length });
  } catch (error) {
    // Roll back only teams created by this request. Never remove an existing membership.
    if (createdIds.length) {
      const rollbackMembers = await supabase.from('user_team_members').delete().in('team_id', createdIds);
      const rollbackTeams = await supabase.from('user_teams').delete().in('id', createdIds);
      if (rollbackMembers.error || rollbackTeams.error) {
        res.status(500).json({ error: 'Publishing failed and some new teams could not be removed. Refresh existing teams before retrying.' });
        return;
      }
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Could not publish teams.' });
  } finally { busyPools.delete(pool); }
});

export default router;
