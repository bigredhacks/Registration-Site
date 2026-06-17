import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast/ToastContext";

interface Registration {
  id: number;
  user_id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  school?: string | null;
  level_of_study?: string | null;
  major?: string | null;
  shirt_size?: string | null;
  status: string;
  resume_path?: string | null;
}

const STATUS_OPTIONS = ["pending", "submitted", "approved", "rejected", "waitlisted"] as const;

const COLUMNS: { key: keyof Registration; label: string; width?: string }[] = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "school", label: "School" },
  { key: "level_of_study", label: "Level" },
  { key: "shirt_size", label: "Shirt" },
  { key: "status", label: "Status" },
];

export default function AdminUsers() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const refresh = async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "200", offset: "0" });
    if (statusFilter) params.set("status", statusFilter);
    const res = await apiFetch(`/api/admin/registrations?${params.toString()}`);
    if (!res.ok) {
      showToast("Failed to load registrations.", "error");
      setLoading(false);
      return;
    }
    const body = await res.json();
    setRows(body.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      [r.first_name, r.last_name, r.email, r.school, r.major]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const handleStatusChange = async (id: number, status: string) => {
    const res = await apiFetch(`/api/admin/registrations/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      showToast("Could not update status.", "error");
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const handleExport = async () => {
    const res = await apiFetch("/api/admin/registrations/export.csv");
    if (!res.ok) {
      showToast("Export failed.", "error");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registrations.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-red5 hover:bg-red3 text-white text-sm font-poppins font-semibold rounded-lg transition-colors"
        >
          Export CSV
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, school…"
          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-poppins focus:outline-none focus:border-red5"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-poppins cursor-pointer focus:outline-none focus:border-red5"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-red6/20 rounded-lg overflow-hidden">
        <table className="w-full text-sm font-poppins">
          <thead className="bg-red7 text-red6">
            <tr>
              {COLUMNS.map((c) => (
                <th key={String(c.key)} className="text-left px-4 py-3 font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="text-left px-4 py-3 font-semibold">Decision</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-gray-500">
                  No registrations.
                </td>
              </tr>
            )}
            {!loading && filtered.map((row) => (
              <tr key={row.id} className="border-t border-red6/10 hover:bg-red7/40">
                {COLUMNS.map((c) => {
                  const v = row[c.key];
                  const display = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
                  return (
                    <td key={String(c.key)} className="px-4 py-2 text-gray-800">
                      {display}
                    </td>
                  );
                })}
                <td className="px-4 py-2">
                  <select
                    value={row.status}
                    onChange={(e) => handleStatusChange(row.id, e.target.value)}
                    className="bg-white border border-gray-200 rounded px-2 py-1 text-xs cursor-pointer focus:outline-none focus:border-red5"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs font-poppins text-gray-500">
        Showing {filtered.length} of {rows.length} registrations.
      </p>
    </div>
  );
}
