// =============================================================================
// Smart Grid — Column Operations
// Pure helpers for resize and reorder logic.
// =============================================================================

import type { ColumnDef } from '../../types';

const DEFAULT_MIN_WIDTH = 40;

export function clampColumnWidth(column: ColumnDef, requestedWidth: number): number {
  const minWidth = column.minWidth ?? DEFAULT_MIN_WIDTH;
  const maxWidth = column.maxWidth;

  const finiteWidth = Number.isFinite(requestedWidth) ? requestedWidth : column.width;
  const floorWidth = Math.floor(finiteWidth);
  const atLeastMin = Math.max(minWidth, floorWidth);

  if (typeof maxWidth === 'number' && Number.isFinite(maxWidth)) {
    return Math.min(atLeastMin, maxWidth);
  }

  return atLeastMin;
}

export function reorderVisibleColumns(
  columns: ReadonlyArray<ColumnDef>,
  fromVisibleIndex: number,
  toVisibleIndex: number,
): ReadonlyArray<ColumnDef> {
  const visibleAbsoluteIndexes = columns.reduce<number[]>((acc, column, absoluteIndex) => {
    if (column.visible !== false) {
      acc.push(absoluteIndex);
    }
    return acc;
  }, []);

  if (visibleAbsoluteIndexes.length <= 1) {
    return columns;
  }

  const safeFrom = Math.max(0, Math.min(fromVisibleIndex, visibleAbsoluteIndexes.length - 1));
  const safeTo = Math.max(0, Math.min(toVisibleIndex, visibleAbsoluteIndexes.length - 1));

  if (safeFrom === safeTo) {
    return columns;
  }

  const fromAbsoluteIndex = visibleAbsoluteIndexes[safeFrom]!;
  const toAbsoluteIndex = visibleAbsoluteIndexes[safeTo]!;

  const mutable = [...columns];
  const [moved] = mutable.splice(fromAbsoluteIndex, 1);
  if (!moved) {
    return columns;
  }

  const insertAt = fromAbsoluteIndex < toAbsoluteIndex ? toAbsoluteIndex : toAbsoluteIndex;
  mutable.splice(insertAt, 0, moved);

  for (let i = 0; i < columns.length; i++) {
    if (columns[i] !== mutable[i]) {
      return mutable;
    }
  }

  return columns;
}
