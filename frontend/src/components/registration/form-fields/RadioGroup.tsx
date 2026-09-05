import type { RadioFormField } from "@/lib/formConfig";

interface RadioGroupProps {
  field: RadioFormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function RadioGroup({ field, value, onChange, error }: RadioGroupProps) {
  return (
    <div className="flex flex-col gap-2.5 items-start bg-white px-3 py-4 sm:px-6 sm:py-6 rounded-lg w-full">
      <div className="flex gap-1 items-center w-full">
        <label className="text-sm font-normal text-black leading-[1.5]">
          {field.label}
        </label>
        {field.required && (
          <span className="text-[#fe1736] text-[15px] leading-[normal]">*</span>
        )}
      </div>
      {field.description && (
        <p className="text-xs text-gray-600">{field.description}</p>
      )}
      <div className="flex flex-col gap-1">
        {field.options.map((option) => (
          <label key={option} className="flex min-h-11 sm:min-h-0 cursor-pointer items-center gap-2 py-2 sm:py-0 text-sm text-black">
            <input
              type="radio"
              name={field.id}
              checked={value === option}
              onChange={() => onChange(option)}
              className="h-5 w-5 shrink-0 accent-red4"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
