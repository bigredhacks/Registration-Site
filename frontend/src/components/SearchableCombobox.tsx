import { useState, useRef, useEffect, useMemo } from "react";
import { loadCsvOptions, type CsvType } from "@/lib/loadCsvOptions";

interface SearchableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  csvUrl?: string;
  csvType?: CsvType;
  staticOptions?: string[];
  className?: string;
  allowCustomValue?: boolean;
}

export default function SearchableCombobox({
  value,
  onChange,
  placeholder = "Search…",
  csvUrl,
  csvType = "schools",
  staticOptions = [],
  className = "",
  allowCustomValue = true,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState(value);
  const [query, setQuery] = useState("");
  const [csvOptions, setCsvOptions] = useState<string[]>([]);
  const focused = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!csvUrl) return;
    loadCsvOptions(csvUrl, csvType).then(setCsvOptions).catch(() => {});
  }, [csvUrl, csvType]);

  // Close on outside pointer-down. Using a document listener (instead of a
  // full-viewport backdrop) so wheel events reach the surrounding scroll
  // container instead of falling through to the page body.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        if (allowCustomValue && inputText.trim()) onChange(inputText.trim());
        else setInputText(value);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, allowCustomValue, inputText, value, onChange]);

  const allOptions = useMemo(
    () => [...new Set([...csvOptions, ...staticOptions])],
    [csvOptions, staticOptions]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allOptions.slice(0, 100);
    const q = query.toLowerCase();
    return allOptions.filter((o) => o.toLowerCase().includes(q)).slice(0, 60);
  }, [allOptions, query]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(text), 200);
  };

  const select = (option: string) => {
    onChange(option);
    setInputText(option);
    setQuery("");
    setOpen(false);
  };

  const handleFocus = () => {
    focused.current = true;
    setInputText(value);
    setOpen(true);
  };

  const handleBlur = () => {
    focused.current = false;
  };

  const displayValue = focused.current || open ? inputText : value;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-red5 transition-colors font-poppins"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(opt); }}
              className={`w-full px-3 py-2 text-left text-sm font-poppins text-gray-800 hover:bg-red7 transition-colors ${
                opt === value ? "bg-red7 font-medium text-red6" : ""
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
