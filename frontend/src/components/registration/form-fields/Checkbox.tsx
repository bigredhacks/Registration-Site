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
      <div className="flex items-start gap-2">
        <input
          id={field.id}
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-3 sm:mt-0 h-5 w-5 shrink-0 accent-red4"
        />
        <label htmlFor={field.id} className="min-h-11 sm:min-h-0 py-2 sm:py-0 text-xs font-normal text-black leading-[1.5] cursor-pointer">
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
