import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast/ToastContext";
import {
  buildAdminRegistrationsCsvPath,
  buildAdminRegistrationsPath,
} from "./adminRegistrationsQuery";

interface RegistrationSummary {
  id: number;
  user_id: string;
  created_at: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  school?: string | null;
  level_of_study?: string | null;
  major?: string | null;
  shirt_size?: string | null;
  status: string;
  resume_path?: string | null;
  form_key?: string | null;
}

interface RegistrationDetail extends RegistrationSummary {
  answers?: Record<string, unknown>;
  form_version?: number | null;
}

interface FormSummary {
  key: string;
  title: string;
}

const STATUS_OPTIONS = ["pending", "submitted", "approved", "rejected", "waitlisted"] as const;
const PAGE_SIZE = 50;

const COLUMNS: { key: keyof RegistrationSummary; label: string }[] = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "school", label: "School" },
  { key: "level_of_study", label: "Level" },
  { key: "shirt_size", label: "Shirt" },
  { key: "status", label: "Status" },
];

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => `${key}: ${formatAnswer(inner)}`)
      .join(" | ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default function AdminUsers() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<RegistrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [formFilter, setFormFilter] = useState("");
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RegistrationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const res = await apiFetch(buildAdminRegistrationsPath({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      status: statusFilter,
      search,
      formKey: formFilter,
    }));
    if (!res.ok) {
      showToast("Failed to load registrations.", "error");
      setLoading(false);
      return;
    }

    const body = await res.json();
    setRows(body.data ?? []);
    setCount(body.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, formFilter, page]);

  useEffect(() => {
    apiFetch("/api/admin/form-configs")
      .then(async (res) => {
        if (!res.ok) return;
        const body = await res.json();
        setForms((body ?? []).map((form: { key: string; title: string }) => ({
          key: form.key,
          title: form.title,
        })));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, formFilter]);

  const filteredRows = useMemo(() => rows, [rows]);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    await refresh();
  };

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

    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
    setDetail((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
  };

  const handleExport = async () => {
    const res = await apiFetch(buildAdminRegistrationsCsvPath({
      status: statusFilter,
      search,
      formKey: formFilter,
    }));
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

  const loadDetail = async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    const res = await apiFetch(`/api/admin/registrations/${id}`);
    if (!res.ok) {
      showToast("Could not load the application details.", "error");
      setSelectedId(null);
      setDetailLoading(false);
      return;
    }
    setDetail(await res.json());
    setDetailLoading(false);
  };

  const handleResumeDownload = async () => {
    if (!detail) return;
    const res = await apiFetch(`/api/admin/registrations/${detail.id}/resume-download-url`);
    if (!res.ok) {
      showToast("Resume is unavailable.", "error");
      return;
    }
    const body = await res.json();
    if (!body.signedUrl) {
      showToast("Resume is unavailable.", "error");
      return;
    }
    window.open(body.signedUrl, "_blank", "noopener,noreferrer");
  };

  const detailEntries = detail?.answers
    ? Object.entries(detail.answers).sort(([left], [right]) => left.localeCompare(right))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, school…"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-poppins focus:border-red5 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-red5 px-4 py-2 text-sm font-poppins font-semibold text-white transition-colors hover:bg-red3"
          >
            Search
          </button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-poppins focus:border-red5 focus:outline-none"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={formFilter}
          onChange={(e) => setFormFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-poppins focus:border-red5 focus:outline-none"
        >
          <option value="">All forms</option>
          {forms.map((form) => (
            <option key={form.key} value={form.key}>
              {form.title}
            </option>
          ))}
        </select>
        <button
          onClick={handleExport}
          className="rounded-lg bg-red5 px-4 py-2 text-sm font-poppins font-semibold text-white transition-colors hover:bg-red3"
        >
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_420px] gap-4">
        <div className="overflow-x-auto rounded-lg border border-red6/20 bg-white">
          <table className="w-full text-sm font-poppins">
            <thead className="bg-red7 text-red6">
              <tr>
                {COLUMNS.map((column) => (
                  <th key={String(column.key)} className="px-4 py-3 text-left font-semibold">
                    {column.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-semibold">Form</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="px-4 py-8 text-center text-gray-500">
                    No registrations.
                  </td>
                </tr>
              )}
              {!loading && filteredRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => loadDetail(row.id)}
                  className={`cursor-pointer border-t border-red6/10 hover:bg-red7/40 ${
                    selectedId === row.id ? "bg-red7/60" : ""
                  }`}
                >
                  {COLUMNS.map((column) => {
                    const value = row[column.key];
                    return (
                      <td key={String(column.key)} className="px-4 py-2 text-gray-800">
                        {value == null || value === "" ? "—" : String(value)}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-gray-800">
                    {row.form_key ?? "registration"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={row.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleStatusChange(row.id, e.target.value);
                        }}
                        className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-red5 focus:outline-none"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadDetail(row.id);
                        }}
                        className="rounded border border-red5 px-2 py-1 text-xs font-semibold text-red5 transition-colors hover:bg-red5 hover:text-white"
                      >
                        Review
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="min-h-[60vh] rounded-lg border border-red6/20 bg-white p-5">
          {!selectedId && (
            <div className="flex h-full items-center justify-center text-center">
              <p className="max-w-xs text-sm font-poppins text-gray-500">
                Select a registration to inspect the full application, uploaded resume, and stored answers.
              </p>
            </div>
          )}
          {selectedId && detailLoading && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm font-poppins text-gray-500">Loading application…</p>
            </div>
          )}
          {detail && !detailLoading && (
            <div className="flex h-full flex-col gap-4">
              <div className="border-b border-red6/10 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-poppins font-semibold text-red6">
                      {detail.first_name || "Unknown"} {detail.last_name || ""}
                    </h2>
                    <p className="text-sm font-poppins text-gray-500">{detail.email}</p>
                    <p className="mt-1 text-xs font-poppins text-gray-400">
                      Submitted {new Date(detail.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs font-poppins text-gray-400">
                      Form {detail.form_key ?? "registration"} · v{detail.form_version ?? 1}
                    </p>
                  </div>
                  <span className="rounded-full bg-red7 px-3 py-1 text-xs font-poppins font-semibold text-red6">
                    {detail.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={handleResumeDownload}
                    disabled={!detail.resume_path}
                    className="rounded-lg border border-red5 px-3 py-2 text-xs font-poppins font-semibold text-red5 transition-colors hover:bg-red5 hover:text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                  >
                    View Resume
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto">
                <div className="flex flex-col gap-3">
                  {detailEntries.length === 0 && (
                    <p className="text-sm font-poppins text-gray-500">No stored answers.</p>
                  )}
                  {detailEntries.map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-red6/10 bg-red7/30 px-4 py-3">
                      <p className="text-[11px] font-poppins font-semibold uppercase tracking-widest text-gray-500">
                        {key}
                      </p>
                      <p className="mt-1 text-sm font-poppins text-gray-800">
                        {formatAnswer(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-poppins text-gray-500">
        <p>
          Showing {filteredRows.length} of {count} registrations.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            className="rounded border border-gray-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={page >= totalPages - 1}
            className="rounded border border-gray-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
