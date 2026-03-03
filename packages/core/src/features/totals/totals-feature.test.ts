// =============================================================================
// Smart Grid — Totals Feature Tests
// =============================================================================

import { describe, expect, it } from 'vitest';
import { createTotalsStep } from './totals-feature';
import type { ColumnDef, GridState, Row } from '../../types';

function createMockState(mode: 'off' | 'page' | 'allPages'): GridState {
  const columns: ReadonlyArray<ColumnDef> = [
    { id: 'name', field: 'name', header: 'Name', width: 120 },
    { id: 'amount', field: 'amount', header: 'Amount', width: 100 },
  ];

  return {
    data: [
      { id: 1, name: 'A', amount: 10 },
      { id: 2, name: 'B', amount: 20 },
      { id: 3, name: 'C', amount: 30 },
    ],
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
    pagination: { page: 0, pageSize: 2, totalRows: 3 },
    freeze: { leftCount: 0, rightCount: 0 },
    grouping: { columnIds: [], collapsedKeys: new Set() },
    totals: { mode, label: 'Totals' },
    config: {
      rowHeight: 40,
      headerHeight: 44,
      overscanRows: 10,
      overscanColumns: 5,
      rowIdField: 'id',
    },
  };
}

describe('TotalsFeature', () => {
  it('returns original reference when totals are off', () => {
    const step = createTotalsStep();
    const rows: ReadonlyArray<Row> = [{ id: 1, name: 'A', amount: 10 }];

    const result = step(rows, createMockState('off'));
    expect(result).toBe(rows);
  });

  it('appends page totals row', () => {
    const step = createTotalsStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, name: 'A', amount: 10 },
      { id: 2, name: 'B', amount: 20 },
    ];

    const result = step(rows, createMockState('page'));
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({
      __sg_totals: true,
      name: 'Totals',
      amount: 30,
    });
  });

  it('appends all-pages totals row using full dataset', () => {
    const step = createTotalsStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, name: 'A', amount: 10 },
      { id: 2, name: 'B', amount: 20 },
    ];

    const result = step(rows, createMockState('allPages'));
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({
      __sg_totals: true,
      name: 'Totals',
      amount: 60,
    });
  });
});
