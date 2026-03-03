// =============================================================================
// Smart Grid — Selection Utilities Tests
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  collectSelectableRowIds,
  computeAllSelected,
  getRowId,
  normalizeSelection,
} from './selection-utils';

describe('selection-utils', () => {
  it('collects selectable row ids and skips group rows', () => {
    const rows = [
      { id: 1, name: 'A' },
      { __sg_group: true, __sg_group_key: 'team:s:A' },
      { id: 2, name: 'B' },
    ] as const;

    const ids = collectSelectableRowIds(rows, 'id');
    expect([...ids]).toEqual([1, 2]);
  });

  it('returns null for invalid row ids', () => {
    expect(getRowId({ name: 'A' }, 'id')).toBeNull();
    expect(getRowId({ id: true }, 'id')).toBeNull();
  });

  it('normalizes selection against allowed ids', () => {
    const allowed = new Set([1, 2, 3]);
    const selected = normalizeSelection([3, 9, 1, 3], allowed);
    expect([...selected]).toEqual([3, 1]);
  });

  it('computes allSelected only when all allowed ids are selected', () => {
    const allowed = new Set([1, 2]);
    expect(computeAllSelected(new Set([1]), allowed)).toBe(false);
    expect(computeAllSelected(new Set([1, 2]), allowed)).toBe(true);
    expect(computeAllSelected(new Set(), new Set())).toBe(false);
  });
});
