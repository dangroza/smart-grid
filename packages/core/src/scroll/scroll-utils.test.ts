// =============================================================================
// Smart Grid — Scroll Utilities Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateVisibleRowRange,
  calculateVisibleColumnRange,
  buildPrefixSums,
  findColumnAtOffset,
  calculateViewportRange,
} from './scroll-utils';

describe('calculateVisibleRowRange', () => {
  const rowHeight = 40;
  const overscan = 5;

  it('should return empty range for zero rows', () => {
    const result = calculateVisibleRowRange(0, 400, 0, rowHeight, overscan);
    expect(result).toEqual({ startRow: 0, endRow: 0 });
  });

  it('should return empty range for zero container height', () => {
    const result = calculateVisibleRowRange(0, 0, 100, rowHeight, overscan);
    expect(result).toEqual({ startRow: 0, endRow: 0 });
  });

  it('should calculate range at top of grid', () => {
    // Container 400px tall, rowHeight 40, shows 10 rows + 5 overscan below
    const result = calculateVisibleRowRange(0, 400, 100, rowHeight, overscan);
    expect(result.startRow).toBe(0);
    expect(result.endRow).toBe(15); // 10 visible + 5 overscan
  });

  it('should include overscan above when scrolled', () => {
    // scrollTop=400 → first visible row 10, overscan 5 → start at 5
    const result = calculateVisibleRowRange(400, 400, 100, rowHeight, overscan);
    expect(result.startRow).toBe(5); // 10 - 5
    expect(result.endRow).toBe(25); // 10 + 10 + 5
  });

  it('should clamp to total rows at bottom', () => {
    const totalRows = 50;
    const result = calculateVisibleRowRange(1800, 400, totalRows, rowHeight, overscan);
    expect(result.endRow).toBe(totalRows);
  });

  it('should clamp start to 0', () => {
    // Even with overscan, should not go below 0
    const result = calculateVisibleRowRange(40, 400, 100, rowHeight, overscan);
    expect(result.startRow).toBe(0);
  });

  it('should handle 50K rows', () => {
    const totalRows = 50000;
    const scrollTop = 100000; // row 2500
    const result = calculateVisibleRowRange(scrollTop, 800, totalRows, rowHeight, overscan);

    expect(result.startRow).toBe(2495); // 2500 - 5
    expect(result.endRow).toBe(2525); // 2500 + 20 + 5
    expect(result.endRow - result.startRow).toBe(30); // reasonable DOM count
  });
});

describe('buildPrefixSums', () => {
  it('should build correct prefix sums', () => {
    const widths = [100, 150, 200];
    const sums = buildPrefixSums(widths);
    expect(sums).toEqual([0, 100, 250, 450]);
  });

  it('should handle empty array', () => {
    expect(buildPrefixSums([])).toEqual([0]);
  });

  it('should handle single column', () => {
    expect(buildPrefixSums([120])).toEqual([0, 120]);
  });
});

describe('findColumnAtOffset', () => {
  const prefixSums = [0, 100, 250, 450, 600]; // 4 columns

  it('should find first column at offset 0', () => {
    expect(findColumnAtOffset(prefixSums, 0)).toBe(0);
  });

  it('should find column containing offset', () => {
    expect(findColumnAtOffset(prefixSums, 50)).toBe(0);
    expect(findColumnAtOffset(prefixSums, 100)).toBe(1);
    expect(findColumnAtOffset(prefixSums, 200)).toBe(1);
    expect(findColumnAtOffset(prefixSums, 250)).toBe(2);
    expect(findColumnAtOffset(prefixSums, 449)).toBe(2);
    expect(findColumnAtOffset(prefixSums, 450)).toBe(3);
  });

  it('should clamp to last column for large offset', () => {
    expect(findColumnAtOffset(prefixSums, 9999)).toBe(3);
  });
});

describe('calculateVisibleColumnRange', () => {
  const widths = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100]; // 10 × 100px
  const overscan = 2;

  it('should return empty range for no columns', () => {
    const result = calculateVisibleColumnRange(0, 400, [], overscan);
    expect(result).toEqual({ startCol: 0, endCol: 0 });
  });

  it('should calculate range at left edge', () => {
    // Container 400px, each col 100px → cols 0-3 visible + boundary col 4 + 2 overscan
    const result = calculateVisibleColumnRange(0, 400, widths, overscan);
    expect(result.startCol).toBe(0);
    expect(result.endCol).toBe(7);
  });

  it('should include overscan left when scrolled', () => {
    // scrollLeft=300 → first visible col 3, last visible col 7, +1+2 overscan clamped to 10
    const result = calculateVisibleColumnRange(300, 400, widths, overscan);
    expect(result.startCol).toBe(1); // 3 - 2
    expect(result.endCol).toBe(10); // clamped to total columns
  });

  it('should clamp to total columns', () => {
    const result = calculateVisibleColumnRange(700, 400, widths, overscan);
    expect(result.endCol).toBe(10);
  });
});

describe('calculateViewportRange', () => {
  it('should combine row and column ranges', () => {
    const colWidths = [100, 100, 100, 100, 100];
    const range = calculateViewportRange(
      200,   // scrollTop
      100,   // scrollLeft
      300,   // containerWidth
      400,   // containerHeight
      1000,  // totalRows
      colWidths,
      40,    // rowHeight
      5,     // overscanRows
      2,     // overscanCols
    );

    expect(range.startRow).toBe(0); // row 5 - 5 = 0
    expect(range.endRow).toBe(20);  // row 5 + 10 + 5
    expect(range.startCol).toBe(0); // col 1 - 2 = 0
    expect(range.endCol).toBe(5);   // clamped
  });
});
