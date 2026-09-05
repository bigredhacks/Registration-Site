/** Keep the menu inside the visible viewport, including above a mobile keyboard. */
export function getComboboxPosition(
  anchor: { top: number; bottom: number; left: number; width: number },
  viewport: { top: number; left: number; width: number; height: number },
) {
  const gap = 4;
  const padding = 8;
  const below = Math.max(0, viewport.top + viewport.height - anchor.bottom - gap - padding);
  const above = Math.max(0, anchor.top - viewport.top - gap - padding);
  const opensAbove = below < 160 && above > below;
  const maxHeight = Math.min(208, opensAbove ? above : below);
  const width = Math.min(anchor.width, Math.max(0, viewport.width - padding * 2));
  const left = Math.max(viewport.left + padding, Math.min(anchor.left, viewport.left + viewport.width - padding - width));
  return {
    top: opensAbove ? anchor.top - gap : anchor.bottom + gap,
    left,
    width,
    maxHeight,
    transform: opensAbove ? "translateY(-100%)" : undefined,
  };
}
