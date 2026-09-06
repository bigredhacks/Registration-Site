import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Chevron from "@/components/Chevron";
import { getComboboxPosition } from "@/lib/comboboxPosition";
import { filterSelectOptions, hasSelectSearch, nextActiveIndex, reconcileActiveIndex, renderedSelectOptions, SEARCH_THRESHOLD, selectTypeahead, type AdminSelectOption } from "@/lib/adminSelect";
import "./AdminSelect.css";

interface AdminSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  searchThreshold?: number;
}

export default function AdminSelect({
  value, onChange, options, placeholder, id, disabled, className = "", fullWidth = false,
  searchThreshold = SEARCH_THRESHOLD, "aria-label": ariaLabel,
}: AdminSelectProps) {
  const rows = useMemo(
    () => (placeholder === undefined ? options : [{ value: "", label: placeholder }, ...options]),
    [options, placeholder],
  );
  const searchable = hasSelectSearch(rows.length, searchThreshold);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [menuRect, setMenuRect] = useState<ReturnType<typeof getComboboxPosition> | null>(null);
  const [menuLabel, setMenuLabel] = useState("Options");
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", time: 0 });
  const openedSearchable = useRef(searchable);
  const listId = useId();
  const popupId = `${listId}-popup`;
  const matches = useMemo(() => filterSelectOptions(rows, query), [rows, query]);
  const shown = useMemo(() => renderedSelectOptions(matches, value), [matches, value]);
  const active = reconcileActiveIndex(shown, activeValue, value);
  const hidden = matches.length - shown.length;
  const optionId = (row: AdminSelectOption) => `${listId}-option-${encodeURIComponent(row.value)}`;
  const activeId = open && menuRect && shown[active] ? optionId(shown[active]) : undefined;

  const dismiss = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }, []);

  const updateMenuRect = useCallback(() => {
    const element = trigger.current;
    if (!element) return;
    const viewport = window.visualViewport;
    setMenuRect(getComboboxPosition(element.getBoundingClientRect(), {
      top: viewport?.offsetTop ?? 0,
      left: viewport?.offsetLeft ?? 0,
      width: viewport?.width ?? window.innerWidth,
      height: viewport?.height ?? window.innerHeight,
    }));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    if (openedSearchable.current !== searchable) {
      dismiss();
      return;
    }
    updateMenuRect();
    window.addEventListener("scroll", updateMenuRect, true);
    window.addEventListener("resize", updateMenuRect);
    window.visualViewport?.addEventListener("resize", updateMenuRect);
    window.visualViewport?.addEventListener("scroll", updateMenuRect);
    return () => {
      window.removeEventListener("scroll", updateMenuRect, true);
      window.removeEventListener("resize", updateMenuRect);
      window.visualViewport?.removeEventListener("resize", updateMenuRect);
      window.visualViewport?.removeEventListener("scroll", updateMenuRect);
    };
  }, [open, searchable, dismiss, updateMenuRect]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (trigger.current?.contains(target) || menu.current?.contains(target)) return;
      dismiss(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) dismiss(false);
    };
    const checkDisabled = () => {
      if (trigger.current?.matches(":disabled")) dismiss(false);
    };
    checkDisabled();
    const observer = new MutationObserver(checkDisabled);
    for (let element: HTMLElement | null = trigger.current; element; element = element.parentElement) {
      observer.observe(element, { attributes: true, attributeFilter: ["disabled"] });
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open, dismiss]);

  useEffect(() => {
    setActiveValue(shown[active]?.value ?? null);
    if (open) document.getElementById(activeId ?? "")?.scrollIntoView({ block: "nearest" });
  }, [active, activeId, shown, open]);

  const commit = (option: AdminSelectOption) => {
    if (trigger.current?.matches(":disabled")) { dismiss(false); return; }
    if (option.value !== value) onChange(option.value);
    dismiss();
  };
  const openMenu = () => {
    if (trigger.current?.matches(":disabled")) return;
    trigger.current?.focus({ preventScroll: true });
    setQuery("");
    setActiveValue(value);
    typeahead.current = { text: "", time: 0 };
    openedSearchable.current = searchable;
    setMenuLabel(ariaLabel || Array.from(trigger.current?.labels ?? []).map((label) => label.textContent?.trim()).join(" ") || "Options");
    updateMenuRect();
    setOpen(true);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }
    if (event.key === "Tab") { dismiss(); return; }
    if (event.key === "Enter" || (!searchable && event.key === " ")) {
      event.preventDefault();
      if (shown[active]) commit(shown[active]);
      return;
    }
    if (["ArrowDown", "ArrowUp", ...(!searchable ? ["Home", "End"] : [])].includes(event.key)) {
      event.preventDefault();
      setActiveValue(shown[nextActiveIndex(active, event.key, shown.length)]?.value ?? null);
      return;
    }
    if (!searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const next = selectTypeahead(shown, active, event.key, typeahead.current, Date.now());
      typeahead.current = next;
      setActiveValue(shown[next.index]?.value ?? null);
    }
  };

  return (
    <span className={`admin-select-wrap${fullWidth ? " admin-select-full" : ""}`}>
      <button
        ref={trigger} type="button" id={id} disabled={disabled}
        className={`admin-select ${className}`}
        role={searchable ? undefined : "combobox"} aria-expanded={open} aria-haspopup={searchable ? "dialog" : "listbox"}
        aria-controls={open ? searchable ? popupId : listId : undefined} aria-label={ariaLabel}
        aria-activedescendant={searchable ? undefined : activeId}
        onClick={() => (open ? dismiss() : openMenu())}
        onKeyDown={(event) => {
          if (open) { onKeyDown(event); return; }
          if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            openMenu();
          } else if (!searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            openMenu();
            const openingRows = renderedSelectOptions(rows, value);
            const next = selectTypeahead(openingRows, reconcileActiveIndex(openingRows, null, value), event.key, typeahead.current, Date.now());
            typeahead.current = next;
            setActiveValue(openingRows[next.index]?.value ?? null);
          }
        }}
      >
        {rows.find((row) => row.value === value)?.label ?? placeholder ?? ""}
      </button>
      <Chevron />
      {open && menuRect && createPortal(
        <div ref={menu} id={popupId} style={menuRect} className="admin-select-popup"
          role={searchable ? "dialog" : undefined} aria-label={searchable ? menuLabel : undefined}>
          {searchable && <input
            autoFocus type="text" role="combobox" aria-expanded="true" aria-autocomplete="list"
            value={query} placeholder="Search…" aria-label={`Search ${menuLabel}`}
            aria-controls={listId} aria-activedescendant={activeId}
            onChange={(event) => { setQuery(event.target.value); setActiveValue(null); }}
            onKeyDown={onKeyDown} className="admin-select-search"
          />}
          <div id={listId} role="listbox" aria-label={menuLabel} className="admin-select-list">
            {shown.map((row, index) => (
              <div key={row.value} id={optionId(row)} role="option" aria-selected={row.value === value}
                onMouseDown={(event) => event.preventDefault()}
                onPointerMove={() => setActiveValue(row.value)} onClick={() => commit(row)}
                className={`admin-select-option${index === active ? " is-active" : ""}`}>
                {row.label}
              </div>
            ))}
            {shown.length === 0 && <p className="admin-select-message">No matches</p>}
          </div>
          {hidden > 0 && <p className="admin-select-message admin-select-hint">
            {hidden.toLocaleString()} more — keep typing to narrow
          </p>}
        </div>, document.body,
      )}
    </span>
  );
}
