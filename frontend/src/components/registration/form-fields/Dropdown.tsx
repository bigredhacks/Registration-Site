import type { DropdownFormField } from "@/lib/formConfig";
import SearchableCombobox from "@/components/SearchableCombobox";
import Chevron from "@/components/Chevron";

interface DropdownProps {
  field: DropdownFormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const selectCls =
  "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-red5 transition-colors appearance-none cursor-pointer pr-8 font-poppins";

export default function Dropdown({ field, value, onChange, error }: DropdownProps) {
  const csvSource = field.optionsSource?.type === "csv" ? field.optionsSource : undefined;

  return (
    <div className="flex flex-col gap-2.5 items-start bg-white px-3 py-4 sm:px-6 sm:py-6 rounded-lg w-full">
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
