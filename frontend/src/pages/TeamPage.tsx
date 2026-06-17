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

export default function TeamPage() {
  const [view, setView] = useState<TeamState>("loading");
  const [team, setTeam] = useState<UserTeam | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
      setView("matching-pending");
    } else {
      setView("no-team");
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    refreshTeam().catch(() => setView("no-team"));
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
    await refreshTeam();
  };

  const handleCreateTeam = async () => {
    const name = window.prompt("Team name?")?.trim();
    if (!name) return;
    const res = await apiFetch("/api/teams/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || "Could not create team.", "error");
      return;
    }
    showToast("Team created!", "success");
    await refreshTeam();
  };

  const handleLeaveTeam = async () => {
    if (!window.confirm("Leave this team?")) return;
    const res = await apiFetch("/api/teams/leave", { method: "POST" });
    if (!res.ok) {
      showToast("Could not leave team.", "error");
      return;
    }
    showToast("Left team.", "info");
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

    const response = await apiFetch("/api/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      showToast("Could not submit team matching preferences.", "error");
      throw new Error("Team matching submission failed");
    }

    showToast("Team matching preferences saved.", "success");
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
            onJoinTeam={handleJoinTeam}
            onCreateTeam={handleCreateTeam}
            onFillMatchForm={handleFillMatchForm}
          />
        );
      case "matching-form":
        return (
          <MatchingFormView
            onBack={() => setView("no-team")}
            onSubmit={handleMatchFormSubmit}
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
            teamNumber={1}
            teamCode={team.invite_code}
            members={team.members
              .filter((m) => m.user_id !== currentUserId)
              .map((m) => ({ full_name: m.full_name, email: "" }))}
            onLeaveTeam={handleLeaveTeam}
          />
        );
    }
  };

  return (
    <RegistrationLayout className="bg-[#fffdfa]">
      <div className="flex flex-col gap-5 items-center p-10">
        {renderView()}
      </div>
    </RegistrationLayout>
  );
}
