// =============================================================================
// Smart Grid — Column Operations Tests
// =============================================================================

import { describe, expect, it } from 'vitest';
import { clampColumnWidth, reorderVisibleColumns } from './column-operations';
import type { ColumnDef } from '../../types';

describe('column-operations', () => {
  it('clamps width to min and max constraints', () => {
    const column: ColumnDef = {
      id: 'amount',
      field: 'amount',
      header: 'Amount',
      width: 120,
      minWidth: 80,
      maxWidth: 160,
    };

    expect(clampColumnWidth(column, 40)).toBe(80);
    expect(clampColumnWidth(column, 130)).toBe(130);
    expect(clampColumnWidth(column, 400)).toBe(160);
  });

  it('uses default minimum width when minWidth is absent', () => {
    const column: ColumnDef = {
      id: 'name',
      field: 'name',
      header: 'Name',
      width: 100,
    };

    expect(clampColumnWidth(column, 10)).toBe(40);
  });

  it('reorders visible columns by index', () => {
    const columns: ReadonlyArray<ColumnDef> = [
      { id: 'a', field: 'a', header: 'A', width: 100 },
      { id: 'b', field: 'b', header: 'B', width: 100 },
      { id: 'c', field: 'c', header: 'C', width: 100 },
      { id: 'd', field: 'd', header: 'D', width: 100 },
    ];

    const result = reorderVisibleColumns(columns, 0, 2);
    expect(result.map((column) => column.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('keeps hidden columns and reorders only visible set', () => {
    const columns: ReadonlyArray<ColumnDef> = [
      { id: 'a', field: 'a', header: 'A', width: 100 },
      { id: 'hidden-1', field: 'hidden1', header: 'H1', width: 80, visible: false },
      { id: 'b', field: 'b', header: 'B', width: 100 },
      { id: 'hidden-2', field: 'hidden2', header: 'H2', width: 80, visible: false },
      { id: 'c', field: 'c', header: 'C', width: 100 },
    ];

    const result = reorderVisibleColumns(columns, 2, 0);
    expect(result.map((column) => column.id)).toEqual(['c', 'a', 'hidden-1', 'b', 'hidden-2']);
  });

  it('returns same reference on no-op reorder', () => {
    const columns: ReadonlyArray<ColumnDef> = [
      { id: 'a', field: 'a', header: 'A', width: 100 },
      { id: 'b', field: 'b', header: 'B', width: 100 },
    ];

    const result = reorderVisibleColumns(columns, 1, 1);
    expect(result).toBe(columns);
  });
});
