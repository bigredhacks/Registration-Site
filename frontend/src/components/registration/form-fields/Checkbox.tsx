import type { CheckboxFormField } from "@/lib/formConfig";

interface CheckboxProps {
  field: CheckboxFormField;
  value: boolean;
  onChange: (value: boolean) => void;
  error?: string;
}

function renderTextWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/\S+)/g);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("http://") || part.startsWith("https://")) {
      const url = part.replace(/[),.]+$/, "");
      const trailing = part.slice(url.length);

      return (
        <span key={`${url}-${index}`}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#fe1736] underline break-all"
          >
            {url}
          </a>
          {trailing}
        </span>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

export default function Checkbox({ field, value, onChange, error }: CheckboxProps) {
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
      <div className="flex gap-1 items-start">
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`w-5 h-5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
            value ? "border-[#fe1736] bg-[#fe1736]" : "border-[#e9e9e9] bg-white"
          }`}
        >
          {value && (
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <label className="text-xs font-normal text-black leading-[1.5] cursor-pointer">
          {renderTextWithLinks(field.checkboxText)}
          {field.linkUrl && field.linkText && (
            <>
              {" "}
              <a
                href={field.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#fe1736] underline"
              >
                {field.linkText}
              </a>
            </>
          )}
        </label>
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
