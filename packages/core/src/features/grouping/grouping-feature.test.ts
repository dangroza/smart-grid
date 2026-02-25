// =============================================================================
// Smart Grid — Grouping Feature Tests
// =============================================================================

import { describe, expect, it } from 'vitest';
import { createGroupingStep } from './grouping-feature';
import type { ColumnDef, GridState, Row } from '../../types';

function createMockState(
  columns: ReadonlyArray<ColumnDef>,
  groupingColumnIds: ReadonlyArray<string>,
  collapsedKeys: ReadonlyArray<string> = [],
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
    filter: { criteria: [], mode: 'client' },
    selection: { selectedIds: new Set(), allSelected: false },
    pagination: { page: 0, pageSize: 0, totalRows: 0 },
    freeze: { leftCount: 0, rightCount: 0 },
    grouping: { columnIds: groupingColumnIds, collapsedKeys: new Set(collapsedKeys) },
    config: {
      rowHeight: 40,
      headerHeight: 44,
      overscanRows: 10,
      overscanColumns: 5,
      rowIdField: 'id',
    },
  };
}

describe('GroupingFeature', () => {
  it('returns original reference when grouping is disabled', () => {
    const step = createGroupingStep();
    const rows: ReadonlyArray<Row> = [{ id: 1 }, { id: 2 }];
    const state = createMockState([{ id: 'id', field: 'id', header: 'ID', width: 80 }], []);

    const result = step(rows, state);
    expect(result).toBe(rows);
  });

  it('groups rows by one column while preserving in-group order', () => {
    const step = createGroupingStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, team: 'A', score: 10 },
      { id: 2, team: 'B', score: 20 },
      { id: 3, team: 'A', score: 30 },
      { id: 4, team: 'B', score: 40 },
    ];

    const state = createMockState([
      { id: 'team', field: 'team', header: 'Team', width: 100 },
      { id: 'score', field: 'score', header: 'Score', width: 100 },
    ], ['team']);

    const result = step(rows, state);

    expect(result).toHaveLength(6);
    expect(result[0]?.__sg_group).toBe(true);
    expect(result[0]?.__sg_group_key).toBe('team:s:A');
    expect(result[1]).toEqual({ id: 1, team: 'A', score: 10 });
    expect(result[2]).toEqual({ id: 3, team: 'A', score: 30 });
    expect(result[3]?.__sg_group).toBe(true);
    expect(result[3]?.__sg_group_key).toBe('team:s:B');
    expect(result[4]).toEqual({ id: 2, team: 'B', score: 20 });
    expect(result[5]).toEqual({ id: 4, team: 'B', score: 40 });
  });

  it('supports multi-column grouping keys', () => {
    const step = createGroupingStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, country: 'US', city: 'NY' },
      { id: 2, country: 'US', city: 'SF' },
      { id: 3, country: 'DE', city: 'BER' },
      { id: 4, country: 'US', city: 'NY' },
    ];

    const state = createMockState([
      { id: 'country', field: 'country', header: 'Country', width: 100 },
      { id: 'city', field: 'city', header: 'City', width: 100 },
    ], ['country', 'city']);

    const result = step(rows, state);

    const groupRows = result.filter((row) => row.__sg_group === true);
    expect(groupRows.length).toBeGreaterThan(0);
    expect(groupRows.some((row) => row.__sg_group_key === 'country:s:US')).toBe(true);
    expect(groupRows.some((row) => row.__sg_group_key === 'country:s:US|city:s:NY')).toBe(true);
    expect(groupRows.some((row) => row.__sg_group_key === 'country:s:US|city:s:SF')).toBe(true);
    expect(groupRows.some((row) => row.__sg_group_key === 'country:s:DE')).toBe(true);
  });

  it('ignores duplicate, unknown, and non-groupable columns', () => {
    const step = createGroupingStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, team: 'A' },
      { id: 2, team: 'B' },
      { id: 3, team: 'A' },
    ];

    const state = createMockState([
      { id: 'team', field: 'team', header: 'Team', width: 100, groupable: false },
    ], ['team', 'unknown', 'team']);

    const result = step(rows, state);
    expect(result).toBe(rows);
  });

  it('collapses a group and hides its children', () => {
    const step = createGroupingStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, team: 'A' },
      { id: 2, team: 'B' },
      { id: 3, team: 'A' },
    ];

    const state = createMockState([{ id: 'team', field: 'team', header: 'Team', width: 100 }], ['team'], [
      'team:s:A',
    ]);

    const result = step(rows, state);

    expect(result).toEqual([
      {
        __sg_group: true,
        __sg_group_key: 'team:s:A',
        __sg_group_level: 0,
        __sg_group_count: 2,
        __sg_group_label: 'A',
        __sg_group_column_id: 'team',
        __sg_group_expanded: false,
      },
      {
        __sg_group: true,
        __sg_group_key: 'team:s:B',
        __sg_group_level: 0,
        __sg_group_count: 1,
        __sg_group_label: 'B',
        __sg_group_column_id: 'team',
        __sg_group_expanded: true,
      },
      { id: 2, team: 'B' },
    ]);
  });

  it('returns memoized output reference when grouping inputs are unchanged', () => {
    const step = createGroupingStep();
    const rows: ReadonlyArray<Row> = [
      { id: 1, team: 'A' },
      { id: 2, team: 'B' },
      { id: 3, team: 'A' },
    ];

    const baseColumns: ReadonlyArray<ColumnDef> = [{ id: 'team', field: 'team', header: 'Team', width: 100 }];
    const groupingIds = ['team'];
    const collapsed = new Set<string>();

    const stateA = createMockState(baseColumns, groupingIds);
    const stateB: GridState = {
      ...createMockState(baseColumns, groupingIds),
      // force a different top-level state object while keeping grouping inputs by reference
      viewport: { ...createMockState(baseColumns, groupingIds).viewport, scrollTop: 120 },
      columns: baseColumns,
      grouping: { columnIds: groupingIds, collapsedKeys: collapsed },
    };
    const stateAWithRefs: GridState = {
      ...stateA,
      columns: baseColumns,
      grouping: { columnIds: groupingIds, collapsedKeys: collapsed },
    };

    const resultA = step(rows, stateAWithRefs);
    const resultB = step(rows, stateB);

    expect(resultB).toBe(resultA);
  });
});
