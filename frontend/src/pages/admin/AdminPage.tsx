import "./admin.css";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import RegistrationLayout from "@/components/layouts/RegistrationLayout";
import { useAdmin } from "@/lib/useAdmin";
import AdminUsers from "./AdminUsers";
import AdminStats from "./AdminStats";
import AdminFormEditor from "./AdminFormEditor";
import AdminFormList from "./AdminFormList";
import AdminTeamMatching from "./AdminTeamMatching";
import AdminSelectionProvider from "./AdminSelectionProvider";
import AdminSelectionPanel from "./AdminSelectionPanel";
import { useAdminSelection } from "./AdminSelectionContext";
import AdminSelect from "@/components/AdminSelect";

type Tab = "editor" | "stats" | "users" | "teams";

const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "Approvals" },
  { id: "teams", label: "Team Matching" },
  { id: "editor", label: "Application Editor" },
  { id: "stats", label: "Stats" },
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
      <AdminSelectionProvider>
      <div className="admin-surface flex min-w-0 flex-col gap-4 px-0 py-2 lg:px-2">
        <h1 className="text-3xl font-poppins font-bold text-red6 pl-1">Admin</h1>

        {/* Tab strip */}
        <div aria-label="Admin sections" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap -mb-px">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                aria-pressed={active}
                onClick={() => setTab(t.id)}
                className={`px-3 sm:px-6 py-3 text-sm sm:text-base font-poppins font-semibold rounded-t-lg transition-colors ${
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
        <div className="min-w-0 bg-red7 rounded-xl sm:rounded-tl-none p-3 sm:p-6 min-h-[60vh] shadow-sm">
          <div hidden={tab !== "users" && tab !== "teams"}>
            <ApprovalWorkspace tab={tab} />
          </div>
          {tab === "stats" && <AdminStats />}
          {tab === "editor" && (
            editingKey
              ? <AdminFormEditor formKey={editingKey} onBack={() => setEditingKey(null)} />
              : <AdminFormList onSelect={setEditingKey} />
          )}
        </div>
      </div>
      </AdminSelectionProvider>
    </RegistrationLayout>
  );
}

export function ApprovalWorkspace({ tab }: { tab: Tab }) {
  const { formKey, setFormKey, forms, busy, selected } = useAdminSelection();
  return <>
    <div className="admin-toolbar mb-4">
      <label className="admin-form-picker">Application
        <AdminSelect aria-label="Application" className="admin-input" value={formKey} disabled={busy} onChange={setFormKey}
          options={[
            ...(forms.some(form => form.key === formKey) ? [] : [{ value: formKey, label: formKey }]),
            ...forms.map(form => ({ value: form.key, label: form.title })),
          ]} />
      </label>
    </div>
    <div className="admin-approval-workspace">
      <button className="admin-button admin-selection-jump" aria-controls="admin-selected-panel" onClick={() => {
        const panel = document.getElementById('admin-selected-panel');
        panel?.scrollIntoView({ block: 'start' }); panel?.focus({ preventScroll: true });
      }}>Selected students ({selected.size}) ↓</button>
      <div className="min-w-0" key={`browse-${formKey}`} id="admin-browse-list">
        <div hidden={tab !== 'users'}><AdminUsers /></div>
        <fieldset disabled={busy} hidden={tab !== 'teams'}><AdminTeamMatching /></fieldset>
      </div>
      <AdminSelectionPanel key={`selection-${formKey}`} />
    </div>
  </>;
}
