// =============================================================================
// Smart Grid — Totals Feature
// Pipeline step that appends totals row for page or all-pages scope.
// =============================================================================

import type { ColumnDef, FeatureModule, GridContext, PipelineStep, Row } from '../../types';
import { isGroupRow } from '../grouping/grouping-row';
import { createTotalsRow, isTotalsRow } from './totals-row';

const TOTALS_STEP_ID = 'feature:totals';
const TOTALS_STEP_PRIORITY = 40;

export function createTotalsStep(): PipelineStep {
  return (data, state) => {
    const { mode, label } = state.totals;

    if (mode === 'off') {
      return data;
    }

    const sourceRows = (mode === 'allPages' ? state.data : data).filter((row) => !isGroupRow(row) && !isTotalsRow(row));
    if (sourceRows.length === 0) {
      return data;
    }

    const totalsValues = buildTotalsValues(sourceRows, state.columns, label);
    const totalsRow = createTotalsRow(totalsValues);

    return [...data.filter((row) => !isTotalsRow(row)), totalsRow];
  };
}

function buildTotalsValues(
  rows: ReadonlyArray<Row>,
  columns: ReadonlyArray<ColumnDef>,
  label: string,
): Readonly<Record<string, string | number | boolean | null | undefined>> {
  const values: Record<string, string | number | boolean | null | undefined> = {};

  const visibleColumns = columns.filter((column) => column.visible !== false);
  const first = visibleColumns[0];
  if (first) {
    values[first.field] = label;
  }

  for (const column of visibleColumns) {
    const total = sumNumericColumn(rows, column.field);
    if (total !== null) {
      values[column.field] = total;
    }
  }

  return values;
}

function sumNumericColumn(rows: ReadonlyArray<Row>, field: string): number | null {
  let sum = 0;
  let hasNumeric = false;

  for (const row of rows) {
    const value = row[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      hasNumeric = true;
      sum += value;
    }
  }

  return hasNumeric ? sum : null;
}

export function createTotalsFeature(): FeatureModule {
  let context: GridContext | null = null;

  function install(nextContext: GridContext): void {
    if (context) return;
    context = nextContext;
    context.pipeline.addStep(TOTALS_STEP_ID, createTotalsStep(), TOTALS_STEP_PRIORITY);
  }

  function destroy(): void {
    if (!context) return;
    context.pipeline.removeStep(TOTALS_STEP_ID);
    context = null;
  }

  return {
    id: 'totals',
    install,
    destroy,
  };
}
