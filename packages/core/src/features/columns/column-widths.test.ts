// =============================================================================
// Smart Grid — Column Width Resolution Tests
// =============================================================================

import { describe, expect, it } from 'vitest';
import { resolveVisibleColumnsForWidth } from './column-widths';
import type { ColumnDef } from '../../types';

describe('column-widths', () => {
  it('keeps base widths when no extra space exists', () => {
    const columns: ReadonlyArray<ColumnDef> = [
      { id: 'a', field: 'a', header: 'A', width: 120, flexGrow: 1 },
      { id: 'b', field: 'b', header: 'B', width: 120, flexGrow: 1 },
    ];

    const result = resolveVisibleColumnsForWidth(columns, 200);
    expect(result.map((column) => column.width)).toEqual([120, 120]);
  });

  it('distributes extra space across fill columns by weight', () => {
    const columns: ReadonlyArray<ColumnDef> = [
      { id: 'fixed', field: 'fixed', header: 'Fixed', width: 100, fixedWidth: true },
      { id: 'w1', field: 'w1', header: 'W1', width: 100, flexGrow: 1 },
      { id: 'w2', field: 'w2', header: 'W2', width: 100, flexGrow: 2 },
    ];

    const result = resolveVisibleColumnsForWidth(columns, 460);
    // Base total = 300, extra = 160 => w1 +53, w2 +107 (rounded)
    expect(result.map((column) => column.width)).toEqual([100, 153, 207]);
  });

  it('does not expand columns marked fixedWidth', () => {
    const columns: ReadonlyArray<ColumnDef> = [
      { id: 'a', field: 'a', header: 'A', width: 120, fixedWidth: true, flexGrow: 1 },
      { id: 'b', field: 'b', header: 'B', width: 120, flexGrow: 1 },
    ];

    const result = resolveVisibleColumnsForWidth(columns, 400);
    expect(result.map((column) => column.width)).toEqual([120, 280]);
  });
});
