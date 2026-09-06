export interface AdminSelectOption {
  value: string;
  label: string;
}

/** Options above this count get a search box instead of a plain list. */
export const SEARCH_THRESHOLD = 10;
/** Rows rendered at once; the rest stay behind a "keep typing" hint. */
export const RENDER_LIMIT = 200;

export function filterSelectOptions(options: AdminSelectOption[], query: string): AdminSelectOption[] {
  const search = query.trim().toLowerCase();
  if (!search) return options;
  // Prefix matches rank above interior ones so "cor" leads with "Cornell"
  // rather than a school that merely contains "cor" mid-word.
  const startsWith: AdminSelectOption[] = [];
  const contains: AdminSelectOption[] = [];
  for (const option of options) {
    const label = option.label.toLowerCase();
    if (label.startsWith(search)) startsWith.push(option);
    else if (label.includes(search)) contains.push(option);
  }
  return [...startsWith, ...contains];
}

/**
 * Next highlighted row for a keyboard event. Arrows wrap at both ends so a held
 * key cycles; returns -1 for an empty list so callers render nothing active.
 */
export function nextActiveIndex(current: number, key: string, count: number): number {
  if (count <= 0) return -1;
  const clamped = current < 0 || current >= count ? -1 : current;
  switch (key) {
    case 'ArrowDown': return clamped + 1 >= count ? 0 : clamped + 1;
    case 'ArrowUp': return clamped <= 0 ? count - 1 : clamped - 1;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return clamped;
  }
}

export function hasSelectSearch(rowCount: number, threshold = SEARCH_THRESHOLD): boolean {
  return rowCount > threshold;
}

export function renderedSelectOptions(matches: AdminSelectOption[], value: string): AdminSelectOption[] {
  const shown = matches.slice(0, RENDER_LIMIT);
  const selected = matches.find((row) => row.value === value);
  if (selected && !shown.includes(selected)) shown[shown.length - 1] = selected;
  return shown;
}

export function reconcileActiveIndex(rows: AdminSelectOption[], activeValue: string | null, value: string): number {
  const active = rows.findIndex((row) => row.value === activeValue);
  if (active >= 0) return active;
  const selected = rows.findIndex((row) => row.value === value);
  return selected >= 0 ? selected : rows.length ? 0 : -1;
}

export function selectTypeahead(
  rows: AdminSelectOption[], current: number, key: string,
  previous: { text: string; time: number }, now: number,
) {
  const text = (now - previous.time < 500 ? previous.text : "") + key.toLowerCase();
  const repeated = [...text].every((letter) => letter === text[0]);
  const prefix = repeated ? text[0] : text;
  const start = repeated ? current + 1 : Math.max(0, current);
  for (let offset = 0; offset < rows.length; offset++) {
    const index = (start + offset) % rows.length;
    if (rows[index].label.toLowerCase().startsWith(prefix)) return { index, text, time: now };
  }
  return { index: current, text, time: now };
}
