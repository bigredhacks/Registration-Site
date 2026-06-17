import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast/ToastContext";
import { FORM_PRESETS, type FormPreset } from "@/lib/formPresets";

export interface FormSummary {
  key: string;
  title: string;
  description: string | null;
  is_active: boolean;
  version: number;
  updated_at: string;
  fields_count: number;
}

interface Props {
  onSelect: (key: string) => void;
}

export default function AdminFormList({ onSelect }: Props) {
  const { showToast } = useToast();
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const res = await apiFetch("/api/admin/form-configs");
    if (!res.ok) {
      showToast("Failed to load forms.", "error");
      setLoading(false);
      return;
    }
    setForms(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (preset: FormPreset) => {
    const key = window.prompt(
      "URL slug for this form (lowercase letters, numbers, hyphens):",
      preset.defaultKey
    )?.trim();
    if (!key) return;
    if (!/^[a-z0-9-]+$/.test(key)) {
      showToast("Invalid key. Use lowercase letters, numbers, hyphens.", "error");
      return;
    }
    setCreating(true);
    const res = await apiFetch("/api/admin/form-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        title: preset.defaultTitle,
        description: preset.defaultDescription,
        fields: preset.fields,
        is_active: false,
      }),
    });
    setCreating(false);
    setShowPresetPicker(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(`Create failed: ${body.error || `HTTP ${res.status}`}`, "error");
      return;
    }
    showToast(`Form "${key}" created from ${preset.name}.`, "success");
    await refresh();
    onSelect(key);
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`Delete form "${key}"? This cannot be undone.`)) return;
    const res = await apiFetch(`/api/admin/form-configs/${key}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Delete failed.", "error");
      return;
    }
    showToast("Deleted.", "info");
    await refresh();
  };

  const handleToggleActive = async (form: FormSummary) => {
    const res = await apiFetch(`/api/admin/form-configs/${form.key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !form.is_active }),
    });
    if (!res.ok) {
      showToast("Could not toggle active state.", "error");
      return;
    }
    await refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-poppins text-gray-600">
          Forms drive the registration page and other applications. Only one form per key can be active.
        </p>
        <button
          onClick={() => setShowPresetPicker(true)}
          disabled={creating}
          className="px-4 py-2 bg-red5 hover:bg-red3 text-white text-sm font-poppins font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          + Create New Form
        </button>
      </div>

      {/* Forms table */}
      <div className="bg-white border border-red6/20 rounded-lg overflow-hidden">
        <table className="w-full text-sm font-poppins">
          <thead className="bg-red7 text-red6">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Title</th>
              <th className="text-left px-4 py-3 font-semibold">Key</th>
              <th className="text-left px-4 py-3 font-semibold">Fields</th>
              <th className="text-left px-4 py-3 font-semibold">Version</th>
              <th className="text-left px-4 py-3 font-semibold">Active</th>
              <th className="text-left px-4 py-3 font-semibold">Updated</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td>
              </tr>
            )}
            {!loading && forms.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No forms yet. Create one from a preset.
                </td>
              </tr>
            )}
            {!loading && forms.map((f) => (
              <tr key={f.key} className="border-t border-red6/10 hover:bg-red7/40">
                <td className="px-4 py-2 text-gray-900 font-medium">{f.title}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-700">{f.key}</td>
                <td className="px-4 py-2 text-gray-700 tabular-nums">{f.fields_count}</td>
                <td className="px-4 py-2 text-gray-700 tabular-nums">v{f.version}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleToggleActive(f)}
                    className={`px-2 py-1 text-xs font-poppins font-semibold rounded ${
                      f.is_active
                        ? "bg-green-100 text-green-700 border border-green-300"
                        : "bg-gray-100 text-gray-500 border border-gray-300"
                    }`}
                  >
                    {f.is_active ? "Active" : "Draft"}
                  </button>
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  {new Date(f.updated_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => onSelect(f.key)}
                    className="px-3 py-1 bg-red5 hover:bg-red3 text-white text-xs font-poppins font-semibold rounded mr-2 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(f.key)}
                    className="px-3 py-1 bg-white border border-red5 text-red5 hover:bg-red5 hover:text-white text-xs font-poppins font-semibold rounded transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preset picker modal */}
      {showPresetPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setShowPresetPicker(false)}>
          <div
            className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-poppins font-bold text-red6 mb-4">Choose a preset</h2>
            <div className="flex flex-col gap-3">
              {FORM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleCreate(p)}
                  disabled={creating}
                  className="text-left bg-red7 hover:bg-red6/30 border border-red6/30 rounded-lg p-4 transition-colors disabled:opacity-50"
                >
                  <p className="font-poppins font-semibold text-red6 mb-1">{p.name}</p>
                  <p className="text-xs font-poppins text-gray-700">{p.description}</p>
                  <p className="text-xs font-poppins text-gray-400 mt-1">{p.fields.length} fields</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowPresetPicker(false)}
                className="px-4 py-2 text-sm font-poppins text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
