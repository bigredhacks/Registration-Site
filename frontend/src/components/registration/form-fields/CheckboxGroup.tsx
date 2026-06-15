import type { CheckboxGroupFormField } from "@/lib/formConfig";

interface CheckboxGroupProps {
  field: CheckboxGroupFormField;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}

export default function CheckboxGroup({ field, value, onChange, error }: CheckboxGroupProps) {
  const handleToggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

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
          <div key={option} className="flex gap-1 items-start">
            <button
              type="button"
              onClick={() => handleToggle(option)}
              className={`w-5 h-5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                value.includes(option)
                  ? "border-[#fe1736] bg-[#fe1736]"
                  : "border-[#e9e9e9] bg-white"
              }`}
            >
              {value.includes(option) && (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                  <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
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
