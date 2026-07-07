import { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { loadCsvOptions, type CsvType } from "@/lib/loadCsvOptions";
import { resolveComboboxCommit } from "@/lib/combobox";

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
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const focused = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!csvUrl) return;
    loadCsvOptions(csvUrl, csvType).then(setCsvOptions).catch(() => {});
  }, [csvUrl, csvType]);

  const allOptions = useMemo(
    () => [...new Set([...csvOptions, ...staticOptions])],
    [csvOptions, staticOptions]
  );

  // Position the dropdown in a fixed-position portal so it isn't clipped by an
  // ancestor scroll container (e.g. the application form panel). Reposition on
  // scroll/resize while it's open.
  const updateMenuRect = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuRect();
    window.addEventListener("scroll", updateMenuRect, true);
    window.addEventListener("resize", updateMenuRect);
    return () => {
      window.removeEventListener("scroll", updateMenuRect, true);
      window.removeEventListener("resize", updateMenuRect);
    };
  }, [open, updateMenuRect]);

  // Close on outside pointer-down. Clicks inside the input wrapper or the
  // (portaled) dropdown count as inside.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      // Commit a typed value that resolves to a real option (or any value
      // when custom input is allowed); otherwise revert the text. This keeps
      // a typed-but-not-clicked entry from being silently dropped.
      const committed = resolveComboboxCommit(inputText, allOptions, allowCustomValue);
      if (committed !== null) {
        onChange(committed);
        setInputText(committed);
      } else {
        setInputText(value);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, allowCustomValue, inputText, value, onChange, allOptions]);

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

  // Offer an explicit "Use '<typed>'" row when custom values are allowed and the
  // text isn't an existing option, so users (e.g. with a school not in the list)
  // can see their entry will be accepted instead of relying on a silent commit.
  const trimmedInput = inputText.trim();
  const showAddCustom =
    allowCustomValue &&
    trimmedInput.length > 0 &&
    !allOptions.some((o) => o.toLowerCase() === trimmedInput.toLowerCase());

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
      {open && (filtered.length > 0 || showAddCustom) && menuRect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              zIndex: 1000,
            }}
            className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full"
          >
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
            {showAddCustom && (
              <button
                key="__add_custom__"
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(trimmedInput); }}
                className="w-full border-t border-gray-100 px-3 py-2 text-left text-sm font-poppins text-red6 hover:bg-red7 transition-colors"
              >
                Use "{trimmedInput}"
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
