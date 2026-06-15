import { useState } from "react";
import {
  NoTeamView,
  MatchingFormView,
  MatchingPendingView,
} from "@/components/team-matching";
import RegistrationLayout from "@/components/layouts/RegistrationLayout";
import { useToast } from "@/components/Toast/ToastContext";
import { apiFetch } from "@/lib/api";

type TeamState =
  | "no-team"
  | "matching-form"
  | "matching-pending";

export default function TeamPage() {
  const [view, setView] = useState<TeamState>("no-team");
  const { showToast } = useToast();

  const handleJoinTeam = () => {
    showToast("Team join is not connected yet.", "info");
  };

  const handleCreateTeam = () => {
    showToast("Team creation is not connected yet.", "info");
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
