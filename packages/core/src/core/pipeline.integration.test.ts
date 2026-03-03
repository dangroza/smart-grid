// =============================================================================
// Smart Grid — Pipeline Integration Tests
// Feature composition: filter + sort + grouping + pagination.
// =============================================================================

import { describe, expect, it } from 'vitest';
import { createPipeline } from './pipeline';
import { createFilterStep } from '../features/filter/filter-feature';
import { createGroupingStep } from '../features/grouping/grouping-feature';
import { createPaginationStep } from '../features/pagination/pagination-feature';
import { createSortStep } from '../features/sort/sort-feature';
import type { ColumnDef, FilterMode, GridState, Row, SortCriterion } from '../types';

function createMockState(input: {
  readonly columns: ReadonlyArray<ColumnDef>;
  readonly filterCriteria?: GridState['filter']['criteria'];
  readonly filterMode?: FilterMode;
  readonly sortCriteria?: ReadonlyArray<SortCriterion>;
  readonly groupingColumnIds?: ReadonlyArray<string>;
  readonly page?: number;
  readonly pageSize?: number;
}): GridState {
  return {
    data: [],
    columns: input.columns,
    processedData: [],
    viewport: {
      scrollTop: 0,
      scrollLeft: 0,
      containerWidth: 0,
      containerHeight: 0,
      visibleRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
    },
    sort: { criteria: input.sortCriteria ?? [] },
    filter: {
      criteria: input.filterCriteria ?? [],
      mode: input.filterMode ?? 'client',
    },
    selection: { selectedIds: new Set(), allSelected: false },
    pagination: {
      page: input.page ?? 0,
      pageSize: input.pageSize ?? 0,
      totalRows: 0,
    },
    freeze: { leftCount: 0, rightCount: 0 },
    grouping: { columnIds: input.groupingColumnIds ?? [], collapsedKeys: new Set() },
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

describe('Pipeline integration', () => {
  it('composes filter -> sort -> pagination in priority order', () => {
    const rows: ReadonlyArray<Row> = [
      { id: 1, team: 'A', score: 30 },
      { id: 2, team: 'B', score: 45 },
      { id: 3, team: 'A', score: 25 },
      { id: 4, team: 'A', score: 60 },
      { id: 5, team: 'A', score: 50 },
    ];

    const state = createMockState({
      columns: [
        { id: 'team', field: 'team', header: 'Team', width: 100, filterable: true },
        { id: 'score', field: 'score', header: 'Score', width: 100, sortable: true },
      ],
      filterCriteria: [{ columnId: 'team', operator: 'equals', value: 'A' }],
      sortCriteria: [{ columnId: 'score', direction: 'desc' }],
      page: 1,
      pageSize: 2,
    });

    const pipeline = createPipeline();

    // Intentionally added out of order; priority should still control execution.
    pipeline.addStep('sort', createSortStep(), 20);
    pipeline.addStep('grouping', createGroupingStep(), 25);
    pipeline.addStep('pagination', createPaginationStep(), 30);
    pipeline.addStep('filter', createFilterStep(), 10);

    const result = pipeline.process(rows, state);

    // Filtered A rows -> [30,25,60,50]
    // Sorted desc     -> [60,50,30,25]
    // Page 1 size 2   -> [30,25]
    expect(result).toEqual([
      { id: 1, team: 'A', score: 30 },
      { id: 3, team: 'A', score: 25 },
    ]);
  });

  it('skips client filtering in server mode but still applies sort and pagination', () => {
    const rows: ReadonlyArray<Row> = [
      { id: 1, status: 'active', score: 10 },
      { id: 2, status: 'inactive', score: 40 },
      { id: 3, status: 'active', score: 30 },
      { id: 4, status: 'inactive', score: 20 },
    ];

    const state = createMockState({
      columns: [
        { id: 'status', field: 'status', header: 'Status', width: 120, filterable: true },
        { id: 'score', field: 'score', header: 'Score', width: 100, sortable: true },
      ],
      filterCriteria: [{ columnId: 'status', operator: 'equals', value: 'active' }],
      filterMode: 'server',
      sortCriteria: [{ columnId: 'score', direction: 'asc' }],
      page: 0,
      pageSize: 2,
    });

    const pipeline = createPipeline();
    pipeline.addStep('filter', createFilterStep(), 10);
    pipeline.addStep('sort', createSortStep(), 20);
    pipeline.addStep('grouping', createGroupingStep(), 25);
    pipeline.addStep('pagination', createPaginationStep(), 30);

    const result = pipeline.process(rows, state);

    // No client filtering, sort asc all rows then take first 2.
    expect(result).toEqual([
      { id: 1, status: 'active', score: 10 },
      { id: 4, status: 'inactive', score: 20 },
    ]);
  });

  it('groups rows before pagination', () => {
    const rows: ReadonlyArray<Row> = [
      { id: 1, team: 'A', score: 11 },
      { id: 2, team: 'B', score: 22 },
      { id: 3, team: 'A', score: 33 },
      { id: 4, team: 'B', score: 44 },
    ];

    const state = createMockState({
      columns: [
        { id: 'team', field: 'team', header: 'Team', width: 100 },
        { id: 'score', field: 'score', header: 'Score', width: 100 },
      ],
      groupingColumnIds: ['team'],
      page: 0,
      pageSize: 3,
    });

    const pipeline = createPipeline();
    pipeline.addStep('grouping', createGroupingStep(), 25);
    pipeline.addStep('pagination', createPaginationStep(), 30);

    const result = pipeline.process(rows, state);

    expect(result).toEqual([
      {
        __sg_group: true,
        __sg_group_key: 'team:s:A',
        __sg_group_level: 0,
        __sg_group_count: 2,
        __sg_group_label: 'A',
        __sg_group_column_id: 'team',
        __sg_group_expanded: true,
      },
      { id: 1, team: 'A', score: 11 },
      { id: 3, team: 'A', score: 33 },
    ]);
  });
});
