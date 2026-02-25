// =============================================================================
// Smart Grid — Scroll Utilities
// Pure functions for viewport range calculations.
// =============================================================================

import type { ViewportRange } from '../types';

/**
 * Calculates which rows are visible given scroll position and container height.
 * Fixed row height — O(1) calculation.
 */
export function calculateVisibleRowRange(
  scrollTop: number,
  containerHeight: number,
  totalRows: number,
  rowHeight: number,
  overscan: number,
): { startRow: number; endRow: number } {
  if (totalRows === 0 || containerHeight === 0) {
    return { startRow: 0, endRow: 0 };
  }

  const firstVisible = Math.floor(scrollTop / rowHeight);
  const visibleCount = Math.ceil(containerHeight / rowHeight);

  const startRow = Math.max(0, firstVisible - overscan);
  const endRow = Math.min(totalRows, firstVisible + visibleCount + overscan);

  return { startRow, endRow };
}

/**
 * Calculates which columns are visible given scroll position and column widths.
 * Variable column widths — uses prefix sum for O(log n) lookup.
 */
export function calculateVisibleColumnRange(
  scrollLeft: number,
  containerWidth: number,
  columnWidths: ReadonlyArray<number>,
  overscan: number,
): { startCol: number; endCol: number } {
  const totalCols = columnWidths.length;
  if (totalCols === 0 || containerWidth === 0) {
    return { startCol: 0, endCol: 0 };
  }

  // Build prefix sums: prefixSums[i] = sum of widths[0..i-1]
  const prefixSums = buildPrefixSums(columnWidths);

  // Binary search for first visible column
  const firstVisible = findColumnAtOffset(prefixSums, scrollLeft);
  const lastVisible = findColumnAtOffset(prefixSums, scrollLeft + containerWidth);

  const startCol = Math.max(0, firstVisible - overscan);
  const endCol = Math.min(totalCols, lastVisible + 1 + overscan);

  return { startCol, endCol };
}

/**
 * Builds prefix sums from column widths.
 * prefixSums[i] = total width of columns 0..i-1
 * prefixSums[0] = 0, prefixSums[n] = total width
 */
export function buildPrefixSums(widths: ReadonlyArray<number>): ReadonlyArray<number> {
  const sums: number[] = new Array(widths.length + 1);
  sums[0] = 0;
  for (let i = 0; i < widths.length; i++) {
    sums[i + 1] = sums[i]! + widths[i]!;
  }
  return sums;
}

/**
 * Binary search to find which column contains the given horizontal offset.
 */
export function findColumnAtOffset(
  prefixSums: ReadonlyArray<number>,
  offset: number,
): number {
  let lo = 0;
  let hi = prefixSums.length - 2; // last column index

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const colStart = prefixSums[mid]!;
    const colEnd = prefixSums[mid + 1]!;

    if (offset < colStart) {
      hi = mid - 1;
    } else if (offset >= colEnd) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }

  return Math.max(0, Math.min(lo, prefixSums.length - 2));
}

/**
 * Combines row and column ranges into a full ViewportRange.
 */
export function calculateViewportRange(
  scrollTop: number,
  scrollLeft: number,
  containerWidth: number,
  containerHeight: number,
  totalRows: number,
  columnWidths: ReadonlyArray<number>,
  rowHeight: number,
  overscanRows: number,
  overscanCols: number,
): ViewportRange {
  const { startRow, endRow } = calculateVisibleRowRange(
    scrollTop, containerHeight, totalRows, rowHeight, overscanRows,
  );
  const { startCol, endCol } = calculateVisibleColumnRange(
    scrollLeft, containerWidth, columnWidths, overscanCols,
  );
  return { startRow, endRow, startCol, endCol };
}
