import { useState } from "react";
import { Navigate } from "react-router-dom";
import RegistrationLayout from "@/components/layouts/RegistrationLayout";
import { useAdmin } from "@/lib/useAdmin";
import AdminUsers from "./AdminUsers";
import AdminStats from "./AdminStats";
import AdminFormEditor from "./AdminFormEditor";
import AdminFormList from "./AdminFormList";
import AdminTeamMatching from "./AdminTeamMatching";

type Tab = "editor" | "stats" | "users" | "teams";

const TABS: { id: Tab; label: string }[] = [
  { id: "editor", label: "Application Editor" },
  { id: "stats", label: "Stats" },
  { id: "users", label: "Users" },
  { id: "teams", label: "Team Matching" },
];

export default function AdminPage() {
  const { loading, isAdmin, error } = useAdmin();
  const [tab, setTab] = useState<Tab>("users");
  const [editingKey, setEditingKey] = useState<string | null>(null);

  if (loading) {
    return (
      <RegistrationLayout>
        <p className="font-poppins text-red6">Loading…</p>
      </RegistrationLayout>
    );
  }

  if (error) {
    // Don't redirect on transient failures — that would silently kick real
    // admins out of the panel on a 5xx or network blip.
    return (
      <RegistrationLayout>
        <div className="flex flex-col gap-3 px-2 py-2">
          <p className="font-poppins text-red6">Couldn't verify admin access.</p>
          <button
            onClick={() => window.location.reload()}
            className="self-start px-4 py-2 bg-red5 hover:bg-red3 text-white text-sm font-poppins font-semibold rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </RegistrationLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <RegistrationLayout>
      <div className="flex flex-col gap-4 px-2 py-2">
        <h1 className="text-3xl font-poppins font-bold text-red6 pl-1">Admin</h1>

        {/* Tab strip */}
        <div className="flex gap-2 -mb-px">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-6 py-3 font-poppins font-semibold rounded-t-lg transition-colors ${
                  active
                    ? "bg-red5 text-white"
                    : "bg-red7 text-red6 hover:bg-red6/20"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab body */}
        <div className="bg-red7 rounded-xl rounded-tl-none p-6 min-h-[60vh] shadow-sm">
          {tab === "users" && <AdminUsers />}
          {tab === "stats" && <AdminStats />}
          {tab === "editor" && (
            editingKey
              ? <AdminFormEditor formKey={editingKey} onBack={() => setEditingKey(null)} />
              : <AdminFormList onSelect={setEditingKey} />
          )}
          {tab === "teams" && <AdminTeamMatching />}
        </div>
      </div>
    </RegistrationLayout>
  );
}
