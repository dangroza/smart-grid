// =============================================================================
// Smart Grid — Freeze Utilities
// Pure helpers for left/right frozen columns.
// =============================================================================

export function clampFreezeCounts(
  totalColumns: number,
  leftCount: number,
  rightCount: number,
): { leftCount: number; rightCount: number } {
  const safeTotal = Math.max(0, Math.floor(totalColumns));
  const safeLeft = Math.max(0, Math.min(Math.floor(leftCount), safeTotal));
  const safeRight = Math.max(0, Math.min(Math.floor(rightCount), safeTotal - safeLeft));
  return { leftCount: safeLeft, rightCount: safeRight };
}

export function buildFrozenRenderColumnIndexes(
  totalColumns: number,
  rangeStartCol: number,
  rangeEndCol: number,
  leftFrozenCount: number,
  rightFrozenCount: number,
): ReadonlyArray<number> {
  const { leftCount, rightCount } = clampFreezeCounts(totalColumns, leftFrozenCount, rightFrozenCount);
  const indexes: number[] = [];
  const seen = new Set<number>();

  function push(index: number): void {
    if (index < 0 || index >= totalColumns || seen.has(index)) return;
    seen.add(index);
    indexes.push(index);
  }

  for (let i = 0; i < leftCount; i++) {
    push(i);
  }

  const centerStart = Math.max(rangeStartCol, leftCount);
  const centerEnd = Math.min(rangeEndCol, Math.max(leftCount, totalColumns - rightCount));
  for (let i = centerStart; i < centerEnd; i++) {
    push(i);
  }

  for (let i = totalColumns - rightCount; i < totalColumns; i++) {
    push(i);
  }

  return indexes;
}
