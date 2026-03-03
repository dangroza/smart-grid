import type { CellValue, Row } from '../../types';

export const TOTALS_ROW_FLAG_FIELD = '__sg_totals';

export function isTotalsRow(row: Row): boolean {
  return row[TOTALS_ROW_FLAG_FIELD] === true;
}

export function createTotalsRow(values: Readonly<Record<string, CellValue>>): Row {
  return {
    [TOTALS_ROW_FLAG_FIELD]: true,
    ...values,
  };
}
