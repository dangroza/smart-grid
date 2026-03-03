// =============================================================================
// Smart Grid — Sort Feature Tests
// =============================================================================

import { describe, expect, it } from 'vitest';
import { createSortStep } from './sort-feature';
import type { ColumnDef, GridState, Row } from '../../types';

function createMockState(
  columns: ReadonlyArray<ColumnDef>,
  criteria: GridState['sort']['criteria'],
): GridState {
  return {
    data: [],
    columns,
    processedData: [],
    viewport: {
      scrollTop: 0,
      scrollLeft: 0,
      containerWidth: 0,
      containerHeight: 0,
      visibleRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
    },
    sort: { criteria },
    filter: { criteria: [], mode: 'client' },
    selection: { selectedIds: new Set(), allSelected: false },
    pagination: { page: 0, pageSize: 50, totalRows: 0 },
    freeze: { leftCount: 0, rightCount: 0 },
    grouping: { columnIds: [], collapsedKeys: new Set() },
    totals: { mode: 'off', label: 'Totals' },
    config: {
      rowHeight: 40,
      headerHeight: 44,
      overscanRows: 10,
      overscanColumns: 5,
      rowIdField: 'id',
    },
  };
}

describe('SortFeature', () => {
  it('returns original reference when no sort criteria', () => {
    const step = createSortStep();
    const rows: ReadonlyArray<Row> = [{ id: 2 }, { id: 1 }];
    const state = createMockState([
      { id: 'id', field: 'id', header: 'ID', width: 80, sortable: true },
    ], []);

    const result = step(rows, state);
    expect(result).toBe(rows);
  });

  it('sorts numbers ascending', () => {
    const step = createSortStep();
    const rows: ReadonlyArray<Row> = [{ id: 3 }, { id: 1 }, { id: 2 }];
    const state = createMockState([
      { id: 'id', field: 'id', header: 'ID', width: 80, sortable: true },
    ], [{ columnId: 'id', direction: 'asc' }]);

    const result = step(rows, state);
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('sorts strings descending', () => {
    const step = createSortStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'carol' },
      { id: 3, name: 'Bob' },
    ];
    const state = createMockState([
      { id: 'name', field: 'name', header: 'Name', width: 120, sortable: true },
    ], [{ columnId: 'name', direction: 'desc' }]);

    const result = step(rows, state);
    expect(result).toEqual([
      { id: 2, name: 'carol' },
      { id: 3, name: 'Bob' },
      { id: 1, name: 'Alice' },
    ]);
  });

  it('supports multi-column criteria', () => {
    const step = createSortStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, department: 'Engineering', salary: 90000 },
      { id: 2, department: 'Engineering', salary: 120000 },
      { id: 3, department: 'Design', salary: 80000 },
      { id: 4, department: 'Design', salary: 110000 },
    ];
    const state = createMockState([
      { id: 'department', field: 'department', header: 'Department', width: 120, sortable: true },
      { id: 'salary', field: 'salary', header: 'Salary', width: 100, sortable: true },
    ], [
      { columnId: 'department', direction: 'asc' },
      { columnId: 'salary', direction: 'desc' },
    ]);

    const result = step(rows, state);
    expect(result).toEqual([
      { id: 4, department: 'Design', salary: 110000 },
      { id: 3, department: 'Design', salary: 80000 },
      { id: 2, department: 'Engineering', salary: 120000 },
      { id: 1, department: 'Engineering', salary: 90000 },
    ]);
  });

  it('keeps stable ordering for equal sort keys', () => {
    const step = createSortStep();
    const rows: ReadonlyArray<Row> = [
      { id: 10, score: 5 },
      { id: 11, score: 5 },
      { id: 12, score: 5 },
    ];
    const state = createMockState([
      { id: 'score', field: 'score', header: 'Score', width: 100, sortable: true },
    ], [{ columnId: 'score', direction: 'asc' }]);

    const result = step(rows, state);
    expect(result).toEqual(rows);
    expect(result[0]).toBe(rows[0]);
    expect(result[1]).toBe(rows[1]);
    expect(result[2]).toBe(rows[2]);
  });

  it('ignores unknown and non-sortable columns', () => {
    const step = createSortStep();
    const rows: ReadonlyArray<Row> = [
      { id: 2, name: 'B' },
      { id: 1, name: 'A' },
    ];
    const state = createMockState([
      { id: 'name', field: 'name', header: 'Name', width: 120, sortable: false },
    ], [
      { columnId: 'unknown', direction: 'asc' },
      { columnId: 'name', direction: 'asc' },
    ]);

    const result = step(rows, state);
    expect(result).toBe(rows);
  });
});
