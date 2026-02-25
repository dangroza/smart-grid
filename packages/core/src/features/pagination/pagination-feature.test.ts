// =============================================================================
// Smart Grid — Pagination Feature Tests
// =============================================================================

import { describe, expect, it } from 'vitest';
import { createPaginationStep } from './pagination-feature';
import type { ColumnDef, GridState, Row } from '../../types';

function createMockState(page: number, pageSize: number): GridState {
  const columns: ReadonlyArray<ColumnDef> = [
    { id: 'id', field: 'id', header: 'ID', width: 80 },
  ];

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
    filter: { criteria: [], mode: 'client' },
    selection: { selectedIds: new Set(), allSelected: false },
    pagination: { page, pageSize, totalRows: 0 },
    config: {
      rowHeight: 40,
      headerHeight: 44,
      overscanRows: 10,
      overscanColumns: 5,
      rowIdField: 'id',
    },
  };
}

function makeRows(count: number): ReadonlyArray<Row> {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    value: `row-${index + 1}`,
  }));
}

describe('PaginationFeature', () => {
  it('returns original reference when pagination is disabled', () => {
    const step = createPaginationStep();
    const rows = makeRows(10);

    const result = step(rows, createMockState(0, 0));
    expect(result).toBe(rows);
  });

  it('returns first page when page is zero', () => {
    const step = createPaginationStep();
    const rows = makeRows(10);

    const result = step(rows, createMockState(0, 3));
    expect(result).toEqual([
      { id: 1, value: 'row-1' },
      { id: 2, value: 'row-2' },
      { id: 3, value: 'row-3' },
    ]);
  });

  it('returns middle page slice', () => {
    const step = createPaginationStep();
    const rows = makeRows(10);

    const result = step(rows, createMockState(1, 4));
    expect(result).toEqual([
      { id: 5, value: 'row-5' },
      { id: 6, value: 'row-6' },
      { id: 7, value: 'row-7' },
      { id: 8, value: 'row-8' },
    ]);
  });

  it('returns partial last page slice', () => {
    const step = createPaginationStep();
    const rows = makeRows(10);

    const result = step(rows, createMockState(2, 4));
    expect(result).toEqual([
      { id: 9, value: 'row-9' },
      { id: 10, value: 'row-10' },
    ]);
  });

  it('clamps page to valid max page', () => {
    const step = createPaginationStep();
    const rows = makeRows(7);

    const result = step(rows, createMockState(99, 3));
    expect(result).toEqual([
      { id: 7, value: 'row-7' },
    ]);
  });

  it('normalizes negative page to zero', () => {
    const step = createPaginationStep();
    const rows = makeRows(6);

    const result = step(rows, createMockState(-5, 2));
    expect(result).toEqual([
      { id: 1, value: 'row-1' },
      { id: 2, value: 'row-2' },
    ]);
  });
});
