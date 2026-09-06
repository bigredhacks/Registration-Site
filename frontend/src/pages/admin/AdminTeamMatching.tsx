import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast/ToastContext";
import { useAdminSelection } from "./AdminSelectionContext";
import type { AdminStudent } from "./adminApprovalState";
import {
  buildGenerateDraftErrorState, buildGenerateDraftSuccessState, teamMatchesSearch, uniqueTeamStudents,
  type ExistingTeam, type MatcherTeam, type ParticipantSummary, type TeamOverview,
} from "./adminTeamMatchingState";

const control = "min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-poppins focus:border-red5 focus:outline-none";
const button = "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-poppins font-medium text-gray-700 hover:border-red5 hover:text-red5 disabled:cursor-not-allowed disabled:opacity-40";
const primary = "rounded-lg bg-red5 px-3 py-2 text-sm font-poppins font-semibold text-white hover:bg-red3 disabled:cursor-not-allowed disabled:opacity-40";
const statusLabels: Record<string, string> = { approved: "Approved", pending: "Pending", rejected: "Rejected", waitlisted: "Waitlisted", mixed: "Mixed", missing_application: "Missing application" };
const emptyOverview: TeamOverview = { teams: [], participants: [], looking: [], savedTeams: [], registrations: [] };

export default function AdminTeamMatching() {
  const { showToast } = useToast();
  const { selected, add, remove, toggle, sync, revision, formKey } = useAdminSelection();
  const [tab, setTab] = useState<"teams" | "looking" | "drafts">("teams");
  const [poolInput, setPoolInput] = useState("default");
  const [poolId, setPoolId] = useState("default");
  const [teamSize, setTeamSize] = useState("4");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState<TeamOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof buildGenerateDraftSuccessState> | null>(null);
  const [busy, setBusy] = useState<"generate" | "save" | "publish" | null>(null);
  const requestId = useRef(0);
  const draftEpoch = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pool_id: poolId, form_key: formKey });
      const response = await apiFetch(`/api/teams/admin?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load teams.");
      if (id === requestId.current) {
        const overview = body as TeamOverview;
        setData(overview);
        sync(uniqueTeamStudents(overview.registrations ?? [], formKey));
      }
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : "Could not load teams.");
    } finally { if (id === requestId.current) setLoading(false); }
  }, [poolId, formKey, sync]);

  useEffect(() => {
    setData(emptyOverview);
    setDraft(null);
    draftEpoch.current += 1;
  }, [poolId, formKey]);
  useEffect(() => {
    void refresh();
    return () => { requestId.current += 1; };
  }, [refresh, revision]);

  const participantsById = useMemo(() => new Map(data.participants.map((person) => [person.id, person])), [data.participants]);
  const hydrate = (person: ParticipantSummary) => participantsById.get(person.id) ?? person;
  const filteredTeams = data.teams.filter((team) => (!status || team.status === status) && teamMatchesSearch(team, query));
  const filteredPeople = data.looking.filter((person) => (!status || (person.registration?.status ?? "missing_application") === status)
    && [person.full_name, person.email].some((value) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const filteredStudents = uniqueTeamStudents(tab === "teams"
    ? filteredTeams.flatMap((team) => team.members.map((member) => member.registration))
    : filteredPeople.map((person) => person.registration), formKey);
  const savedConflicts = data.savedTeams.reduce((total, team) => total + (team.conflicts ?? 0) + (team.missing_members ?? 0), 0);
  const currentDraft = draft?.draftTeams.map((team) => ({ ...team, members: team.members.map(hydrate) })) ?? [];
  const currentConflicts = currentDraft.some((team) => team.members.some((member) => member.current_team_name));

  const runAction = async (action: "generate" | "save" | "publish") => {
    const epoch = draftEpoch.current;
    setBusy(action);
    try {
      const params = new URLSearchParams({ pool_id: poolId, form_key: formKey, team_size: teamSize });
      const response = action === "generate"
        ? await apiFetch(`/api/teams?${params}`)
        : await apiFetch(`/api/teams/${action}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pool_id: poolId, ...(action === "save" ? {
            teams: currentDraft.map((team) => ({ team_number: team.team_number, pool_id: poolId,
              members: team.members.map((member) => ({ participant_id: member.id })) })),
          } : {}) }),
        });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Could not ${action} teams.`);
      if (epoch !== draftEpoch.current) return;
      if (action === "generate") setDraft(buildGenerateDraftSuccessState(body));
      else {
        showToast(action === "save" ? "Draft saved." : `Published ${body.published_teams} teams.`, "success");
        if (action === "publish") setDraft(null);
        await refresh();
      }
    } catch (cause) {
      if (epoch !== draftEpoch.current) return;
      const message = cause instanceof Error ? cause.message : `Could not ${action} teams.`;
      if (action === "generate") setDraft(buildGenerateDraftErrorState(message));
      showToast(message, "error");
      if (action !== "generate") await refresh();
    } finally { setBusy(null); }
  };

  const selectTeam = (team: ExistingTeam) => {
    const students = uniqueTeamStudents(team.members.map((member) => member.registration), formKey);
    if (students.length && students.every((student) => selected.has(student.id))) students.forEach((student) => remove(student.id));
    else add(students);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 font-poppins">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1" role="tablist" aria-label="Team views">
          {([['teams', 'Existing teams', data.teams.length], ['looking', 'Looking for teams', data.looking.length], ['drafts', 'Match drafts', data.savedTeams.length]] as const).map(([key, label, count]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setStatus(""); }}
              className={`rounded-md px-3 py-2 text-xs font-semibold ${tab === key ? 'bg-red7 text-red6' : 'text-gray-500 hover:bg-gray-50'}`}>
              {label} <span className="ml-1 tabular-nums opacity-65">{loading ? '…' : count}</span>
            </button>
          ))}
        </div>
        <button type="button" className={button} disabled={loading || !!busy} onClick={() => void refresh()}>Refresh</button>
      </div>

      {tab !== 'teams' && (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); if (poolInput.trim()) setPoolId(poolInput.trim()); }}>
          <label htmlFor="team-pool" className="text-xs font-semibold text-gray-600">Pool</label>
          <input id="team-pool" className={`${control} w-40`} value={poolInput} onChange={(event) => setPoolInput(event.target.value)} disabled={!!busy} />
          <button className={button} disabled={!!busy || !poolInput.trim() || poolInput.trim() === poolId}>Load pool</button>
        </form>
      )}

      {error && <div role="alert" className="rounded-lg border border-red5/20 bg-red7 p-3 text-sm text-red6">{error}</div>}
      {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading teams…</p> : error ? null : tab !== 'drafts' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" aria-label="Search teams or students" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'teams' ? 'Team, name, or email' : 'Name or email'} className={`${control} flex-1`} />
            <select aria-label="Filter team admission status" value={status} onChange={(event) => setStatus(event.target.value)} className={control}>
              <option value="">All statuses</option>
              {Object.entries(statusLabels).filter(([key]) => tab === 'teams' || key !== 'mixed').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" className={button} disabled={!filteredStudents.length} onClick={() => add(filteredStudents)}>
              Add {tab === 'teams' ? 'filtered teams' : 'filtered students'} ({filteredStudents.length})
            </button>
          </div>
          {tab === 'teams' ? (
            <div className="flex flex-col gap-3">
              {!filteredTeams.length && <Empty>No teams found.</Empty>}
              {filteredTeams.map((team) => {
                const students = uniqueTeamStudents(team.members.map((member) => member.registration), formKey);
                const selectedCount = students.filter((student) => selected.has(student.id)).length;
                const approvedCount = team.members.filter((member) => member.registration?.status === 'approved').length;
                return (
                  <section key={team.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <input type="checkbox" aria-label={`Select team ${team.name}`} disabled={!students.length}
                        checked={students.length > 0 && selectedCount === students.length} ref={(node) => { if (node) node.indeterminate = selectedCount > 0 && selectedCount < students.length; }}
                        onChange={() => selectTeam(team)} className="size-4 accent-red5" />
                      <h2 className="min-w-0 flex-1 break-words text-sm font-semibold text-gray-900">{team.name}</h2>
                      <span className="text-xs tabular-nums text-gray-500">{team.members.length}/4 members · {approvedCount} approved</span>
                      <Status value={team.status} />
                    </div>
                    <div className="divide-y divide-gray-100">
                      {team.members.map((member) => <StudentRow key={member.user_id} name={member.full_name} email={member.email} registration={member.registration}
                        checked={!!member.registration && selected.has(member.registration.id)} onToggle={() => member.registration && toggle(member.registration)} />)}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              {!filteredPeople.length ? <Empty>No students found.</Empty> : <div className="divide-y divide-gray-100">
                {filteredPeople.map((person) => <StudentRow key={person.id} name={person.full_name} email={person.email} registration={person.registration}
                  participant={person}
                  secondary={person.hacker_type === 'FirstTimeHacker' ? 'First-time hacker' : 'Veteran hacker'}
                  checked={!!person.registration && selected.has(person.registration.id)} onToggle={() => person.registration && toggle(person.registration)} />)}
              </div>}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="matcher-size" className="text-xs font-semibold text-gray-600">Team size</label>
            <select id="matcher-size" value={teamSize} onChange={(event) => setTeamSize(event.target.value)} disabled={!!busy} className={control}>
              <option value="2">2</option><option value="3">3</option><option value="4">4</option>
            </select>
            <button type="button" className={primary} disabled={!!busy || data.looking.length < 2} onClick={() => void runAction('generate')}>{busy === 'generate' ? 'Generating…' : 'Generate draft'}</button>
            <span className="text-xs text-gray-500">{data.looking.length} available</span>
          </div>
          {draft && <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Current draft <span className="ml-1 font-normal text-gray-500">{currentDraft.length} teams</span></h2>
              <button type="button" className={button} disabled={!!busy || !currentDraft.length || currentConflicts} onClick={() => void runAction('save')}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
            </div>
            {draft.generateError && <p role="alert" className="text-sm text-red6">{draft.generateError}</p>}
            {currentConflicts && <p className="text-xs text-red6">Some draft members now belong to existing teams. Generate a new draft.</p>}
            <DraftList teams={currentDraft} onAdd={(people) => add(uniqueTeamStudents(people.map((person) => person.registration), formKey))} />
            {!!draft.unmatched.length && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <h3 className="text-xs font-semibold text-amber-900">Unmatched ({draft.unmatched.length})</h3>
              {draft.unmatched.map(hydrate).map((person) => <p key={person.id} className="mt-1 text-sm text-amber-900">{person.full_name} · {person.email}</p>)}
            </div>}
          </section>}
          <section className="flex flex-col gap-3 border-t border-gray-200 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Saved draft <span className="ml-1 font-normal text-gray-500">{data.savedTeams.length} teams</span></h2>
              <button type="button" className={primary} disabled={!!busy || !data.savedTeams.length || savedConflicts > 0} onClick={() => void runAction('publish')}>{busy === 'publish' ? 'Publishing…' : 'Publish teams'}</button>
            </div>
            {savedConflicts > 0 && <p className="text-xs text-red6">{savedConflicts} members are already on teams or no longer available. Generate and save a new draft.</p>}
            {!data.savedTeams.length ? <Empty>No saved draft.</Empty> : <DraftList teams={data.savedTeams} onAdd={(people) => add(uniqueTeamStudents(people.map((person) => person.registration), formKey))} />}
          </section>
        </>
      )}
    </div>
  );
}

function Status({ value }: { value: string }) {
  const color = value === 'approved' ? 'bg-green-50 text-green-800' : value === 'rejected' ? 'bg-red-50 text-red-800'
    : value === 'missing_application' || value === 'mixed' ? 'bg-amber-50 text-amber-900' : 'bg-gray-100 text-gray-600';
  return <span className={`whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium ${color}`}>{statusLabels[value] ?? value}</span>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-gray-500">{children}</p>;
}
function StudentRow({ name, email, registration, checked, onToggle, secondary, participant }: {
  name: string; email: string; registration?: AdminStudent | null; checked: boolean; onToggle: () => void; secondary?: string; participant?: ParticipantSummary;
}) {
  return <div className="flex flex-wrap items-center gap-3 px-4 py-3">
    <input type="checkbox" aria-label={`Select ${email || name}`} checked={checked} disabled={!registration} onChange={onToggle} className="size-4 accent-red5" />
    <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-gray-800">{name}</p><p className="break-all text-xs text-gray-500">{email || 'Email unavailable'}</p></div>
    {secondary && <span className="hidden text-xs text-gray-500 sm:block">{secondary}</span>}
    <Status value={registration?.status ?? 'missing_application'} />
    {participant && <MatchingDetails participant={participant} />}
  </div>;
}

function MatchingDetails({ participant }: { participant: ParticipantSummary }) {
  const rows = [
    { role: 'Frontend', experience: participant.frontend_experience, preference: participant.frontend_preference, skills: participant.frontend_skills },
    { role: 'Backend', experience: participant.backend_experience, preference: participant.backend_preference, skills: participant.backend_skills },
    { role: 'Design', experience: participant.design_experience, preference: participant.design_preference, skills: participant.design_skills },
    { role: 'Hardware', experience: participant.hardware_experience, preference: participant.hardware_preference, skills: participant.hardware_skills },
  ];
  return <details className="min-w-0 basis-full pl-7 text-xs">
    <summary className="w-fit cursor-pointer select-none font-medium text-gray-600 hover:text-red5">Matching details</summary>
    <div className="mt-3 overflow-x-auto rounded-md border border-gray-100">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-500"><tr>
          {['Role', 'Experience', 'Preference', 'Skills'].map((label) => <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-gray-100 text-gray-700">{rows.map((row) => <tr key={row.role}>
          <th scope="row" className="px-3 py-2 font-medium">{row.role}</th>
          <td className="px-3 py-2">{row.experience || '—'}</td>
          <td className="px-3 py-2 tabular-nums">{row.preference === undefined ? '—' : `${row.preference}/5`}</td>
          <td className="min-w-32 px-3 py-2">{row.skills?.join(', ') || '—'}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="mt-2 text-gray-500">Any role: {participant.any_role_preference === undefined ? '—' : `${participant.any_role_preference}/5`}</p>
  </details>;
}
function DraftList({ teams, onAdd }: { teams: MatcherTeam[]; onAdd: (people: ParticipantSummary[]) => void }) {
  return <div className="grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-2">
    {teams.map((team) => <div key={team.id ?? team.team_number} className="min-w-0 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-gray-900">Team {team.team_number}</h3>
        <button type="button" className="text-xs font-semibold text-red5 disabled:opacity-40" disabled={!team.members.some((member) => member.registration)} onClick={() => onAdd(team.members)}>Add students</button></div>
      <ul className="space-y-3">{team.members.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1"><p className="break-words text-xs font-medium text-gray-800">{member.full_name}</p><p className="break-all text-xs text-gray-500">{member.email}</p>
          {member.current_team_name && <p className="text-xs text-amber-800">On {member.current_team_name}</p>}</div>
        <Status value={member.registration?.status ?? 'missing_application'} />
      </li>)}</ul>
    </div>)}
  </div>;
}
