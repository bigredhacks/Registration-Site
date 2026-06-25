import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast/ToastContext";
import {
  buildGenerateDraftErrorState,
  buildGenerateDraftSuccessState,
  type MatcherTeam,
  type ParticipantSummary,
} from "./adminTeamMatchingState";

interface SavedTeam {
  id: string;
  team_number: number;
  members: {
    id: string;
    participant_id: string;
    participant: ParticipantSummary;
  }[];
}

export default function AdminTeamMatching() {
  const { showToast } = useToast();
  const [poolId, setPoolId] = useState("default");
  const [teamSize, setTeamSize] = useState("4");
  const [participantsCount, setParticipantsCount] = useState<number | null>(null);
  const [draftTeams, setDraftTeams] = useState<MatcherTeam[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const refreshSaved = async () => {
    setLoadingSaved(true);
    const res = await apiFetch(`/api/teams/saved?pool_id=${encodeURIComponent(poolId)}`);
    if (!res.ok) {
      setSavedTeams([]);
      setLoadingSaved(false);
      return;
    }
    setSavedTeams(await res.json());
    setLoadingSaved(false);
  };

  useEffect(() => {
    refreshSaved().catch(() => setLoadingSaved(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId]);

  const handleGenerate = async () => {
    setRunning(true);
    const params = new URLSearchParams({
      pool_id: poolId,
      team_size: teamSize,
    });
    const res = await apiFetch(`/api/teams?${params.toString()}`);
    setRunning(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const nextState = buildGenerateDraftErrorState(
        body.error || "Could not run the team matcher.",
      );
      setParticipantsCount(nextState.participantsCount);
      setDraftTeams(nextState.draftTeams);
      setGenerateError(nextState.generateError);
      showToast(nextState.generateError ?? "Could not run the team matcher.", "error");
      return;
    }
    const body = await res.json();
    const nextState = buildGenerateDraftSuccessState(body);
    setParticipantsCount(nextState.participantsCount);
    setDraftTeams(nextState.draftTeams);
    setGenerateError(nextState.generateError);
  };

  const handleSave = async () => {
    if (draftTeams.length === 0) {
      showToast("Generate teams before saving them.", "error");
      return;
    }
    setSaving(true);
    const res = await apiFetch("/api/teams/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pool_id: poolId,
        teams: draftTeams.map((team) => ({
          team_number: team.team_number,
          pool_id: poolId,
          members: team.members.map((member) => ({ participant_id: member.id })),
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || "Could not save matcher teams.", "error");
      return;
    }
    showToast("Saved matcher teams.", "success");
    await refreshSaved();
  };

  const handlePublish = async () => {
    if (savedTeams.length === 0) {
      showToast("Save teams before publishing them.", "error");
      return;
    }
    setPublishing(true);
    const res = await apiFetch("/api/teams/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool_id: poolId }),
    });
    setPublishing(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || "Could not publish matcher teams.", "error");
      return;
    }
    const body = await res.json();
    showToast(
      `Published ${body.published_teams ?? 0} matcher teams to the real team system.`,
      "success",
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-red6/20 bg-white p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-poppins font-semibold uppercase tracking-widest text-gray-500">
              Pool ID
            </label>
            <input
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-poppins focus:border-red5 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-poppins font-semibold uppercase tracking-widest text-gray-500">
              Team Size
            </label>
            <input
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm font-poppins focus:border-red5 focus:outline-none"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={running}
            className="rounded-lg bg-red5 px-4 py-2 text-sm font-poppins font-semibold text-white transition-colors hover:bg-red3 disabled:opacity-50"
          >
            {running ? "Generating…" : "Generate Draft"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || draftTeams.length === 0}
            className="rounded-lg bg-red5 px-4 py-2 text-sm font-poppins font-semibold text-white transition-colors hover:bg-red3 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || savedTeams.length === 0}
            className="rounded-lg border border-red5 px-4 py-2 text-sm font-poppins font-semibold text-red5 transition-colors hover:bg-red5 hover:text-white disabled:opacity-50"
          >
            {publishing ? "Publishing…" : "Publish to User Teams"}
          </button>
        </div>
        <p className="mt-3 text-xs font-poppins text-gray-500">
          Draft teams stay in the matcher tables until you publish them into the real team system used by `/team`.
        </p>
        {participantsCount !== null && (
          <p className="mt-2 text-sm font-poppins text-gray-700">
            Generated draft for {participantsCount} participants across {draftTeams.length} teams.
          </p>
        )}
        {generateError && (
          <p className="mt-2 text-sm font-poppins text-red6">
            {generateError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TeamListCard
          title="Current Draft"
          emptyLabel="Run the matcher to preview draft teams."
          teams={draftTeams.map((team) => ({
            team_number: team.team_number,
            members: team.members,
          }))}
        />
        <TeamListCard
          title="Saved Drafts"
          emptyLabel={loadingSaved ? "Loading saved drafts…" : "No saved drafts for this pool."}
          teams={savedTeams.map((team) => ({
            team_number: team.team_number,
            members: team.members.map((member) => member.participant),
          }))}
        />
      </div>
    </div>
  );
}

function TeamListCard({
  title,
  emptyLabel,
  teams,
}: {
  title: string;
  emptyLabel: string;
  teams: Array<{ team_number: number; members: ParticipantSummary[] }>;
}) {
  return (
    <div className="rounded-lg border border-red6/20 bg-white p-5">
      <h2 className="mb-3 text-lg font-poppins font-semibold text-red6">{title}</h2>
      {teams.length === 0 ? (
        <p className="text-sm font-poppins text-gray-500">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {teams.map((team) => (
            <div key={team.team_number} className="rounded-lg border border-red6/10 bg-red7/30 px-4 py-3">
              <p className="text-sm font-poppins font-semibold text-gray-800">
                Team {team.team_number}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm font-poppins text-gray-600">
                {team.members.map((member) => (
                  <li key={member.id}>
                    {member.full_name} · {member.email} · {member.hacker_type}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
