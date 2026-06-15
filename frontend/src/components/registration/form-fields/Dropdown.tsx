import type { DropdownFormField } from "@/lib/formConfig";
import SearchableCombobox from "@/components/SearchableCombobox";

interface DropdownProps {
  field: DropdownFormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const selectCls =
  "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red5 transition-colors appearance-none cursor-pointer pr-8 font-poppins";

const Chevron = () => (
  <svg
    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default function Dropdown({ field, value, onChange, error }: DropdownProps) {
  const csvSource = field.optionsSource?.type === "csv" ? field.optionsSource : undefined;

  return (
    <div className="flex flex-col gap-2.5 items-start bg-white px-6 py-6 rounded-lg w-full">
      <div className="flex gap-1 items-center w-full">
        <label htmlFor={field.id} className="text-sm font-normal text-black leading-[1.5]">
          {field.label}
        </label>
        {field.required && (
          <span className="text-[#fe1736] text-[15px] leading-[normal]">*</span>
        )}
      </div>
      {field.description && (
        <p className="text-xs text-gray-600">{field.description}</p>
      )}

      {field.searchable ? (
        <SearchableCombobox
          value={value}
          onChange={onChange}
          csvUrl={csvSource?.url}
          csvType={csvSource?.csvType}
          staticOptions={field.options}
          placeholder="Search or type…"
          allowCustomValue={field.allowCustomValue ?? false}
          className="w-full"
        />
      ) : (
        <div className="relative w-full">
          <select
            id={field.id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${selectCls} ${!value ? "text-gray-400" : "text-gray-800"}`}
          >
            <option value="" disabled>Select</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <Chevron />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
