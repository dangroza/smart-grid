import type { CellValue, ColumnId, Row } from '../../types';

export const GROUP_ROW_FLAG_FIELD = '__sg_group';
export const GROUP_ROW_KEY_FIELD = '__sg_group_key';
export const GROUP_ROW_LEVEL_FIELD = '__sg_group_level';
export const GROUP_ROW_COUNT_FIELD = '__sg_group_count';
export const GROUP_ROW_LABEL_FIELD = '__sg_group_label';
export const GROUP_ROW_COLUMN_ID_FIELD = '__sg_group_column_id';
export const GROUP_ROW_EXPANDED_FIELD = '__sg_group_expanded';

export function isGroupRow(row: Row): boolean {
  return row[GROUP_ROW_FLAG_FIELD] === true;
}

export function getGroupRowKey(row: Row): string | null {
  const key = row[GROUP_ROW_KEY_FIELD];
  return typeof key === 'string' ? key : null;
}

export function createGroupRow(input: {
  readonly key: string;
  readonly level: number;
  readonly count: number;
  readonly label: string;
  readonly columnId: ColumnId;
  readonly expanded: boolean;
}): Row {
  const row: Record<string, CellValue> = {
    [GROUP_ROW_FLAG_FIELD]: true,
    [GROUP_ROW_KEY_FIELD]: input.key,
    [GROUP_ROW_LEVEL_FIELD]: input.level,
    [GROUP_ROW_COUNT_FIELD]: input.count,
    [GROUP_ROW_LABEL_FIELD]: input.label,
    [GROUP_ROW_COLUMN_ID_FIELD]: input.columnId,
    [GROUP_ROW_EXPANDED_FIELD]: input.expanded,
  };

  return row;
}
