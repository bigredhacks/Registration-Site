import { useEffect, useState } from "react";
import {
  HasTeamView,
  NoTeamView,
  MatchingFormView,
  MatchingPendingView,
} from "@/components/team-matching";
import RegistrationLayout from "@/components/layouts/RegistrationLayout";
import { useToast } from "@/components/Toast/ToastContext";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/config/supabase";
import Modal from "@/components/Modal";

type TeamState =
  | "loading"
  | "no-team"
  | "matching-form"
  | "matching-pending"
  | "has-team";

interface UserTeam {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  members: { user_id: string; full_name: string; joined_at: string }[];
}

interface ParticipantSubmission {
  email: string;
  full_name: string;
  frontend_experience: string;
  backend_experience: string;
  design_experience: string;
  hardware_experience: string;
  frontend_preference: number;
  backend_preference: number;
  design_preference: number;
  hardware_preference: number;
  any_role_preference: number;
  frontend_skills: string[];
  backend_skills: string[];
  design_skills: string[];
  hacker_type: "FirstTimeHacker" | "VeteranHacker";
}

function participantToFormValues(participant: ParticipantSubmission): Record<string, unknown> {
  return {
    email: participant.email,
    full_name: participant.full_name,
    technical_skills: {
      Frontend: participant.frontend_experience,
      Backend: participant.backend_experience,
      Design: participant.design_experience,
      Hardware: participant.hardware_experience,
    },
    preferred_role: {
      Frontend: String(participant.frontend_preference),
      Backend: String(participant.backend_preference),
      Design: String(participant.design_preference),
      Hardware: String(participant.hardware_preference),
      Any: String(participant.any_role_preference),
    },
    frontend_skills: participant.frontend_skills.join(", "),
    backend_skills: participant.backend_skills.join(", "),
    design_skills: participant.design_skills.join(", "),
    first_time_hacker: participant.hacker_type === "FirstTimeHacker" ? "Yes" : "No",
  };
}

