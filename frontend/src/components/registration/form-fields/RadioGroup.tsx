import type { RadioFormField } from "@/lib/formConfig";

interface RadioGroupProps {
  field: RadioFormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function RadioGroup({ field, value, onChange, error }: RadioGroupProps) {
  return (
    <div className="flex flex-col gap-2.5 items-start bg-white px-6 py-6 rounded-lg w-full">
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
          <div key={option} className="flex gap-1 items-center">
            <button
              type="button"
              onClick={() => onChange(option)}
              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                value === option
                  ? "border-[#fe1736] bg-white"
                  : "border-[#9c9494] bg-white"
              }`}
            >
              {value === option && (
                <div className="w-3 h-3 rounded-full bg-[#fe1736]" />
              )}
            </button>
            <label className="text-sm font-normal text-black leading-[1.5] cursor-pointer">
              {option}
            </label>
          </div>
        ))}
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
