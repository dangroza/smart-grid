// =============================================================================
// Smart Grid — Filter Feature Tests
// =============================================================================

import { describe, expect, it } from 'vitest';
import { createFilterStep } from './filter-feature';
import type { ColumnDef, FilterCriterion, FilterMode, GridState, Row } from '../../types';

function createMockState(
  columns: ReadonlyArray<ColumnDef>,
  criteria: ReadonlyArray<FilterCriterion>,
  mode: FilterMode = 'client',
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
    sort: { criteria: [] },
    filter: { criteria, mode },
    selection: { selectedIds: new Set(), allSelected: false },
    pagination: { page: 0, pageSize: 50, totalRows: 0 },
    config: {
      rowHeight: 40,
      headerHeight: 44,
      overscanRows: 10,
      overscanColumns: 5,
      rowIdField: 'id',
    },
  };
}

describe('FilterFeature', () => {
  it('returns original reference when there are no criteria', () => {
    const step = createFilterStep();
    const rows: ReadonlyArray<Row> = [{ id: 1 }, { id: 2 }];
    const state = createMockState([
      { id: 'id', field: 'id', header: 'ID', width: 80, filterable: true },
    ], []);

    const result = step(rows, state);
    expect(result).toBe(rows);
  });

  it('returns original reference in server mode', () => {
    const step = createFilterStep();
    const rows: ReadonlyArray<Row> = [{ id: 1 }, { id: 2 }];
    const state = createMockState([
      { id: 'id', field: 'id', header: 'ID', width: 80, filterable: true },
    ], [{ columnId: 'id', operator: 'equals', value: 1 }], 'server');

    const result = step(rows, state);
    expect(result).toBe(rows);
  });

  it('filters with equals operator', () => {
    const step = createFilterStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, status: 'active' },
      { id: 2, status: 'inactive' },
      { id: 3, status: 'active' },
    ];
    const state = createMockState([
      { id: 'status', field: 'status', header: 'Status', width: 120, filterable: true },
    ], [{ columnId: 'status', operator: 'equals', value: 'ACTIVE' }]);

    const result = step(rows, state);
    expect(result).toEqual([
      { id: 1, status: 'active' },
      { id: 3, status: 'active' },
    ]);
  });

  it('filters with contains operator', () => {
    const step = createFilterStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, name: 'Alice Johnson' },
      { id: 2, name: 'Bob Marley' },
      { id: 3, name: 'Alicia Keys' },
    ];
    const state = createMockState([
      { id: 'name', field: 'name', header: 'Name', width: 180, filterable: true },
    ], [{ columnId: 'name', operator: 'contains', value: 'ali' }]);

    const result = step(rows, state);
    expect(result).toEqual([
      { id: 1, name: 'Alice Johnson' },
      { id: 3, name: 'Alicia Keys' },
    ]);
  });

  it('supports numeric ranges with between', () => {
    const step = createFilterStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, score: 59 },
      { id: 2, score: 60 },
      { id: 3, score: 75 },
      { id: 4, score: 90 },
      { id: 5, score: 91 },
    ];
    const state = createMockState([
      { id: 'score', field: 'score', header: 'Score', width: 100, filterable: true },
    ], [{ columnId: 'score', operator: 'between', value: [60, 90] }]);

    const result = step(rows, state);
    expect(result).toEqual([
      { id: 2, score: 60 },
      { id: 3, score: 75 },
      { id: 4, score: 90 },
    ]);
  });

  it('supports in and notIn operators', () => {
    const step = createFilterStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, region: 'EU' },
      { id: 2, region: 'US' },
      { id: 3, region: 'APAC' },
    ];

    const inState = createMockState([
      { id: 'region', field: 'region', header: 'Region', width: 100, filterable: true },
    ], [{ columnId: 'region', operator: 'in', value: ['EU', 'APAC'] }]);

    const notInState = createMockState([
      { id: 'region', field: 'region', header: 'Region', width: 100, filterable: true },
    ], [{ columnId: 'region', operator: 'notIn', value: ['US'] }]);

    expect(step(rows, inState)).toEqual([
      { id: 1, region: 'EU' },
      { id: 3, region: 'APAC' },
    ]);

    expect(step(rows, notInState)).toEqual([
      { id: 1, region: 'EU' },
      { id: 3, region: 'APAC' },
    ]);
  });

  it('supports isEmpty and isNotEmpty operators', () => {
    const step = createFilterStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, note: '' },
      { id: 2, note: 'hello' },
      { id: 3, note: null },
      { id: 4, note: '  ' },
      { id: 5, note: undefined },
    ];

    const emptyState = createMockState([
      { id: 'note', field: 'note', header: 'Note', width: 100, filterable: true },
    ], [{ columnId: 'note', operator: 'isEmpty', value: '' }]);

    const notEmptyState = createMockState([
      { id: 'note', field: 'note', header: 'Note', width: 100, filterable: true },
    ], [{ columnId: 'note', operator: 'isNotEmpty', value: '' }]);

    expect(step(rows, emptyState)).toEqual([
      { id: 1, note: '' },
      { id: 3, note: null },
      { id: 4, note: '  ' },
      { id: 5, note: undefined },
    ]);

    expect(step(rows, notEmptyState)).toEqual([{ id: 2, note: 'hello' }]);
  });

  it('applies multiple criteria as AND conditions', () => {
    const step = createFilterStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, country: 'US', age: 22 },
      { id: 2, country: 'US', age: 17 },
      { id: 3, country: 'DE', age: 25 },
      { id: 4, country: 'US', age: 31 },
    ];
    const state = createMockState([
      { id: 'country', field: 'country', header: 'Country', width: 100, filterable: true },
      { id: 'age', field: 'age', header: 'Age', width: 80, filterable: true },
    ], [
      { columnId: 'country', operator: 'equals', value: 'US' },
      { columnId: 'age', operator: 'greaterThanOrEqual', value: 21 },
    ]);

    const result = step(rows, state);
    expect(result).toEqual([
      { id: 1, country: 'US', age: 22 },
      { id: 4, country: 'US', age: 31 },
    ]);
  });

  it('ignores unknown and non-filterable columns', () => {
    const step = createFilterStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    const state = createMockState([
      { id: 'name', field: 'name', header: 'Name', width: 120, filterable: false },
    ], [
      { columnId: 'unknown', operator: 'equals', value: 'A' },
      { columnId: 'name', operator: 'equals', value: 'A' },
    ]);

    const result = step(rows, state);
    expect(result).toBe(rows);
  });
});
