// =============================================================================
// Smart Grid — Basic Example
// 50K rows × 50 columns performance demo.
// =============================================================================

import { createGrid } from '@smart-grid/core';
import '@smart-grid/core/css/smart-grid.css';
import { mountPaginationFooter } from './footer';
import { generateColumns, generateRows } from './mock-data';
import { mountSmartSidePanel } from './sidepanel';
import { createBenchmarkTracker } from '../shared/benchmark';

const ROW_COUNT = 50_000;
const COL_COUNT = 50;

const INITIAL_SORT = [{ columnId: 'id', direction: 'asc' as const }];
const INITIAL_FILTER: [] = [];
const INITIAL_FILTER_MODE = 'client' as const;
const INITIAL_PAGINATION = { page: 0, pageSize: 500 };
const INITIAL_FREEZE = { leftCount: 0, rightCount: 0 };
const INITIAL_HEIGHT: number | 'auto' = 620;
const INITIAL_HEIGHT_MODE = 'fixed' as const;
const FOOTER_MODE = 'embedded' as const;

const container = document.getElementById('grid-container');
if (!container) throw new Error('Grid container not found');
const benchmark = createBenchmarkTracker();

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
  selectionColumn: {
    enabled: true,
    id: '__select',
    width: 132,
    header: 'Select',
  },
  config: {
    height: typeof INITIAL_HEIGHT === 'number' ? INITIAL_HEIGHT : 620,
    heightMode: INITIAL_HEIGHT_MODE,
    rowHeight: 40,
    headerHeight: 44,
    overscanRows: 10,
    overscanColumns: 5,
    rowIdField: 'id',
  },
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
benchmark.addSample('dataset:generate', t1 - t0);
benchmark.addSample('grid:init', t2 - t1);

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

const footerHost = document.getElementById('footer-host');
const unmountFooter = footerHost
  ? mountPaginationFooter({ target: footerHost, grid, mode: FOOTER_MODE })
  : () => {};

const benchSortBtn = document.getElementById('bench-sort') as HTMLButtonElement | null;
const benchFilterBtn = document.getElementById('bench-filter') as HTMLButtonElement | null;
const benchClearBtn = document.getElementById('bench-clear') as HTMLButtonElement | null;
const benchRunAllBtn = document.getElementById('bench-run-all') as HTMLButtonElement | null;
const benchFilterInput = document.getElementById('bench-filter-input') as HTMLInputElement | null;
const benchResultsBody = document.getElementById('bench-results-body') as HTMLTableSectionElement | null;

function renderBenchmarks(): void {
  if (!benchResultsBody) {
    return;
  }

  const summaries = benchmark.getSummaries();
  benchResultsBody.innerHTML = '';

  for (const summary of summaries) {
    const row = document.createElement('tr');
    row.innerHTML =
      `<td>${summary.label}</td>` +
      `<td>${summary.runs}</td>` +
      `<td>${summary.lastMs.toFixed(1)}</td>` +
      `<td>${summary.medianMs.toFixed(1)}</td>` +
      `<td>${summary.p95Ms.toFixed(1)}</td>`;
    benchResultsBody.appendChild(row);
  }
}

async function runSortBenchmark(): Promise<void> {
  await benchmark.measure('sort:salary-desc', async () => {
    grid.setSort([{ columnId: 'salary', direction: 'desc' }]);
  });
  renderBenchmarks();
}

async function runFilterBenchmark(): Promise<void> {
  const query = benchFilterInput?.value?.trim() || 'alice';
  await benchmark.measure(`filter:firstName:${query}`, async () => {
    grid.setFilter([{ columnId: 'firstName', operator: 'contains', value: query }]);
  });
  renderBenchmarks();
}

async function runClearFilterBenchmark(): Promise<void> {
  await benchmark.measure('filter:clear', async () => {
    grid.clearFilter();
  });
  renderBenchmarks();
}

benchSortBtn?.addEventListener('click', () => {
  void runSortBenchmark();
});
benchFilterBtn?.addEventListener('click', () => {
  void runFilterBenchmark();
});
benchClearBtn?.addEventListener('click', () => {
  void runClearFilterBenchmark();
});
benchRunAllBtn?.addEventListener('click', () => {
  void (async () => {
    await runSortBenchmark();
    await runFilterBenchmark();
    await runClearFilterBenchmark();
  })();
});

renderBenchmarks();

// Expose for debugging
(window as unknown as Record<string, unknown>)['smartGrid'] = grid;

// Best-effort cleanup for hot-reload / page unload
window.addEventListener('beforeunload', () => {
  unsubStats();
  unmountFooter();
});
