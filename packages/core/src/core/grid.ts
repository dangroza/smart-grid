// =============================================================================
// Smart Grid — Grid Orchestrator
// Composes Store, Pipeline, Scroller, and Renderer into a working grid.
// =============================================================================

import type {
  FilterCriterion,
  FilterMode,
  SortCriterion,
  ColumnDef,
  GridConfig,
  GridOptions,
  Row,
  SmartGridAPI,
  ViewportRange,
  VisibleSlice,
} from '../types';
import { createEventBus } from './event-bus';
import { createPipeline } from './pipeline';
import { createStore } from './store';
import { createVirtualScroller } from '../scroll/virtual-scroller';
import { createDOMRenderer } from '../render/dom-renderer';
import { clampColumnWidth, reorderVisibleColumns } from '../features/columns/column-operations';
import { buildFrozenRenderColumnIndexes, clampFreezeCounts } from '../features/freeze/freeze-utils';
import { createFilterFeature } from '../features/filter/filter-feature';
import { createPaginationFeature } from '../features/pagination/pagination-feature';
import { createSortFeature } from '../features/sort/sort-feature';

/**
 * Creates a Smart Grid instance.
 *
 * This is the main entry point — it wires together all layers:
 * Store → Pipeline → Virtual Scroller → DOM Renderer
 *
 * Data flows unidirectionally:
 * User Action → EventBus → Store Update → Pipeline → Scroller → Renderer → DOM
 */
