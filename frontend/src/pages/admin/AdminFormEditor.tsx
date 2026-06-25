import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast/ToastContext";
import type { FormField, FormFieldType } from "@/lib/formConfig";

interface FormConfigRow {
  key: string;
  title: string;
  description: string | null;
  fields: FormField[];
  is_active: boolean;
  version: number;
  updated_at: string;
}

const TYPE_OPTIONS: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Short Answer" },
  { value: "email", label: "Email" },
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Radio" },
  { value: "checkbox", label: "Single Checkbox" },
  { value: "checkboxGroup", label: "Multi-select" },
  { value: "multipleChoiceGrid", label: "Multiple Choice Grid" },
  { value: "preferenceGrid", label: "Preference Grid" },
];

const TYPES_WITH_OPTIONS: FormFieldType[] = ["dropdown", "radio", "checkboxGroup"];
const TYPES_WITH_PLACEHOLDER: FormFieldType[] = ["text", "email"];
const TYPES_WITH_GRID: FormFieldType[] = ["multipleChoiceGrid", "preferenceGrid"];

const inputCls =
  "w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm font-poppins text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-red5";

const blankField = (type: FormFieldType): FormField => {
  const base: FormField = { id: `field_${Date.now()}`, label: "New field", type, required: false } as FormField;
  if (TYPES_WITH_OPTIONS.includes(type)) (base as FormField & { options: string[] }).options = ["Option 1"];
  if (type === "checkbox") (base as FormField & { checkboxText: string }).checkboxText = "I agree";
  if (TYPES_WITH_GRID.includes(type)) {
    (base as FormField & { rows: string[]; columns: string[] }).rows = ["Row 1"];
    (base as FormField & { rows: string[]; columns: string[] }).columns = ["Column 1"];
  }
  return base;
};

interface Props {
  formKey: string;
  onBack: () => void;
}

