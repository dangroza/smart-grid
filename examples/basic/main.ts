// =============================================================================
// Smart Grid — Basic Example
// 50K rows × 50 columns performance demo.
// =============================================================================

import { createGrid } from '@smart-grid/core';
import '@smart-grid/core/css/smart-grid.css';
import { generateColumns, generateRows } from './mock-data';
import { mountSmartSidePanel } from './sidepanel';

const ROW_COUNT = 50_000;
const COL_COUNT = 50;

const INITIAL_SORT = [{ columnId: 'id', direction: 'asc' as const }];
const INITIAL_FILTER: [] = [];
const INITIAL_FILTER_MODE = 'client' as const;
const INITIAL_PAGINATION = { page: 0, pageSize: 0 };
const INITIAL_FREEZE = { leftCount: 0, rightCount: 0 };

const container = document.getElementById('grid-container');
if (!container) throw new Error('Grid container not found');

// Measure data generation
const t0 = performance.now();
const columns = generateColumns(COL_COUNT);
const rows = generateRows(ROW_COUNT, COL_COUNT);
const t1 = performance.now();

// Measure grid creation
const grid = createGrid({
  container,
  columns,
  data: rows,
  initialSort: INITIAL_SORT,
  initialFilter: INITIAL_FILTER,
  initialFilterMode: INITIAL_FILTER_MODE,
  initialPagination: INITIAL_PAGINATION,
  initialFreeze: INITIAL_FREEZE,
  rowHeight: 40,
  headerHeight: 44,
  overscanRows: 10,
  overscanColumns: 5,
  rowIdField: 'id',
});
const t2 = performance.now();

// Show stats
const statsEl = document.getElementById('stats');
function setStats(text: string): void {
  if (statsEl) statsEl.textContent = text;
}

setStats(
  `${ROW_COUNT.toLocaleString()} rows × ${COL_COUNT} columns | ` +
    `Data: ${(t1 - t0).toFixed(1)}ms | Grid: ${(t2 - t1).toFixed(1)}ms`,
);

// Keep stats synced with current state (after dynamic changes)
const unsubStats = grid.getStore().subscribe((state) => {
  const visibleCols = state.columns.filter((c) => c.visible !== false).length;
  setStats(
    `${state.data.length.toLocaleString()} rows × ` +
      `${visibleCols.toLocaleString()}/${state.columns.length.toLocaleString()} columns | ` +
      `Initial Data: ${(t1 - t0).toFixed(1)}ms | Initial Grid: ${(t2 - t1).toFixed(1)}ms`,
  );
});

// Mount smart sidepanel
const sidepanel = document.getElementById('sidepanel');
if (sidepanel) {
  mountSmartSidePanel({
    target: sidepanel,
    grid,
    generateRows,
    generateColumns,
    initialRowCount: ROW_COUNT,
    initialColumnCount: COL_COUNT,
  });
}

// Expose for debugging
(window as unknown as Record<string, unknown>)['smartGrid'] = grid;

// Best-effort cleanup for hot-reload / page unload
window.addEventListener('beforeunload', () => {
  unsubStats();
});
