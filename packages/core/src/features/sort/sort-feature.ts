// =============================================================================
// Smart Grid — Sort Feature
// Pipeline-based stable multi-column sorting.
// =============================================================================

import type {
  ColumnDef,
  FeatureModule,
  GridContext,
  PipelineStep,
  Row,
  SortCriterion,
} from '../../types';

const SORT_STEP_ID = 'feature:sort';
const SORT_STEP_PRIORITY = 20;

export function createSortStep(): PipelineStep {
  return (data, state) => {
    const criteria = state.sort.criteria;
    if (criteria.length === 0 || data.length <= 1) {
      return data;
    }

    const columnsById = new Map<string, ColumnDef>(
      state.columns.map((column) => [column.id, column]),
    );

    const activeCriteria = criteria.filter((criterion) => {
      const column = columnsById.get(criterion.columnId);
      return !!column && column.sortable !== false;
    });

    if (activeCriteria.length === 0) {
      return data;
    }

    const indexedRows = data.map((row, index) => ({ row, index }));

    indexedRows.sort((left, right) => {
      const result = compareRows(left.row, right.row, activeCriteria, columnsById);
      if (result !== 0) {
        return result;
      }

      // Stable tie-breaker
      return left.index - right.index;
    });

    const sortedRows = indexedRows.map((item) => item.row);

    // Preserve reference when order did not change (cache-friendly)
    for (let i = 0; i < sortedRows.length; i++) {
      if (sortedRows[i] !== data[i]) {
        return sortedRows;
      }
    }

    return data;
  };
}

function compareRows(
  left: Row,
  right: Row,
  criteria: ReadonlyArray<SortCriterion>,
  columnsById: ReadonlyMap<string, ColumnDef>,
): number {
  for (const criterion of criteria) {
    const column = columnsById.get(criterion.columnId);
    if (!column) continue;

    const leftValue = left[column.field];
    const rightValue = right[column.field];

    const rawCompare = compareValues(leftValue, rightValue);
    if (rawCompare === 0) continue;

    return criterion.direction === 'asc' ? rawCompare : -rawCompare;
  }

  return 0;
}

function compareValues(left: unknown, right: unknown): number {
  if (left === right) return 0;

  const leftMissing = left === null || left === undefined;
  const rightMissing = right === null || right === undefined;

  // Keep missing values at the end
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;

  if (typeof left === 'number' && typeof right === 'number') {
    if (Number.isNaN(left) && Number.isNaN(right)) return 0;
    if (Number.isNaN(left)) return 1;
    if (Number.isNaN(right)) return -1;
    return left - right;
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function createSortFeature(): FeatureModule {
  let context: GridContext | null = null;

  function install(nextContext: GridContext): void {
    if (context) return;
    context = nextContext;
    context.pipeline.addStep(SORT_STEP_ID, createSortStep(), SORT_STEP_PRIORITY);
  }

  function destroy(): void {
    if (!context) return;
    context.pipeline.removeStep(SORT_STEP_ID);
    context = null;
  }

  return {
    id: 'sort',
    install,
    destroy,
  };
}
