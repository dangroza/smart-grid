// =============================================================================
// Smart Grid — Selection Utilities
// Pure selection helpers shared by orchestrator/tests.
// =============================================================================

import type { Row, RowId } from '../../types';
import { isGroupRow } from '../grouping/grouping-row';
import { isTotalsRow } from '../totals/totals-row';

export function isRowId(value: unknown): value is RowId {
  return typeof value === 'string' || typeof value === 'number';
}

export function getRowId(row: Row, rowIdField: string): RowId | null {
  if (isGroupRow(row) || isTotalsRow(row)) {
    return null;
  }

  const value = row[rowIdField];
  return isRowId(value) ? value : null;
}

export function collectSelectableRowIds(rows: ReadonlyArray<Row>, rowIdField: string): ReadonlySet<RowId> {
  const ids = new Set<RowId>();

  for (const row of rows) {
    const rowId = getRowId(row, rowIdField);
    if (rowId !== null) {
      ids.add(rowId);
    }
  }

  return ids;
}

export function normalizeSelection(
  requestedIds: ReadonlyArray<RowId>,
  allowedIds: ReadonlySet<RowId>,
): ReadonlySet<RowId> {
  const normalized = new Set<RowId>();

  for (const rowId of requestedIds) {
    if (allowedIds.has(rowId)) {
      normalized.add(rowId);
    }
  }

  return normalized;
}

export function computeAllSelected(
  selectedIds: ReadonlySet<RowId>,
  allowedIds: ReadonlySet<RowId>,
): boolean {
  return allowedIds.size > 0 && selectedIds.size === allowedIds.size;
}