export function createGrid(options: GridOptions): SmartGridAPI {
  const {
    container,
    columns,
    data = [],
    initialSort = [],
    initialFilter = [],
    initialFilterMode = 'client',
    initialPagination,
    initialFreeze,
    rowHeight = 40,
    headerHeight = 44,
    overscanRows = 10,
    overscanColumns = 5,
    rowIdField = 'id',
    features = [],
  } = options;

  const allFeatures = [createFilterFeature(), createSortFeature(), createPaginationFeature(), ...features];

  // --- Create layers ---

  const eventBus = createEventBus();

  const store = createStore({
    rowHeight,
    headerHeight,
    overscanRows,
    overscanColumns,
    rowIdField,
  });

  const pipeline = createPipeline();

  const scroller = createVirtualScroller({
    rowHeight,
    overscanRows,
    overscanColumns,
  });

  const renderer = createDOMRenderer();

  const initialPageSize =
    initialPagination && typeof initialPagination.pageSize === 'number'
      ? Math.max(0, Math.floor(initialPagination.pageSize))
      : 0;
  const initialMaxPage =
    initialPageSize > 0 ? Math.max(0, Math.ceil(data.length / initialPageSize) - 1) : 0;
  const initialPageRaw =
    initialPagination && typeof initialPagination.page === 'number'
      ? Math.max(0, Math.floor(initialPagination.page))
      : 0;
  const initialPage = initialPageSize > 0 ? Math.min(initialPageRaw, initialMaxPage) : 0;
  const initialFreezeLeft =
    initialFreeze && typeof initialFreeze.leftCount === 'number'
      ? Math.max(0, Math.floor(initialFreeze.leftCount))
      : 0;
  const initialFreezeRight =
    initialFreeze && typeof initialFreeze.rightCount === 'number'
      ? Math.max(0, Math.floor(initialFreeze.rightCount))
      : 0;
  const initialFreezeCounts = clampFreezeCounts(
    columns.filter((column) => column.visible !== false).length,
    initialFreezeLeft,
    initialFreezeRight,
  );

  // --- Initialize state ---

  store.batch(() => {
    store.update((prev) => ({
      ...prev,
      data,
      columns,
      processedData: data,
      sort: { criteria: [...initialSort] },
      filter: {
        criteria: [...initialFilter],
        mode: initialFilterMode,
      },
      pagination: {
        ...prev.pagination,
        totalRows: data.length,
        page: initialPage,
        pageSize: initialPageSize,
      },
      freeze: {
        leftCount: initialFreezeCounts.leftCount,
        rightCount: initialFreezeCounts.rightCount,
      },
    }));
  });

  // --- Mount renderer ---

  renderer.mount(container);

  // Set custom properties on container so the renderer can read them
  container.style.setProperty('--sg-row-height', `${rowHeight}px`);
  container.style.setProperty('--sg-header-height', `${headerHeight}px`);

  // --- Wire scroller to renderer ---

  const columnWidths = columns.filter((c) => c.visible !== false).map((c) => c.width);
  scroller.setDimensions(data.length, columnWidths);

  // Scroller drives rendering
  const unsubRange = scroller.onRangeChanged((range: ViewportRange) => {
    const state = store.getState();

    // Update viewport state in store
    store.update((prev) => ({
      ...prev,
      viewport: {
        ...prev.viewport,
        visibleRange: range,
      },
    }));

    // Build the visible slice for the renderer
    const slice = buildVisibleSlice(state.processedData, state.columns, range, state.freeze, scroller);
    eventBus.emit('render:before', undefined);
    renderer.render(slice);
    eventBus.emit('render:after', { visibleRange: range });
  });

  // --- Wire store changes to pipeline + scroller ---

  const unsubStore = store.subscribe((state) => {
    // Run data through pipeline
    const processed = pipeline.process(state.data, state);

    // Update processedData if it changed
    if (processed !== state.processedData) {
      store.update((prev) => ({ ...prev, processedData: processed }));
      return; // The recursive update will trigger another subscribe call
    }

    // Update scroller dimensions
    const visibleColumns = state.columns.filter((c) => c.visible !== false);
    const widths = visibleColumns.map((c) => c.width);
    scroller.setDimensions(processed.length, widths);

    // Emit state change
    eventBus.emit('state:changed', { state });
  });

  // --- Attach scroller to the scroll container ---
  // The scroll container is created by the renderer inside the mount target
  const scrollEl = container.querySelector('.sg-grid__scroll-container') as HTMLElement;
  if (scrollEl) {
    scroller.attach(scrollEl);
  }

  // --- Install feature modules ---

  const context = { store, eventBus, pipeline, renderer, scroller };
  for (const feature of allFeatures) {
    feature.install(context);
  }

  // --- Header interactions (resize + reorder) ---

  const headerEl = container.querySelector('.sg-grid__header') as HTMLElement | null;

  let reorderState:
    | {
        originCell: HTMLElement;
        fromVisibleIndex: number;
        targetVisibleIndex: number | null;
        startX: number;
        startY: number;
        active: boolean;
      }
    | null = null;

  let resizeState: { columnId: string; startX: number; startWidth: number } | null = null;

  function resizeColumnInternal(columnId: string, requestedWidth: number, emitEvent: boolean): void {
    const targetColumn = store.getState().columns.find((column) => column.id === columnId);
    if (!targetColumn) {
      return;
    }

    const nextWidth = clampColumnWidth(targetColumn, requestedWidth);
    if (nextWidth === targetColumn.width) {
      return;
    }

    store.update((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? ({ ...column, width: nextWidth } as ColumnDef) : column,
      ),
    }));

    if (emitEvent) {
      eventBus.emit('column:resized', { columnId, width: nextWidth });
    }
  }

  function reorderColumnInternal(
    fromVisibleIndex: number,
    toVisibleIndex: number,
    emitEvent: boolean,
  ): void {
    const prevColumns = store.getState().columns;
    const visibleColumns = prevColumns.filter((column) => column.visible !== false);
    if (visibleColumns.length <= 1) {
      return;
    }

    const safeFrom = Math.max(0, Math.min(fromVisibleIndex, visibleColumns.length - 1));
    const safeTo = Math.max(0, Math.min(toVisibleIndex, visibleColumns.length - 1));
    if (safeFrom === safeTo) {
      return;
    }

    const movedColumn = visibleColumns[safeFrom];
    if (!movedColumn) {
      return;
    }

    const nextColumns = reorderVisibleColumns(prevColumns, safeFrom, safeTo);
    if (nextColumns === prevColumns) {
      return;
    }

    store.update((prev) => ({ ...prev, columns: nextColumns }));

    if (emitEvent) {
      eventBus.emit('column:reordered', {
        columnId: movedColumn.id,
        fromIndex: safeFrom,
        toIndex: safeTo,
      });
    }
  }

  function onResizeMouseMove(event: MouseEvent): void {
    if (!resizeState) {
      return;
    }

    const deltaX = event.clientX - resizeState.startX;
    resizeColumnInternal(resizeState.columnId, resizeState.startWidth + deltaX, false);
  }

  function onResizeMouseUp(): void {
    if (!resizeState) {
      return;
    }

    const { columnId } = resizeState;
    const finalColumn = store.getState().columns.find((column) => column.id === columnId);
    if (finalColumn) {
      eventBus.emit('column:resized', { columnId, width: finalColumn.width });
    }

    resizeState = null;
    window.removeEventListener('mousemove', onResizeMouseMove);
    window.removeEventListener('mouseup', onResizeMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  function onHeaderMouseDown(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const resizeHandle = target.closest('.sg-grid__header-resize-handle') as HTMLElement | null;
    if (resizeHandle) {
      const cell = resizeHandle.closest('.sg-grid__header-cell') as HTMLElement | null;
      const columnId = cell?.getAttribute('data-column-id');
      if (!columnId) {
        return;
      }

      const column = store.getState().columns.find((candidate) => candidate.id === columnId);
      if (!column || column.resizable === false) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      resizeState = {
        columnId,
        startX: event.clientX,
        startWidth: column.width,
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onResizeMouseMove);
      window.addEventListener('mouseup', onResizeMouseUp);
      return;
    }

    const cell = target.closest('.sg-grid__header-cell') as HTMLElement | null;
    if (!cell) {
      return;
    }

    const indexRaw = cell.getAttribute('data-visible-col-index');
    const index = indexRaw ? Number.parseInt(indexRaw, 10) : Number.NaN;
    if (!Number.isFinite(index)) {
      return;
    }

    reorderState = {
      originCell: cell,
      fromVisibleIndex: index,
      targetVisibleIndex: null,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };

    window.addEventListener('mousemove', onReorderMouseMove);
    window.addEventListener('mouseup', onReorderMouseUp);
  }

  function clearHeaderDragClasses(): void {
    const siblings = headerEl?.querySelectorAll('.sg-grid__header-cell') ?? [];
    siblings.forEach((node) =>
      (node as HTMLElement).classList.remove('sg-grid__header-cell--drag-over', 'sg-grid__header-cell--dragging'),
    );
  }

  function onReorderMouseMove(event: MouseEvent): void {
    if (!reorderState) {
      return;
    }

    const dx = Math.abs(event.clientX - reorderState.startX);
    const dy = Math.abs(event.clientY - reorderState.startY);

    // Small threshold to avoid accidental drags from clicks.
    if (!reorderState.active && dx + dy < 6) {
      return;
    }

    if (!reorderState.active) {
      reorderState.active = true;
      reorderState.originCell.classList.add('sg-grid__header-cell--dragging');
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    const underPointer = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const targetCell = underPointer?.closest('.sg-grid__header-cell') as HTMLElement | null;
    if (!targetCell || targetCell === reorderState.originCell || !headerEl?.contains(targetCell)) {
      return;
    }

    clearHeaderDragClasses();
    reorderState.originCell.classList.add('sg-grid__header-cell--dragging');
    targetCell.classList.add('sg-grid__header-cell--drag-over');

    const toRaw = targetCell.getAttribute('data-visible-col-index');
    const toVisibleIndex = toRaw ? Number.parseInt(toRaw, 10) : Number.NaN;
    reorderState.targetVisibleIndex = Number.isFinite(toVisibleIndex) ? toVisibleIndex : null;
  }

  function onReorderMouseUp(): void {
    if (!reorderState) {
      window.removeEventListener('mousemove', onReorderMouseMove);
      window.removeEventListener('mouseup', onReorderMouseUp);
      return;
    }

    const targetVisibleIndex = reorderState.targetVisibleIndex;
    const shouldReorder = reorderState.active && targetVisibleIndex !== null;
    if (shouldReorder) {
      reorderColumnInternal(reorderState.fromVisibleIndex, targetVisibleIndex, true);
    }

    reorderState = null;
    clearHeaderDragClasses();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    window.removeEventListener('mousemove', onReorderMouseMove);
    window.removeEventListener('mouseup', onReorderMouseUp);
  }

  function onHeaderKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const cell = target?.closest('.sg-grid__header-cell') as HTMLElement | null;
    if (!cell) {
      return;
    }

    const columnId = cell.getAttribute('data-column-id');
    const indexRaw = cell.getAttribute('data-visible-col-index');
    const visibleIndex = indexRaw ? Number.parseInt(indexRaw, 10) : Number.NaN;

    if (!columnId || !Number.isFinite(visibleIndex)) {
      return;
    }

    // Reorder: Alt + Shift + ArrowLeft/ArrowRight
    if (event.altKey && event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      reorderColumnInternal(visibleIndex, visibleIndex + direction, true);
      return;
    }

    // Resize: Alt + ArrowLeft/ArrowRight
    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();

      const column = store.getState().columns.find((candidate) => candidate.id === columnId);
      if (!column || column.resizable === false) {
        return;
      }

      const step = event.shiftKey ? 20 : 10;
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      resizeColumnInternal(columnId, column.width + direction * step, true);
    }
  }

  if (headerEl) {
    headerEl.addEventListener('mousedown', onHeaderMouseDown);
    headerEl.addEventListener('keydown', onHeaderKeyDown);
  }

  // --- Trigger initial render ---

  const initialRange = scroller.getVisibleRange();
  const initialSlice = buildVisibleSlice(
    store.getState().processedData,
    store.getState().columns,
    initialRange,
    store.getState().freeze,
    scroller,
  );
  renderer.render(initialSlice);

  // --- Public API ---

  function setData(newData: ReadonlyArray<Row>): void {
    store.batch(() => {
      store.update((prev) => ({
        ...prev,
        pagination: {
          ...prev.pagination,
          totalRows: newData.length,
          page:
            prev.pagination.pageSize > 0
              ? Math.min(
                  prev.pagination.page,
                  Math.max(0, Math.ceil(newData.length / prev.pagination.pageSize) - 1),
                )
              : 0,
        },
      }));
      store.update((prev) => ({
        ...prev,
        data: newData,
      }));
    });
    eventBus.emit('data:set', { data: newData });
  }

  function setColumns(newColumns: ReadonlyArray<ColumnDef>): void {
    store.update((prev) => {
      const visibleCount = newColumns.filter((column) => column.visible !== false).length;
      const freeze = clampFreezeCounts(visibleCount, prev.freeze.leftCount, prev.freeze.rightCount);
      return {
        ...prev,
        columns: newColumns,
        freeze,
      };
    });
    eventBus.emit('columns:set', { columns: newColumns });
  }

  function setConfig(patch: Partial<GridConfig>): void {
    const prevConfig = store.getState().config;
    const nextConfig: GridConfig = {
      ...prevConfig,
      ...patch,
      rowHeight:
        typeof patch.rowHeight === 'number' && Number.isFinite(patch.rowHeight) && patch.rowHeight > 0
          ? patch.rowHeight
          : prevConfig.rowHeight,
      headerHeight:
        typeof patch.headerHeight === 'number' &&
        Number.isFinite(patch.headerHeight) &&
        patch.headerHeight > 0
          ? patch.headerHeight
          : prevConfig.headerHeight,
      overscanRows:
        typeof patch.overscanRows === 'number' &&
        Number.isFinite(patch.overscanRows) &&
        patch.overscanRows >= 0
          ? Math.floor(patch.overscanRows)
          : prevConfig.overscanRows,
      overscanColumns:
        typeof patch.overscanColumns === 'number' &&
        Number.isFinite(patch.overscanColumns) &&
        patch.overscanColumns >= 0
          ? Math.floor(patch.overscanColumns)
          : prevConfig.overscanColumns,
      rowIdField: typeof patch.rowIdField === 'string' ? patch.rowIdField : prevConfig.rowIdField,
    };

    // No-op if nothing changed
    if (
      nextConfig.rowHeight === prevConfig.rowHeight &&
      nextConfig.headerHeight === prevConfig.headerHeight &&
      nextConfig.overscanRows === prevConfig.overscanRows &&
      nextConfig.overscanColumns === prevConfig.overscanColumns &&
      nextConfig.rowIdField === prevConfig.rowIdField
    ) {
      return;
    }

    store.update((prev) => ({ ...prev, config: nextConfig }));
    eventBus.emit('config:changed', { config: nextConfig });

    // Keep renderer styling in sync
    container.style.setProperty('--sg-row-height', `${nextConfig.rowHeight}px`);
    container.style.setProperty('--sg-header-height', `${nextConfig.headerHeight}px`);

    // Keep scroller calculations in sync
    scroller.setConfig({
      rowHeight: nextConfig.rowHeight,
      overscanRows: nextConfig.overscanRows,
      overscanColumns: nextConfig.overscanColumns,
    });
  }

  function setSort(criteria: ReadonlyArray<SortCriterion>): void {
    const nextCriteria = [...criteria];
    store.update((prev) => ({
      ...prev,
      sort: { criteria: nextCriteria },
    }));
    eventBus.emit('sort:changed', { criteria: nextCriteria });
  }

  function clearSort(): void {
    setSort([]);
  }

  function setFilter(criteria: ReadonlyArray<FilterCriterion>, mode?: FilterMode): void {
    const nextCriteria = [...criteria];

    store.update((prev) => ({
      ...prev,
      filter: {
        criteria: nextCriteria,
        mode: mode ?? prev.filter.mode,
      },
    }));

    eventBus.emit('filter:changed', { criteria: nextCriteria });
  }

  function clearFilter(): void {
    setFilter([]);
  }

  function setPagination(page: number, pageSize?: number): void {
    const current = store.getState().pagination;
    const nextPage = Number.isFinite(page) ? Math.max(0, Math.floor(page)) : current.page;
    const nextPageSize =
      pageSize === undefined
        ? current.pageSize
        : Number.isFinite(pageSize)
          ? Math.max(0, Math.floor(pageSize))
          : current.pageSize;
    const clampedPage =
      nextPageSize <= 0
        ? 0
        : Math.min(nextPage, Math.max(0, Math.ceil(current.totalRows / nextPageSize) - 1));

    store.update((prev) => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        page: clampedPage,
        pageSize: nextPageSize,
      },
    }));

    eventBus.emit('pagination:changed', {
      page: clampedPage,
      pageSize: nextPageSize,
    });
  }

  function clearPagination(): void {
    setPagination(0, 0);
  }

  function setFrozenColumns(leftCount: number, rightCount: number): void {
    const visibleCount = store.getState().columns.filter((column) => column.visible !== false).length;
    const clamped = clampFreezeCounts(visibleCount, leftCount, rightCount);

    store.update((prev) => ({
      ...prev,
      freeze: {
        leftCount: clamped.leftCount,
        rightCount: clamped.rightCount,
      },
    }));

    eventBus.emit('freeze:changed', {
      leftCount: clamped.leftCount,
      rightCount: clamped.rightCount,
    });
  }

  function freezeLeftTo(columnId: string): void {
    const visibleColumns = store.getState().columns.filter((column) => column.visible !== false);
    const index = visibleColumns.findIndex((column) => column.id === columnId);
    if (index < 0) return;
    setFrozenColumns(index + 1, store.getState().freeze.rightCount);
  }

  function freezeRightFrom(columnId: string): void {
    const visibleColumns = store.getState().columns.filter((column) => column.visible !== false);
    const index = visibleColumns.findIndex((column) => column.id === columnId);
    if (index < 0) return;
    setFrozenColumns(store.getState().freeze.leftCount, visibleColumns.length - index);
  }

  function clearFreeze(): void {
    setFrozenColumns(0, 0);
  }

  function resizeColumn(columnId: string, width: number): void {
    resizeColumnInternal(columnId, width, true);
  }

  function reorderColumn(columnId: string, toVisibleIndex: number): void {
    const visibleColumns = store.getState().columns.filter((column) => column.visible !== false);
    const fromVisibleIndex = visibleColumns.findIndex((column) => column.id === columnId);
    if (fromVisibleIndex < 0) {
      return;
    }

    reorderColumnInternal(fromVisibleIndex, toVisibleIndex, true);
  }

  function scrollTo(row: number, col?: number): void {
    scroller.scrollTo(row, col);
  }

  function destroy(): void {
    if (headerEl) {
      headerEl.removeEventListener('mousedown', onHeaderMouseDown);
      headerEl.removeEventListener('keydown', onHeaderKeyDown);
    }
    onResizeMouseUp();
    onReorderMouseUp();

    // Clean up features
    for (const feature of allFeatures) {
      feature.destroy();
    }

    // Disconnect layers
    unsubRange();
    unsubStore();
    scroller.destroy();
    renderer.destroy();
    eventBus.destroy();
    store.destroy();
  }

  return {
    setData,
    setColumns,
    setConfig,
    setSort,
    clearSort,
    setFilter,
    clearFilter,
    setPagination,
    clearPagination,
    setFrozenColumns,
    freezeLeftTo,
    freezeRightFrom,
    clearFreeze,
    resizeColumn,
    reorderColumn,
    getState: store.getState,
    getStore: () => store,
    getEventBus: () => eventBus,
    scrollTo,
    destroy,
  };
}

