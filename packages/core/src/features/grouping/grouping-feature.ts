// =============================================================================
// Smart Grid — Grouping Feature
// Pipeline-based stable grouping by one or more columns.
// =============================================================================

import type { ColumnDef, ColumnId, FeatureModule, GridContext, PipelineStep, Row } from '../../types';
import { createGroupRow } from './grouping-row';

const GROUPING_STEP_ID = 'feature:grouping';
const GROUPING_STEP_PRIORITY = 25;

export function createGroupingStep(): PipelineStep {
  let lastInput: ReadonlyArray<Row> | null = null;
  let lastColumnsRef: ReadonlyArray<ColumnDef> | null = null;
  let lastGroupingIdsRef: ReadonlyArray<ColumnId> | null = null;
  let lastCollapsedKeysRef: ReadonlySet<string> | null = null;
  let lastOutput: ReadonlyArray<Row> | null = null;

  return (data, state) => {
    const requestedColumnIds = state.grouping.columnIds;
    if (requestedColumnIds.length === 0 || data.length === 0) {
      return data;
    }

    if (
      lastInput === data &&
      lastColumnsRef === state.columns &&
      lastGroupingIdsRef === state.grouping.columnIds &&
      lastCollapsedKeysRef === state.grouping.collapsedKeys &&
      lastOutput
    ) {
      return lastOutput;
    }

    const columnsById = new Map<string, ColumnDef>(state.columns.map((column) => [column.id, column]));
    const activeColumnIds = normalizeGroupingColumnIds(requestedColumnIds, columnsById);

    if (activeColumnIds.length === 0) {
      return data;
    }

    const flattened = flattenWithGroupHeaders(
      data,
      activeColumnIds,
      columnsById,
      state.grouping.collapsedKeys,
    );

    const output = sameRowSequence(flattened, data) ? data : flattened;

    lastInput = data;
    lastColumnsRef = state.columns;
    lastGroupingIdsRef = state.grouping.columnIds;
    lastCollapsedKeysRef = state.grouping.collapsedKeys;
    lastOutput = output;

    return output;
  };
}

function flattenWithGroupHeaders(
  rows: ReadonlyArray<Row>,
  columnIds: ReadonlyArray<ColumnId>,
  columnsById: ReadonlyMap<string, ColumnDef>,
  collapsedKeys: ReadonlySet<string>,
): Row[] {
  return flattenLevel(rows, columnIds, columnsById, collapsedKeys, 0, '');
}

function flattenLevel(
  rows: ReadonlyArray<Row>,
  columnIds: ReadonlyArray<ColumnId>,
  columnsById: ReadonlyMap<string, ColumnDef>,
  collapsedKeys: ReadonlySet<string>,
  level: number,
  parentKey: string,
): Row[] {
  if (rows.length === 0) {
    return [];
  }

  if (level >= columnIds.length) {
    return [...rows];
  }

  const columnId = columnIds[level]!;
  const column = columnsById.get(columnId);
  if (!column) {
    return [...rows];
  }

  const groups = new Map<string, { keyValue: unknown; rows: Row[] }>();

  for (const row of rows) {
    const keyValue = row[column.field] ?? null;
    const keyPart = normalizeGroupKeyPart(keyValue);
    const bucket = groups.get(keyPart);

    if (bucket) {
      bucket.rows.push(row);
    } else {
      groups.set(keyPart, { keyValue, rows: [row] });
    }
  }

  const output: Row[] = [];
  for (const [keyPart, bucket] of groups) {
    const groupKey = parentKey.length > 0 ? `${parentKey}|${columnId}:${keyPart}` : `${columnId}:${keyPart}`;
    const collapsed = collapsedKeys.has(groupKey);
    const label = bucket.keyValue === null || bucket.keyValue === undefined ? '∅' : String(bucket.keyValue);

    output.push(
      createGroupRow({
        key: groupKey,
        level,
        count: bucket.rows.length,
        label,
        columnId,
        expanded: !collapsed,
      }),
    );

    if (!collapsed) {
      output.push(...flattenLevel(bucket.rows, columnIds, columnsById, collapsedKeys, level + 1, groupKey));
    }
  }

  return output;
}

function normalizeGroupingColumnIds(
  input: ReadonlyArray<ColumnId>,
  columnsById: ReadonlyMap<string, ColumnDef>,
): ReadonlyArray<ColumnId> {
  const unique = new Set<ColumnId>();

  for (const columnId of input) {
    if (unique.has(columnId)) {
      continue;
    }

    const column = columnsById.get(columnId);
    if (!column || column.groupable === false) {
      continue;
    }

    unique.add(columnId);
  }

  return [...unique];
}

function normalizeGroupKeyPart(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return 'nan';
    }
    return `n:${String(value)}`;
  }

  if (typeof value === 'boolean') {
    return `b:${value ? '1' : '0'}`;
  }

  return `s:${String(value)}`;
}

function sameRowSequence(left: ReadonlyArray<Row>, right: ReadonlyArray<Row>): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export function createGroupingFeature(): FeatureModule {
  let context: GridContext | null = null;

  function install(nextContext: GridContext): void {
    if (context) return;

    context = nextContext;
    context.pipeline.addStep(GROUPING_STEP_ID, createGroupingStep(), GROUPING_STEP_PRIORITY);
  }

  function destroy(): void {
    if (!context) return;

    context.pipeline.removeStep(GROUPING_STEP_ID);
    context = null;
  }

  return {
    id: 'grouping',
    install,
    destroy,
  };
}
