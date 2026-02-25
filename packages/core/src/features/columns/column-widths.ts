// =============================================================================
// Smart Grid — Column Width Resolution
// Resolves effective widths for fixed + fill columns.
// =============================================================================

import type { ColumnDef } from '../../types';
import { clampColumnWidth } from './column-operations';

export function resolveVisibleColumnsForWidth(
  columns: ReadonlyArray<ColumnDef>,
  availableWidth: number,
): ReadonlyArray<ColumnDef> {
  if (columns.length === 0) {
    return columns;
  }

  const safeWidth = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : 0;
  const base = columns.map((column) => ({ ...column, width: clampColumnWidth(column, column.width) }));

  const baseTotal = base.reduce((sum, column) => sum + column.width, 0);
  const extra = Math.max(0, safeWidth - baseTotal);
  if (extra <= 0) {
    return base;
  }

  const flexIndexes = base
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => (column.fixedWidth !== true) && (column.flexGrow ?? 0) > 0);

  if (flexIndexes.length === 0) {
    return base;
  }

  const totalWeight = flexIndexes.reduce((sum, item) => sum + (item.column.flexGrow ?? 0), 0);
  if (totalWeight <= 0) {
    return base;
  }

  let distributed = 0;
  const next = [...base];

  for (let i = 0; i < flexIndexes.length; i++) {
    const { index, column } = flexIndexes[i]!;
    const weight = column.flexGrow ?? 0;
    const rawShare = (extra * weight) / totalWeight;
    const share = i === flexIndexes.length - 1 ? extra - distributed : Math.floor(rawShare);
    distributed += share;

    const nextWidth = clampColumnWidth(column, column.width + share);
    next[index] = { ...column, width: nextWidth };
  }

  return next;
}
