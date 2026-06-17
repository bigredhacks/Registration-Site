import { useState } from "react";
import { Navigate } from "react-router-dom";
import RegistrationLayout from "@/components/layouts/RegistrationLayout";
import { useAdmin } from "@/lib/useAdmin";
import AdminUsers from "./AdminUsers";
import AdminStats from "./AdminStats";
import AdminFormEditor from "./AdminFormEditor";
import AdminFormList from "./AdminFormList";

type Tab = "editor" | "stats" | "users" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "editor", label: "Application Editor" },
  { id: "stats", label: "Stats" },
  { id: "users", label: "Users" },
  { id: "settings", label: "Settings" },
];

export default function AdminPage() {
  const { loading, isAdmin } = useAdmin();
  const [tab, setTab] = useState<Tab>("users");
  const [editingKey, setEditingKey] = useState<string | null>(null);

  if (loading) {
    return (
      <RegistrationLayout>
        <p className="font-poppins text-red6">Loading…</p>
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
          {tab === "settings" && <ComingSoon label="Settings" />}
        </div>
      </div>
    </RegistrationLayout>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 gap-2">
      <p className="text-2xl font-poppins font-semibold text-red6">{label}</p>
      <p className="text-sm font-poppins text-gray-500">Coming soon.</p>
    </div>
  );
}
