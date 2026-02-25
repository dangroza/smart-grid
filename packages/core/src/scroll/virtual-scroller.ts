// =============================================================================
// Smart Grid — Virtual Scroller
// Manages scroll position, calculates visible ranges, uses rAF for performance.
// =============================================================================

import type { Unsubscribe, ViewportRange, VirtualScroller } from '../types';
import {
  buildPrefixSums,
  calculateViewportRange,
} from './scroll-utils';

export interface VirtualScrollerOptions {
  readonly rowHeight: number;
  readonly overscanRows: number;
  readonly overscanColumns: number;
}

/**
 * Creates a virtual scroller that calculates visible row/column ranges.
 *
 * Attaches to a scrollable container, listens for scroll events via
 * passive listeners, and batches range calculations into rAF.
 */
export function createVirtualScroller(options: VirtualScrollerOptions): VirtualScroller {
  let rowHeight = options.rowHeight;
  let overscanRows = options.overscanRows;
  let overscanColumns = options.overscanColumns;

  let container: HTMLElement | null = null;
  let totalRows = 0;
  let columnWidths: ReadonlyArray<number> = [];
  let prefixSums: ReadonlyArray<number> = [0];

  let scrollTop = 0;
  let scrollLeft = 0;
  let containerWidth = 0;
  let containerHeight = 0;

  let currentRange: ViewportRange = { startRow: 0, endRow: 0, startCol: 0, endCol: 0 };
  let rafId: number | null = null;

  const rangeCallbacks = new Set<(range: ViewportRange) => void>();

  // --- Scroll handler (passive, batched via rAF) ---

  function onScroll(): void {
    if (!container) return;

    scrollTop = container.scrollTop;
    scrollLeft = container.scrollLeft;

    scheduleRangeUpdate();
  }

  function scheduleRangeUpdate(): void {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(updateRange);
  }

  function updateRange(): void {
    rafId = null;

    const nextRange = calculateViewportRange(
      scrollTop,
      scrollLeft,
      containerWidth,
      containerHeight,
      totalRows,
      columnWidths,
      rowHeight,
      overscanRows,
      overscanColumns,
    );

    // Only notify if range actually changed
    if (
      nextRange.startRow !== currentRange.startRow ||
      nextRange.endRow !== currentRange.endRow ||
      nextRange.startCol !== currentRange.startCol ||
      nextRange.endCol !== currentRange.endCol
    ) {
      currentRange = nextRange;
      for (const cb of rangeCallbacks) {
        cb(currentRange);
      }
    }
  }

  // --- Resize observer ---

  let resizeObserver: ResizeObserver | null = null;

  function onContainerResize(entries: ResizeObserverEntry[]): void {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      containerWidth = width;
      containerHeight = height;
    }
    scheduleRangeUpdate();
  }

  // --- Public API ---

  function attach(el: HTMLElement): void {
    container = el;
    containerWidth = el.clientWidth;
    containerHeight = el.clientHeight;
    scrollTop = el.scrollTop;
    scrollLeft = el.scrollLeft;

    el.addEventListener('scroll', onScroll, { passive: true });

    resizeObserver = new ResizeObserver(onContainerResize);
    resizeObserver.observe(el);

    scheduleRangeUpdate();
  }

  function detach(): void {
    if (container) {
      container.removeEventListener('scroll', onScroll);
      container = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function getVisibleRange(): ViewportRange {
    return currentRange;
  }

  function scrollTo(row: number, col?: number): void {
    if (!container) return;

    const top = row * rowHeight;
    container.scrollTop = top;

    if (col !== undefined && col < prefixSums.length - 1) {
      container.scrollLeft = prefixSums[col]!;
    }
  }

  function setDimensions(rows: number, colWidths: ReadonlyArray<number>): void {
    totalRows = rows;
    columnWidths = colWidths;
    prefixSums = buildPrefixSums(colWidths);
    scheduleRangeUpdate();
  }

  function setConfig(config: Partial<VirtualScrollerOptions>): void {
    if (typeof config.rowHeight === 'number' && Number.isFinite(config.rowHeight) && config.rowHeight > 0) {
      rowHeight = config.rowHeight;
    }
    if (
      typeof config.overscanRows === 'number' &&
      Number.isFinite(config.overscanRows) &&
      config.overscanRows >= 0
    ) {
      overscanRows = config.overscanRows;
    }
    if (
      typeof config.overscanColumns === 'number' &&
      Number.isFinite(config.overscanColumns) &&
      config.overscanColumns >= 0
    ) {
      overscanColumns = config.overscanColumns;
    }

    scheduleRangeUpdate();
  }

  function onRangeChanged(callback: (range: ViewportRange) => void): Unsubscribe {
    rangeCallbacks.add(callback);
    return () => {
      rangeCallbacks.delete(callback);
    };
  }

  function getTotalHeight(): number {
    return totalRows * rowHeight;
  }

  function getTotalWidth(): number {
    return prefixSums[prefixSums.length - 1] ?? 0;
  }

  function getRowOffset(rowIndex: number): number {
    return rowIndex * rowHeight;
  }

  function getColumnOffset(colIndex: number): number {
    return prefixSums[colIndex] ?? 0;
  }

  function destroy(): void {
    detach();
    rangeCallbacks.clear();
  }

  return {
    attach,
    detach,
    getVisibleRange,
    scrollTo,
    setDimensions,
    setConfig,
    onRangeChanged,
    getTotalHeight,
    getTotalWidth,
    getRowOffset,
    getColumnOffset,
    destroy,
  };
}