export default function TeamPage() {
  const [view, setView] = useState<TeamState>("loading");
  const [team, setTeam] = useState<UserTeam | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [matchingInitialValues, setMatchingInitialValues] = useState<Record<string, unknown>>({});
  const [hasMatchingSubmission, setHasMatchingSubmission] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leavingTeam, setLeavingTeam] = useState(false);
  const { showToast } = useToast();

  const refreshTeam = async () => {
    const res = await apiFetch("/api/teams/me");
    if (res.ok) {
      const data: UserTeam = await res.json();
      setTeam(data);
      setView("has-team");
      return;
    }
    setTeam(null);

    // No team — check if they've already submitted matching prefs.
    const prefsRes = await apiFetch("/api/participants/me");
    if (prefsRes.ok) {
      const participant = (await prefsRes.json()) as ParticipantSubmission;
      setMatchingInitialValues(participantToFormValues(participant));
      setHasMatchingSubmission(true);
      setView("matching-pending");
    } else {
      setMatchingInitialValues({});
      setHasMatchingSubmission(false);
      setView("no-team");
    }
  };

  useEffect(() => {
    // Resolve the current user before refreshing the team so the teammate
    // filter (which excludes the current user) doesn't briefly show the user
    // as their own teammate on slow networks.
    supabase.auth
      .getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null))
      .finally(() => {
        refreshTeam().catch(() => setView("no-team"));
      });
  }, []);

  const handleJoinTeam = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      showToast("Team codes are 6 characters.", "error");
      return;
    }
    const res = await apiFetch("/api/teams/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: trimmed }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || "Could not join team.", "error");
      return;
    }
    showToast("Joined team!", "success");
    setJoinCode("");
    await refreshTeam();
  };

  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (!name) {
      showToast("Enter a team name.", "error");
      return;
    }
    setCreatingTeam(true);
    const res = await apiFetch("/api/teams/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreatingTeam(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || "Could not create team.", "error");
      return;
    }
    showToast("Team created!", "success");
    setShowCreateTeamModal(false);
    setNewTeamName("");
    await refreshTeam();
  };

  const handleLeaveTeam = async () => {
    setLeavingTeam(true);
    const res = await apiFetch("/api/teams/leave", { method: "POST" });
    setLeavingTeam(false);
    if (!res.ok) {
      showToast("Could not leave team.", "error");
      return;
    }
    showToast("Left team.", "info");
    setShowLeaveConfirm(false);
    await refreshTeam();
  };

  const handleFillMatchForm = () => {
    setView("matching-form");
  };

  const handleMatchFormSubmit = async (data: Record<string, unknown>) => {
    const objectValue = (value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const skills = objectValue(data.technical_skills);
    const preferences = objectValue(data.preferred_role);
    const splitSkills = (value: unknown) =>
      String(value ?? "")
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean);

    const payload = {
      email: String(data.email ?? ""),
      full_name: String(data.full_name ?? ""),
      frontend_experience: String(skills.Frontend ?? ""),
      backend_experience: String(skills.Backend ?? ""),
      design_experience: String(skills.Design ?? ""),
      hardware_experience: String(skills.Hardware ?? ""),
      frontend_preference: Number(preferences.Frontend),
      backend_preference: Number(preferences.Backend),
      design_preference: Number(preferences.Design),
      hardware_preference: Number(preferences.Hardware),
      any_role_preference: Number(preferences.Any),
      frontend_skills: splitSkills(data.frontend_skills),
      backend_skills: splitSkills(data.backend_skills),
      design_skills: splitSkills(data.design_skills),
      hardware_skills: [],
      hacker_type: data.first_time_hacker === "Yes" ? "FirstTimeHacker" : "VeteranHacker",
      pool_id: "default",
    };

    const response = await apiFetch(hasMatchingSubmission ? "/api/participants/me" : "/api/participants", {
      method: hasMatchingSubmission ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      showToast("Could not submit team matching preferences.", "error");
      throw new Error("Team matching submission failed");
    }

    showToast("Team matching preferences saved.", "success");
    setMatchingInitialValues(data);
    setHasMatchingSubmission(true);
    setView("matching-pending");
  };

  const handleEditPreferences = () => {
    setView("matching-form");
  };

  const renderView = () => {
    switch (view) {
      case "loading":
        return <p className="text-base text-[#cb4643]">Loading…</p>;
      case "no-team":
        return (
          <NoTeamView
            joinCode={joinCode}
            onJoinCodeChange={setJoinCode}
            onJoinTeam={handleJoinTeam}
            onCreateTeam={() => setShowCreateTeamModal(true)}
            onFillMatchForm={handleFillMatchForm}
          />
        );
      case "matching-form":
        return (
          <MatchingFormView
            onBack={() => setView("no-team")}
            onSubmit={handleMatchFormSubmit}
            initialValues={matchingInitialValues}
          />
        );
      case "matching-pending":
        return (
          <MatchingPendingView
            onEditPreferences={handleEditPreferences}
            onBack={() => setView("no-team")}
          />
        );
      case "has-team":
        if (!team) return null;
        return (
          <HasTeamView
            teamName={team.name}
            teamCode={team.invite_code}
            members={team.members
              .filter((m) => m.user_id !== currentUserId)
              .map((m) => ({ full_name: m.full_name, email: "" }))}
            onLeaveTeam={() => setShowLeaveConfirm(true)}
          />
        );
    }
  };

  return (
    <>
      <RegistrationLayout className="bg-[#fffdfa]">
        <div className="flex flex-col gap-5 items-center p-10">
          {renderView()}
        </div>
      </RegistrationLayout>

      <Modal
        open={showCreateTeamModal}
        onClose={() => {
          if (creatingTeam) return;
          setShowCreateTeamModal(false);
          setNewTeamName("");
        }}
        title="Create a team"
        description="Choose the team name your teammates will see when they join."
        footer={(
          <>
            <button
              onClick={() => {
                setShowCreateTeamModal(false);
                setNewTeamName("");
              }}
              className="rounded-lg px-4 py-2 text-sm font-poppins text-gray-600 transition-colors hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTeam}
              disabled={creatingTeam}
              className="rounded-lg bg-red5 px-4 py-2 text-sm font-poppins font-semibold text-white transition-colors hover:bg-red3 disabled:opacity-50"
            >
              {creatingTeam ? "Creating…" : "Create Team"}
            </button>
          </>
        )}
      >
        <label className="block text-sm font-poppins font-semibold text-gray-700">
          Team name
        </label>
        <input
          value={newTeamName}
          onChange={(event) => setNewTeamName(event.target.value)}
          placeholder="Hack On Heroes"
          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-poppins text-gray-900 placeholder:text-gray-400 focus:border-red5 focus:outline-none"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleCreateTeam();
            }
          }}
        />
      </Modal>

      <Modal
        open={showLeaveConfirm}
        onClose={() => {
          if (leavingTeam) return;
          setShowLeaveConfirm(false);
        }}
        title="Leave this team?"
        description="You’ll be removed from the current team immediately. If the team becomes empty, it will be deleted."
        footer={(
          <>
            <button
              onClick={() => setShowLeaveConfirm(false)}
              className="rounded-lg px-4 py-2 text-sm font-poppins text-gray-600 transition-colors hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleLeaveTeam}
              disabled={leavingTeam}
              className="rounded-lg bg-red5 px-4 py-2 text-sm font-poppins font-semibold text-white transition-colors hover:bg-red3 disabled:opacity-50"
            >
              {leavingTeam ? "Leaving…" : "Leave Team"}
            </button>
          </>
        )}
      />
    </>
  );
}