// --- Helper ---

function buildVisibleSlice(
  processedData: ReadonlyArray<Row>,
  allColumns: ReadonlyArray<ColumnDef>,
  range: ViewportRange,
  freeze: { leftCount: number; rightCount: number },
  scroller: { getRowOffset: (i: number) => number; getColumnOffset: (i: number) => number },
): VisibleSlice {
  const visibleColumns = allColumns.filter((c) => c.visible !== false);
  const allColumnWidths = visibleColumns.map((column) => column.width);
  const clampedFreeze = clampFreezeCounts(visibleColumns.length, freeze.leftCount, freeze.rightCount);

  const columnIndexes = buildFrozenRenderColumnIndexes(
    visibleColumns.length,
    range.startCol,
    range.endCol,
    clampedFreeze.leftCount,
    clampedFreeze.rightCount,
  );

  const rows = processedData.slice(range.startRow, range.endRow);
  const columns = columnIndexes.map((index) => visibleColumns[index]!).filter(Boolean);

  return {
    rows,
    columns,
    columnIndexes,
    allColumnWidths,
    leftFrozenCount: clampedFreeze.leftCount,
    rightFrozenCount: clampedFreeze.rightCount,
    range,
    totalRows: processedData.length,
    rowOffset: scroller.getRowOffset(range.startRow),
    columnOffset: scroller.getColumnOffset(range.startCol),
  };
}
