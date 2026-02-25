// =============================================================================
// Smart Grid — Filter Feature
// Pipeline-based per-column filtering.
// =============================================================================

import type {
  CellValue,
  ColumnDef,
  FeatureModule,
  FilterCriterion,
  GridContext,
  PipelineStep,
  Row,
} from '../../types';

const FILTER_STEP_ID = 'feature:filter';
const FILTER_STEP_PRIORITY = 10;

export function createFilterStep(): PipelineStep {
  return (data, state) => {
    const { criteria, mode } = state.filter;

    // In server mode, filter criteria are emitted but filtering is expected
    // to be applied by the backend.
    if (mode === 'server' || criteria.length === 0 || data.length === 0) {
      return data;
    }

    const columnsById = new Map<string, ColumnDef>(
      state.columns.map((column) => [column.id, column]),
    );

    const activeCriteria = criteria.filter((criterion) => {
      const column = columnsById.get(criterion.columnId);
      return !!column && column.filterable !== false;
    });

    if (activeCriteria.length === 0) {
      return data;
    }

    const filtered = data.filter((row) => matchesAllCriteria(row, activeCriteria, columnsById));

    // Preserve reference when no row was filtered out (cache-friendly)
    if (filtered.length === data.length) {
      for (let i = 0; i < data.length; i++) {
        if (filtered[i] !== data[i]) {
          return filtered;
        }
      }

      return data;
    }

    return filtered;
  };
}

function matchesAllCriteria(
  row: Row,
  criteria: ReadonlyArray<FilterCriterion>,
  columnsById: ReadonlyMap<string, ColumnDef>,
): boolean {
  for (const criterion of criteria) {
    const column = columnsById.get(criterion.columnId);
    if (!column) {
      continue;
    }

    const cellValue = row[column.field];
    if (!matchesCriterion(cellValue, criterion)) {
      return false;
    }
  }

  return true;
}

function matchesCriterion(cellValue: CellValue, criterion: FilterCriterion): boolean {
  switch (criterion.operator) {
    case 'equals':
      return compareForEquality(cellValue, criterion.value);

    case 'notEquals':
      return !compareForEquality(cellValue, criterion.value);

    case 'contains':
      return containsValue(cellValue, criterion.value);

    case 'notContains':
      return !containsValue(cellValue, criterion.value);

    case 'startsWith':
      return startsWithValue(cellValue, criterion.value);

    case 'endsWith':
      return endsWithValue(cellValue, criterion.value);

    case 'greaterThan':
      return compareForOrdering(cellValue, criterion.value) > 0;

    case 'lessThan':
      return compareForOrdering(cellValue, criterion.value) < 0;

    case 'greaterThanOrEqual':
      return compareForOrdering(cellValue, criterion.value) >= 0;

    case 'lessThanOrEqual':
      return compareForOrdering(cellValue, criterion.value) <= 0;

    case 'between':
      return isBetween(cellValue, criterion.value);

    case 'in':
      return isInList(cellValue, criterion.value);

    case 'notIn':
      return !isInList(cellValue, criterion.value);

    case 'isEmpty':
      return isEmptyValue(cellValue);

    case 'isNotEmpty':
      return !isEmptyValue(cellValue);

    default:
      return true;
  }
}

function compareForEquality(left: CellValue, right: CellValue | ReadonlyArray<CellValue>): boolean {
  if (Array.isArray(right)) {
    return right.some((candidate) => compareForEquality(left, candidate));
  }

  if (left === right) {
    return true;
  }

  if (typeof left === 'number' && typeof right === 'number') {
    if (Number.isNaN(left) && Number.isNaN(right)) {
      return true;
    }
  }

  if (typeof left === 'string' && typeof right === 'string') {
    return left.localeCompare(right, undefined, { sensitivity: 'base' }) === 0;
  }

  return false;
}

function compareForOrdering(
  left: CellValue,
  right: CellValue | ReadonlyArray<CellValue>,
): number {
  if (Array.isArray(right)) {
    return Number.NaN;
  }

  const numericCompare = compareAsNumbers(left, right);
  if (numericCompare !== null) {
    return numericCompare;
  }

  if (left === null || left === undefined || right === null || right === undefined) {
    return Number.NaN;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function compareAsNumbers(
  left: CellValue,
  right: CellValue | ReadonlyArray<CellValue>,
): number | null {
  if (Array.isArray(right)) {
    return null;
  }

  if (typeof left === 'number' && typeof right === 'number') {
    if (Number.isNaN(left) || Number.isNaN(right)) {
      return Number.NaN;
    }

    return left - right;
  }

  if (typeof left === 'string' || typeof right === 'string') {
    return null;
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }

  return null;
}

function containsValue(cellValue: CellValue, expected: CellValue | ReadonlyArray<CellValue>): boolean {
  if (Array.isArray(expected)) {
    return expected.some((value) => containsValue(cellValue, value));
  }

  if (cellValue === null || cellValue === undefined || expected === null || expected === undefined) {
    return false;
  }

  return String(cellValue)
    .toLocaleLowerCase()
    .includes(String(expected).toLocaleLowerCase());
}

function startsWithValue(
  cellValue: CellValue,
  expected: CellValue | ReadonlyArray<CellValue>,
): boolean {
  if (Array.isArray(expected)) {
    return expected.some((value) => startsWithValue(cellValue, value));
  }

  if (cellValue === null || cellValue === undefined || expected === null || expected === undefined) {
    return false;
  }

  return String(cellValue)
    .toLocaleLowerCase()
    .startsWith(String(expected).toLocaleLowerCase());
}

function endsWithValue(cellValue: CellValue, expected: CellValue | ReadonlyArray<CellValue>): boolean {
  if (Array.isArray(expected)) {
    return expected.some((value) => endsWithValue(cellValue, value));
  }

  if (cellValue === null || cellValue === undefined || expected === null || expected === undefined) {
    return false;
  }

  return String(cellValue)
    .toLocaleLowerCase()
    .endsWith(String(expected).toLocaleLowerCase());
}

function isBetween(cellValue: CellValue, expected: CellValue | ReadonlyArray<CellValue>): boolean {
  if (!Array.isArray(expected) || expected.length < 2) {
    return false;
  }

  const lowerBound = expected[0];
  const upperBound = expected[1];

  return (
    compareForOrdering(cellValue, lowerBound) >= 0 && compareForOrdering(cellValue, upperBound) <= 0
  );
}

function isInList(cellValue: CellValue, expected: CellValue | ReadonlyArray<CellValue>): boolean {
  if (!Array.isArray(expected)) {
    return compareForEquality(cellValue, expected);
  }

  return expected.some((candidate) => compareForEquality(cellValue, candidate));
}

function isEmptyValue(value: CellValue): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

export function createFilterFeature(): FeatureModule {
  let context: GridContext | null = null;

  function install(nextContext: GridContext): void {
    if (context) return;

    context = nextContext;
    context.pipeline.addStep(FILTER_STEP_ID, createFilterStep(), FILTER_STEP_PRIORITY);
  }

  function destroy(): void {
    if (!context) return;

    context.pipeline.removeStep(FILTER_STEP_ID);
    context = null;
  }

  return {
    id: 'filter',
    install,
    destroy,
  };
}
