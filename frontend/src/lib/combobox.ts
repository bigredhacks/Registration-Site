/**
 * Decide what a searchable combobox should commit when focus leaves the field
 * (outside click / blur), given the text the user typed.
 *
 * Returns the value to commit via `onChange`, or `null` to leave the current
 * value unchanged.
 *
 * Rules:
 *  - Empty/whitespace input commits nothing (keep the current value).
 *  - If the text matches a known option (case-insensitively), commit the
 *    canonical option — even when custom values are disallowed. This prevents
 *    silently discarding a perfectly valid value the user typed instead of
 *    clicking (the bug that made the "Country of Residence" field unusable).
 *  - Otherwise, commit the trimmed text only when custom values are allowed;
 *    if not, keep the current value (the user must pick a real option).
 */
export function resolveComboboxCommit(
  inputText: string,
  options: string[],
  allowCustomValue: boolean
): string | null {
  const trimmed = inputText.trim();
  if (!trimmed) return null;

  const exact = options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  return allowCustomValue ? trimmed : null;
}