export default function AdminFormEditor({ formKey, onBack }: Props) {
  const { showToast } = useToast();
  const [config, setConfig] = useState<FormConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    apiFetch(`/api/admin/form-configs/${formKey}`)
      .then(async (res) => {
        if (!res.ok) {
          showToast("Failed to load form config.", "error");
          setLoading(false);
          return;
        }
        setConfig(await res.json());
        setLoading(false);
      })
      .catch(() => {
        showToast("Failed to load form config.", "error");
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  const update = (mutator: (c: FormConfigRow) => FormConfigRow) => {
    setConfig((prev) => (prev ? mutator(prev) : prev));
    setDirty(true);
  };

  const updateField = (idx: number, patch: Partial<FormField>) =>
    update((c) => ({
      ...c,
      fields: c.fields.map((f, i) => (i === idx ? ({ ...f, ...patch } as FormField) : f)),
    }));

  const moveField = (idx: number, dir: -1 | 1) =>
    update((c) => {
      const target = idx + dir;
      if (target < 0 || target >= c.fields.length) return c;
      const next = [...c.fields];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...c, fields: next };
    });

  const removeField = (idx: number) =>
    update((c) => ({ ...c, fields: c.fields.filter((_, i) => i !== idx) }));

  const addField = (type: FormFieldType) =>
    update((c) => ({ ...c, fields: [...c.fields, blankField(type)] }));

  const handleSave = async () => {
    if (!config) return;
    const ids = config.fields.map((f) => f.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
      showToast(`Duplicate field IDs: ${[...new Set(dupes)].join(", ")}`, "error");
      return;
    }
    const blankIds = config.fields.filter((f) => !f.id.trim());
    if (blankIds.length > 0) {
      showToast("All fields must have a non-empty ID.", "error");
      return;
    }
    setSaving(true);
    const res = await apiFetch(`/api/admin/form-configs/${formKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: config.title,
        description: config.description ?? "",
        fields: config.fields,
        is_active: config.is_active,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errMsg = body.errors?.[0]
        ? `${body.errors[0].field}: ${body.errors[0].message}`
        : body.error || `HTTP ${res.status}`;
      showToast(`Save failed: ${errMsg}`, "error");
      return;
    }
    setConfig(await res.json());
    setDirty(false);
    showToast("Form saved.", "success");
  };

  if (loading) return <p className="font-poppins text-gray-500">Loading…</p>;
  if (!config) return <p className="font-poppins text-gray-500">No form config.</p>;

  return (
    <div className="flex flex-col gap-4">
      {/* Back to list */}
      <button
        onClick={onBack}
        className="self-start px-3 py-1.5 bg-white border border-red5 hover:bg-red7 text-red5 text-xs font-poppins font-semibold rounded transition-colors"
      >
        ← Back to forms
      </button>

      {/* Form metadata */}
      <div className="bg-white border border-red6/20 rounded-lg p-5 flex flex-col gap-3">
        <div>
          <label className="text-xs font-poppins font-semibold text-gray-500 uppercase tracking-widest">
            Form Title
          </label>
          <input
            value={config.title}
            onChange={(e) => update((c) => ({ ...c, title: e.target.value }))}
            className={`${inputCls} mt-1`}
          />
        </div>
        <div>
          <label className="text-xs font-poppins font-semibold text-gray-500 uppercase tracking-widest">
            Description
          </label>
          <input
            value={config.description ?? ""}
            onChange={(e) => update((c) => ({ ...c, description: e.target.value }))}
            className={`${inputCls} mt-1`}
          />
        </div>
        <div className="flex items-center gap-3 text-xs font-poppins text-gray-500">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.is_active}
              onChange={(e) => update((c) => ({ ...c, is_active: e.target.checked }))}
            />
            Active (shown to users)
          </label>
          <span>· Version {config.version}</span>
          <span>· {config.fields.length} fields</span>
        </div>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-3">
        {config.fields.map((field, idx) => (
          <FieldCard
            key={`${field.id}-${idx}`}
            field={field}
            isFirst={idx === 0}
            isLast={idx === config.fields.length - 1}
            onChange={(patch) => updateField(idx, patch)}
            onMoveUp={() => moveField(idx, -1)}
            onMoveDown={() => moveField(idx, 1)}
            onRemove={() => removeField(idx)}
          />
        ))}
      </div>

      {/* Add field row */}
      <div className="bg-white border border-dashed border-red5 rounded-lg p-4 flex items-center gap-3">
        <span className="font-poppins font-semibold text-red6 text-sm">Add field:</span>
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t.value}
            onClick={() => addField(t.value)}
            className="px-3 py-1.5 bg-red7 hover:bg-red6/30 text-red6 text-xs font-poppins font-semibold rounded transition-colors"
          >
            + {t.label}
          </button>
        ))}
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-red7 -mx-6 px-6 py-3 flex justify-end gap-3 items-center">
        {dirty && <span className="text-xs font-poppins text-amber-700">Unsaved changes</span>}
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="px-6 py-2 bg-red5 hover:bg-red3 text-white text-sm font-poppins font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function FieldCard({
  field,
  isFirst,
  isLast,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  field: FormField;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<FormField>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const hasOptions = TYPES_WITH_OPTIONS.includes(field.type);
  const hasPlaceholder = TYPES_WITH_PLACEHOLDER.includes(field.type);
  const hasGrid = TYPES_WITH_GRID.includes(field.type);
  const isCheckbox = field.type === "checkbox";

  const updateOption = (i: number, value: string) => {
    const opts = [...((field as FormField & { options: string[] }).options ?? [])];
    opts[i] = value;
    onChange({ options: opts } as Partial<FormField>);
  };
  const addOption = () => {
    const opts = [...((field as FormField & { options: string[] }).options ?? []), `Option ${((field as FormField & { options?: string[] }).options?.length ?? 0) + 1}`];
    onChange({ options: opts } as Partial<FormField>);
  };
  const removeOption = (i: number) => {
    const opts = [...((field as FormField & { options: string[] }).options ?? [])].filter((_, j) => j !== i);
    onChange({ options: opts } as Partial<FormField>);
  };

  const updateList = (key: "rows" | "columns", i: number, value: string) => {
    const list = [...((field as FormField & Record<typeof key, string[]>)[key] ?? [])];
    list[i] = value;
    onChange({ [key]: list } as Partial<FormField>);
  };
  const addListItem = (key: "rows" | "columns") => {
    const list = [...((field as FormField & Record<typeof key, string[]>)[key] ?? [])];
    const noun = key === "rows" ? "Row" : "Column";
    list.push(`${noun} ${list.length + 1}`);
    onChange({ [key]: list } as Partial<FormField>);
  };
  const removeListItem = (key: "rows" | "columns", i: number) => {
    const list = [...((field as FormField & Record<typeof key, string[]>)[key] ?? [])].filter(
      (_, j) => j !== i
    );
    onChange({ [key]: list } as Partial<FormField>);
  };

  return (
    <div className="bg-white border border-red6/20 rounded-lg p-4 flex gap-3">
      {/* Reorder column */}
      <div className="flex flex-col gap-1 shrink-0">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="w-7 h-7 rounded bg-red7 hover:bg-red6/30 text-red6 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move up"
        >
          ↑
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="w-7 h-7 rounded bg-red7 hover:bg-red6/30 text-red6 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move down"
        >
          ↓
        </button>
      </div>

      {/* Field body */}
      <div className="flex-1 grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-poppins font-semibold text-gray-500 uppercase tracking-widest">
            Label
          </label>
          <input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className={`${inputCls} mt-1`}
          />
        </div>
        <div>
          <label className="text-[10px] font-poppins font-semibold text-gray-500 uppercase tracking-widest">
            ID (variable name)
          </label>
          <input
            value={field.id}
            onChange={(e) => onChange({ id: e.target.value })}
            className={`${inputCls} mt-1 font-mono text-xs`}
          />
        </div>
        <div>
          <label className="text-[10px] font-poppins font-semibold text-gray-500 uppercase tracking-widest">
            Type
          </label>
          <select
            value={field.type}
            onChange={(e) => onChange({ type: e.target.value as FormFieldType })}
            className={`${inputCls} mt-1 cursor-pointer`}
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4 mt-5">
          <label className="flex items-center gap-2 text-sm font-poppins">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange({ required: e.target.checked })}
            />
            Required
          </label>
        </div>

        {hasPlaceholder && (
          <div className="col-span-2">
            <label className="text-[10px] font-poppins font-semibold text-gray-500 uppercase tracking-widest">
              Placeholder
            </label>
            <input
              value={(field as FormField & { placeholder?: string }).placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value } as Partial<FormField>)}
              className={`${inputCls} mt-1`}
            />
          </div>
        )}

        {isCheckbox && (
          <div className="col-span-2">
            <label className="text-[10px] font-poppins font-semibold text-gray-500 uppercase tracking-widest">
              Checkbox text
            </label>
            <input
              value={(field as FormField & { checkboxText?: string }).checkboxText ?? ""}
              onChange={(e) => onChange({ checkboxText: e.target.value } as Partial<FormField>)}
              className={`${inputCls} mt-1`}
            />
          </div>
        )}

        {hasOptions && (
          <div className="col-span-2">
            <label className="text-[10px] font-poppins font-semibold text-gray-500 uppercase tracking-widest">
              Options
            </label>
            <div className="flex flex-col gap-1.5 mt-1">
              {((field as FormField & { options?: string[] }).options ?? []).map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    className={inputCls}
                  />
                  <button
                    onClick={() => removeOption(i)}
                    className="px-3 py-1 bg-red7 hover:bg-red5 hover:text-white text-red6 text-xs font-poppins font-semibold rounded transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={addOption}
                className="self-start px-3 py-1.5 bg-red5 hover:bg-red3 text-white text-xs font-poppins font-semibold rounded transition-colors"
              >
                + Add option
              </button>
            </div>
          </div>
        )}

        {hasGrid && (
          <div className="col-span-2 grid grid-cols-2 gap-3">
            {(["rows", "columns"] as const).map((axis) => {
              const items = (field as FormField & Record<typeof axis, string[]>)[axis] ?? [];
              return (
                <div key={axis}>
                  <label className="text-[10px] font-poppins font-semibold text-gray-500 uppercase tracking-widest">
                    {axis === "rows" ? "Rows (questions)" : "Columns (answers)"}
                  </label>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {items.map((item, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={item}
                          onChange={(e) => updateList(axis, i, e.target.value)}
                          className={inputCls}
                        />
                        <button
                          onClick={() => removeListItem(axis, i)}
                          className="px-2 py-1 bg-red7 hover:bg-red5 hover:text-white text-red6 text-xs font-poppins font-semibold rounded transition-colors"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addListItem(axis)}
                      className="self-start px-3 py-1 bg-red5 hover:bg-red3 text-white text-xs font-poppins font-semibold rounded transition-colors"
                    >
                      + Add {axis === "rows" ? "row" : "column"}
                    </button>
                  </div>
                </div>
              );
            })}
            <p className="col-span-2 text-[10px] font-poppins text-gray-500 italic">
              {field.type === "preferenceGrid"
                ? "Users assign each row a value from the column scale (1–5 ranking)."
                : "Users pick one column per row (e.g. skill level per technology)."}
            </p>
          </div>
        )}
      </div>

      {/* Trash column */}
      <div className="flex flex-col shrink-0">
        <button
          onClick={onRemove}
          className="w-7 h-7 rounded bg-red7 hover:bg-red5 hover:text-white text-red6 text-xs font-bold transition-colors"
          title="Delete field"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
