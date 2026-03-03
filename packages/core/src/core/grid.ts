// =============================================================================
// Smart Grid — Grid Orchestrator
// Composes Store, Pipeline, Scroller, and Renderer into a working grid.
// =============================================================================

import type {
  FilterCriterion,
  FilterMode,
  RowId,
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
import { resolveVisibleColumnsForWidth } from '../features/columns/column-widths';
import { buildFrozenRenderColumnIndexes, clampFreezeCounts } from '../features/freeze/freeze-utils';
import { createFilterFeature } from '../features/filter/filter-feature';
import { createGroupingFeature } from '../features/grouping/grouping-feature';
import { createPaginationFeature } from '../features/pagination/pagination-feature';
import {
  collectSelectableRowIds,
  computeAllSelected,
  getRowId,
  normalizeSelection,
} from '../features/selection/selection-utils';
import { createSortFeature } from '../features/sort/sort-feature';
import { createTotalsFeature } from '../features/totals/totals-feature';

const DEFAULT_SELECTION_COLUMN_ID = '__sg_selection';

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
    config: configOption,
    initialSort = [],
    initialFilter = [],
    initialFilterMode = 'client',
    initialPagination,
    initialFreeze,
    initialGrouping = [],
    height,
    rowHeight: rowHeightOption = 40,
    headerHeight: headerHeightOption = 44,
    overscanRows: overscanRowsOption = 10,
    overscanColumns: overscanColumnsOption = 5,
    rowIdField: rowIdFieldOption = 'id',
    selectionColumn,
    initialTotals,
    features = [],
  } = options;

  const rowHeight = configOption?.rowHeight ?? rowHeightOption;
  const headerHeight = configOption?.headerHeight ?? headerHeightOption;
  const overscanRows = configOption?.overscanRows ?? overscanRowsOption;
  const overscanColumns = configOption?.overscanColumns ?? overscanColumnsOption;
  const rowIdField = configOption?.rowIdField ?? rowIdFieldOption;
  const selectionColumnEnabled = selectionColumn?.enabled === true;
  const selectionColumnId = selectionColumn?.id ?? DEFAULT_SELECTION_COLUMN_ID;
  const selectionColumnHeader = selectionColumn?.header ?? '';
  const selectionColumnWidth =
    typeof selectionColumn?.width === 'number' && Number.isFinite(selectionColumn.width)
      ? Math.max(56, Math.floor(selectionColumn.width))
      : 120;
  const heightModeOption = configOption?.heightMode ?? (height === 'auto' ? 'auto' : 'fixed');
  const heightValueOption =
    typeof configOption?.height === 'number'
      ? configOption.height
      : typeof height === 'number'
        ? height
        : undefined;

  const allFeatures = [
    createFilterFeature(),
    createSortFeature(),
    createGroupingFeature(),
    createPaginationFeature(),
    createTotalsFeature(),
    ...features,
  ];

  // --- Create layers ---

  const eventBus = createEventBus();

  const initialHeightMode = heightModeOption;
  const initialFixedHeight =
    typeof heightValueOption === 'number'
      ? Math.max(80, Math.floor(heightValueOption))
      : Math.max(80, container.clientHeight || 600);

  const store = createStore({
    rowHeight,
    headerHeight,
    heightMode: initialHeightMode,
    height: initialFixedHeight,
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
  let scrollEl: HTMLElement | null = null;
  let pageSelectableRowIds: ReadonlySet<RowId> = new Set();
  let allSelectableRowIds: ReadonlySet<RowId> = new Set();

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
  const initialGroupingColumnIds = normalizeGroupingColumnIds(initialGrouping, columns);

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
      grouping: {
        columnIds: initialGroupingColumnIds,
        collapsedKeys: new Set(),
      },
      totals: {
        mode: initialTotals?.mode ?? 'off',
        label: initialTotals?.label ?? 'Totals',
      },
    }));
  });

  // --- Mount renderer ---

  renderer.mount(container);

  function getAvailableGridWidth(): number {
    return scrollEl?.clientWidth ?? container.clientWidth;
  }

  function getRenderColumns(columnsInput: ReadonlyArray<ColumnDef>): ReadonlyArray<ColumnDef> {
    const visibleColumns = columnsInput.filter((column) => column.visible !== false);
    if (!selectionColumnEnabled) {
      return visibleColumns;
    }

    if (visibleColumns.some((column) => column.id === selectionColumnId)) {
      return visibleColumns;
    }

    const selectionDef: ColumnDef = {
      id: selectionColumnId,
      field: selectionColumnId,
      header: selectionColumnHeader,
      width: selectionColumnWidth,
      fixedWidth: true,
      resizable: false,
      sortable: false,
      filterable: false,
      groupable: false,
      visible: true,
    };

    return [selectionDef, ...visibleColumns];
  }

  function applyContainerHeight(config: GridConfig, totalRows: number): void {
    const mode = config.heightMode ?? 'fixed';
    const fixedHeight = (config.height ?? container.clientHeight) || 600;

    if (mode === 'auto') {
      const autoHeight = config.headerHeight + totalRows * config.rowHeight;
      container.style.height = `${Math.max(config.headerHeight, autoHeight)}px`;
      return;
    }

    container.style.height = `${Math.max(80, fixedHeight)}px`;
  }

  applyContainerHeight(store.getState().config, store.getState().processedData.length);

  // Set custom properties on container so the renderer can read them
  container.style.setProperty('--sg-row-height', `${rowHeight}px`);
  container.style.setProperty('--sg-header-height', `${headerHeight}px`);

  // --- Wire scroller to renderer ---

  const columnWidths = resolveVisibleColumnsForWidth(
    getRenderColumns(columns),
    getAvailableGridWidth(),
  ).map((c) => c.width);
  scroller.setDimensions(data.length, columnWidths);
  allSelectableRowIds = collectSelectableRowIds(store.getState().data, rowIdField);
  pageSelectableRowIds = collectSelectableRowIds(store.getState().processedData, rowIdField);

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
    const slice = buildVisibleSlice(
      state.processedData,
      state.columns,
      state.selection,
      state.config.rowIdField,
      pageSelectableRowIds,
      allSelectableRowIds,
      selectionColumnEnabled ? selectionColumnId : null,
      range,
      state.freeze,
      getAvailableGridWidth(),
      getRenderColumns,
      scroller,
    );
    eventBus.emit('render:before', undefined);
    renderer.render(slice);
    eventBus.emit('render:after', { visibleRange: range });
  });

  // --- Wire store changes to pipeline + scroller ---

  const unsubStore = store.subscribe((state) => {
    // Derive total rows from pipeline without pagination.
    const unpaginatedState =
      state.pagination.pageSize > 0
        ? {
            ...state,
            pagination: {
              ...state.pagination,
              page: 0,
              pageSize: 0,
            },
          }
        : state;
    const unpaginated = pipeline.process(state.data, unpaginatedState);
    const derivedTotalRows = unpaginated.length;
    allSelectableRowIds = collectSelectableRowIds(unpaginated, state.config.rowIdField);

    const normalizedSelectionCandidate = normalizeSelection(
      [...state.selection.selectedIds],
      allSelectableRowIds,
    );
    const selectionChanged = !sameSetValues(normalizedSelectionCandidate, state.selection.selectedIds);
    const normalizedSelection = selectionChanged
      ? normalizedSelectionCandidate
      : state.selection.selectedIds;
    const derivedAllSelected = computeAllSelected(normalizedSelection, allSelectableRowIds);

    if (selectionChanged || derivedAllSelected !== state.selection.allSelected) {
      store.update((prev) => ({
        ...prev,
        selection: {
          selectedIds: normalizedSelection,
          allSelected: derivedAllSelected,
        },
      }));
      return;
    }

    const maxPage =
      state.pagination.pageSize > 0
        ? Math.max(0, Math.ceil(derivedTotalRows / state.pagination.pageSize) - 1)
        : 0;
    const clampedPage = state.pagination.pageSize > 0 ? Math.min(state.pagination.page, maxPage) : 0;

    if (derivedTotalRows !== state.pagination.totalRows || clampedPage !== state.pagination.page) {
      store.update((prev) => ({
        ...prev,
        pagination: {
          ...prev.pagination,
          totalRows: derivedTotalRows,
          page: clampedPage,
        },
      }));
      return;
    }

    // Run full pipeline with current pagination state.
    const processed = pipeline.process(state.data, state);
    pageSelectableRowIds = collectSelectableRowIds(processed, state.config.rowIdField);

    // Update processedData if it changed
    if (processed !== state.processedData && !sameRowSequence(processed, state.processedData)) {
      store.update((prev) => ({ ...prev, processedData: processed }));
      return; // The recursive update will trigger another subscribe call
    }

    // Update scroller dimensions
    const visibleColumns = getRenderColumns(state.columns);
    const widths = resolveVisibleColumnsForWidth(visibleColumns, getAvailableGridWidth()).map((c) => c.width);
    scroller.setDimensions(processed.length, widths);

    applyContainerHeight(state.config, processed.length);

    // Re-render current viewport even when range did not change
    // (e.g., pagination page changes with same page size/row count).
    const currentRange = scroller.getVisibleRange();
    const slice = buildVisibleSlice(
      state.processedData,
      state.columns,
      state.selection,
      state.config.rowIdField,
      pageSelectableRowIds,
      allSelectableRowIds,
      selectionColumnEnabled ? selectionColumnId : null,
      currentRange,
      state.freeze,
      getAvailableGridWidth(),
      getRenderColumns,
      scroller,
    );
    eventBus.emit('render:before', undefined);
    renderer.render(slice);
    eventBus.emit('render:after', { visibleRange: currentRange });

    // Emit state change
    eventBus.emit('state:changed', { state });
  });

  // --- Attach scroller to the scroll container ---
  // The scroll container is created by the renderer inside the mount target
  scrollEl = container.querySelector('.sg-grid__scroll-container') as HTMLElement;
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
  const dragIndicatorEl = document.createElement('div');
  dragIndicatorEl.className = 'sg-grid__drag-indicator';

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


  function showDragIndicatorAt(cell: HTMLElement): void {
    if (!headerEl) {
      return;
    }

    if (!dragIndicatorEl.parentElement) {
      headerEl.appendChild(dragIndicatorEl);
    }

    const headerRect = headerEl.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const left = Math.max(0, Math.round(cellRect.left - headerRect.left));

    dragIndicatorEl.style.left = `${left}px`;
    dragIndicatorEl.classList.add('sg-grid__drag-indicator--visible');
  }

  function hideDragIndicator(): void {
    dragIndicatorEl.classList.remove('sg-grid__drag-indicator--visible');
  }
  function resizeColumnInternal(columnId: string, requestedWidth: number, emitEvent: boolean): void {
    const targetColumn = store.getState().columns.find((column) => column.id === columnId);
    if (!targetColumn) {
      return;
    }

    if (targetColumn.fixedWidth === true || targetColumn.resizable === false) {
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

    if (
      target.closest('.sg-grid__selection-header') ||
      target.closest('.sg-grid__selection-header-checkbox') ||
      target.closest('.sg-grid__selection-header-dropdown')
    ) {
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
      if (!column || column.resizable === false || column.fixedWidth === true) {
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

    const columnId = cell.getAttribute('data-column-id');
    if (columnId === selectionColumnId) {
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
    showDragIndicatorAt(targetCell);

    const toRaw = targetCell.getAttribute('data-visible-col-index');
    const toVisibleIndex = toRaw ? Number.parseInt(toRaw, 10) : Number.NaN;
    reorderState.targetVisibleIndex = Number.isFinite(toVisibleIndex) ? toVisibleIndex : null;
  }

  function onReorderMouseUp(): void {
    if (!reorderState) {
      hideDragIndicator();
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
    hideDragIndicator();
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

    if (columnId === selectionColumnId) {
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
      if (!column || column.resizable === false || column.fixedWidth === true) {
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
    store.getState().selection,
    store.getState().config.rowIdField,
    pageSelectableRowIds,
    allSelectableRowIds,
    selectionColumnEnabled ? selectionColumnId : null,
    initialRange,
    store.getState().freeze,
    getAvailableGridWidth(),
    getRenderColumns,
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
      store.update((prev) => ({
        ...prev,
        selection: {
          selectedIds: normalizeSelection(
            [...prev.selection.selectedIds],
            collectSelectableRowIds(newData, prev.config.rowIdField),
          ),
          allSelected: false,
        },
      }));
    });
    eventBus.emit('data:set', { data: newData });
  }

  function setColumns(newColumns: ReadonlyArray<ColumnDef>): void {
    store.update((prev) => {
      const visibleCount = newColumns.filter((column) => column.visible !== false).length;
      const freeze = clampFreezeCounts(visibleCount, prev.freeze.leftCount, prev.freeze.rightCount);
      const grouping = {
        columnIds: normalizeGroupingColumnIds(prev.grouping.columnIds, newColumns),
        collapsedKeys: new Set<string>(),
      };
      return {
        ...prev,
        columns: newColumns,
        freeze,
        grouping,
      };
    });
    eventBus.emit('columns:set', { columns: newColumns });
  }

  function setConfig(patch: Partial<GridConfig>): void {
    const prevConfig = store.getState().config;
    const nextHeightMode =
      patch.heightMode === 'auto' || patch.heightMode === 'fixed'
        ? patch.heightMode
        : (prevConfig.heightMode ?? 'fixed');
    const nextHeight =
      typeof patch.height === 'number' && Number.isFinite(patch.height) && patch.height > 0
        ? Math.max(80, Math.floor(patch.height))
        : (prevConfig.height ?? 600);

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
      heightMode: nextHeightMode,
      height: nextHeight,
      rowIdField: typeof patch.rowIdField === 'string' ? patch.rowIdField : prevConfig.rowIdField,
    };

    // No-op if nothing changed
    if (
      nextConfig.rowHeight === prevConfig.rowHeight &&
      nextConfig.headerHeight === prevConfig.headerHeight &&
      nextConfig.overscanRows === prevConfig.overscanRows &&
      nextConfig.overscanColumns === prevConfig.overscanColumns &&
      nextConfig.heightMode === prevConfig.heightMode &&
      nextConfig.height === prevConfig.height &&
      nextConfig.rowIdField === prevConfig.rowIdField
    ) {
      return;
    }

    store.update((prev) => ({ ...prev, config: nextConfig }));
    eventBus.emit('config:changed', { config: nextConfig });

    // Keep renderer styling in sync
    container.style.setProperty('--sg-row-height', `${nextConfig.rowHeight}px`);
    container.style.setProperty('--sg-header-height', `${nextConfig.headerHeight}px`);
    applyContainerHeight(nextConfig, store.getState().processedData.length);

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

  function setGrouping(columnIds: ReadonlyArray<string>): void {
    const nextColumnIds = normalizeGroupingColumnIds(columnIds, store.getState().columns);

    store.update((prev) => ({
      ...prev,
      grouping: {
        columnIds: nextColumnIds,
        collapsedKeys: new Set<string>(),
      },
    }));

    eventBus.emit('grouping:changed', { columnIds: nextColumnIds, collapsedKeys: new Set() });
  }

  function clearGrouping(): void {
    setGrouping([]);
  }

  function toggleGroup(groupKey: string): void {
    if (!groupKey) {
      return;
    }

    let nextCollapsed = new Set<string>();
    store.update((prev) => {
      const collapsed = new Set(prev.grouping.collapsedKeys);
      if (collapsed.has(groupKey)) {
        collapsed.delete(groupKey);
      } else {
        collapsed.add(groupKey);
      }

      nextCollapsed = collapsed;

      return {
        ...prev,
        grouping: {
          ...prev.grouping,
          collapsedKeys: collapsed,
        },
      };
    });

    const grouping = store.getState().grouping;
    eventBus.emit('grouping:changed', { columnIds: grouping.columnIds, collapsedKeys: nextCollapsed });
  }

  function setTotals(mode: 'off' | 'page' | 'allPages', label?: string): void {
    const nextMode = mode;
    const nextLabel = label && label.trim().length > 0 ? label.trim() : store.getState().totals.label;

    store.update((prev) => ({
      ...prev,
      totals: {
        mode: nextMode,
        label: nextLabel,
      },
    }));

    eventBus.emit('totals:changed', { mode: nextMode, label: nextLabel });
  }

  function clearTotals(): void {
    setTotals('off');
  }

  function setSelection(rowIds: ReadonlyArray<RowId>): void {
    const selectedIds = normalizeSelection(rowIds, allSelectableRowIds);
    const allSelected = computeAllSelected(selectedIds, allSelectableRowIds);

    const current = store.getState().selection;
    if (sameSetValues(selectedIds, current.selectedIds) && allSelected === current.allSelected) {
      return;
    }

    store.update((prev) => ({
      ...prev,
      selection: {
        selectedIds,
        allSelected,
      },
    }));

    eventBus.emit('selection:changed', { selectedIds, allSelected });
  }

  function selectRow(rowId: RowId): void {
    const current = store.getState().selection.selectedIds;
    if (current.has(rowId)) {
      return;
    }

    setSelection([...current, rowId]);
  }

  function deselectRow(rowId: RowId): void {
    const current = store.getState().selection.selectedIds;
    if (!current.has(rowId)) {
      return;
    }

    setSelection([...current].filter((candidate) => candidate !== rowId));
  }

  function toggleRowSelection(rowId: RowId): void {
    if (store.getState().selection.selectedIds.has(rowId)) {
      deselectRow(rowId);
      return;
    }

    selectRow(rowId);
  }

  function selectAll(): void {
    const current = store.getState().selection.selectedIds;
    const next = new Set(current);
    for (const rowId of pageSelectableRowIds) {
      next.add(rowId);
    }
    setSelection([...next]);
  }

  function selectAllPages(): void {
    setSelection([...allSelectableRowIds]);
  }

  function clearSelection(): void {
    setSelection([]);
  }

  function clearCurrentPageSelection(): void {
    const current = new Set(store.getState().selection.selectedIds);
    for (const rowId of pageSelectableRowIds) {
      current.delete(rowId);
    }
    setSelection([...current]);
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

  function onGroupToggleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const toggle = target?.closest('.sg-grid__group-toggle') as HTMLElement | null;
    if (!toggle) {
      return;
    }

    const groupKey = toggle.getAttribute('data-group-key');
    if (!groupKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    toggleGroup(groupKey);
  }

  function onGroupToggleKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const target = event.target as HTMLElement | null;
    const toggle = target?.closest('.sg-grid__group-toggle') as HTMLElement | null;
    if (!toggle) {
      return;
    }

    const groupKey = toggle.getAttribute('data-group-key');
    if (!groupKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    toggleGroup(groupKey);
  }

  function onRowClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.closest('.sg-grid__group-toggle')) {
      return;
    }

    if (
      target.closest('.sg-grid__selection-row-checkbox') ||
      target.closest('.sg-grid__selection-header-checkbox') ||
      target.closest('.sg-grid__selection-header-dropdown')
    ) {
      return;
    }

    const rowEl = target.closest('.sg-grid__row') as HTMLElement | null;
    if (!rowEl) {
      return;
    }

    const rowIndexRaw = rowEl.getAttribute('data-row-index');
    const rowIndex = rowIndexRaw ? Number.parseInt(rowIndexRaw, 10) : Number.NaN;
    if (!Number.isFinite(rowIndex)) {
      return;
    }

    const state = store.getState();
    const row = state.processedData[rowIndex];
    if (!row) {
      return;
    }

    const rowId = getRowId(row, state.config.rowIdField);
    if (rowId === null) {
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      toggleRowSelection(rowId);
      return;
    }

    setSelection([rowId]);
  }

  function onSelectionCheckboxChange(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!(target instanceof HTMLInputElement)) {
      const selectTarget = event.target as HTMLElement | null;
      if (!(selectTarget instanceof HTMLSelectElement)) {
        return;
      }

      if (!selectTarget.classList.contains('sg-grid__selection-header-dropdown')) {
        return;
      }

      const action = selectTarget.value;
      if (action === 'select-page') {
        selectAll();
      } else if (action === 'select-all-pages') {
        selectAllPages();
      } else if (action === 'clear') {
        clearSelection();
      }

      selectTarget.value = '';
      return;
    }

    if (target.classList.contains('sg-grid__selection-header-checkbox')) {
      if (target.checked) {
        selectAll();
      } else {
        clearCurrentPageSelection();
      }
      return;
    }

    if (!target.classList.contains('sg-grid__selection-row-checkbox')) {
      return;
    }

    const rowIndexRaw = target.getAttribute('data-row-index');
    const rowIndex = rowIndexRaw ? Number.parseInt(rowIndexRaw, 10) : Number.NaN;
    if (!Number.isFinite(rowIndex)) {
      return;
    }

    const state = store.getState();
    const row = state.processedData[rowIndex];
    if (!row) {
      return;
    }

    const rowId = getRowId(row, state.config.rowIdField);
    if (rowId === null) {
      return;
    }

    if (target.checked) {
      selectRow(rowId);
    } else {
      deselectRow(rowId);
    }
  }

  container.addEventListener('click', onGroupToggleClick);
  container.addEventListener('keydown', onGroupToggleKeyDown);
  container.addEventListener('click', onRowClick);
  container.addEventListener('change', onSelectionCheckboxChange);

  function destroy(): void {
    if (headerEl) {
      headerEl.removeEventListener('mousedown', onHeaderMouseDown);
      headerEl.removeEventListener('keydown', onHeaderKeyDown);
    }
    onResizeMouseUp();
    onReorderMouseUp();
    container.removeEventListener('click', onGroupToggleClick);
    container.removeEventListener('keydown', onGroupToggleKeyDown);
    container.removeEventListener('click', onRowClick);
    container.removeEventListener('change', onSelectionCheckboxChange);
    hideDragIndicator();
    dragIndicatorEl.remove();

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
    setGrouping,
    clearGrouping,
    toggleGroup,
    setTotals,
    clearTotals,
    setSelection,
    selectRow,
    deselectRow,
    toggleRowSelection,
    selectAll,
    selectAllPages,
    clearSelection,
    resizeColumn,
    reorderColumn,
    getState: store.getState,
    getStore: () => store,
    getEventBus: () => eventBus,
    scrollTo,
    destroy,
  };
}

function normalizeGroupingColumnIds(
  requestedColumnIds: ReadonlyArray<string>,
  columns: ReadonlyArray<ColumnDef>,
): ReadonlyArray<string> {
  const groupableIds = new Set(
    columns.filter((column) => column.groupable !== false).map((column) => column.id),
  );
  const unique = new Set<string>();

  for (const columnId of requestedColumnIds) {
    if (!groupableIds.has(columnId)) {
      continue;
    }

    unique.add(columnId);
  }

  return [...unique];
}

function sameRowSequence(left: ReadonlyArray<Row>, right: ReadonlyArray<Row>): boolean {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }

  return true;
}

function sameSetValues<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): boolean {
  if (left === right) {
    return true;
  }

  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

// --- Helper ---

function buildVisibleSlice(
  processedData: ReadonlyArray<Row>,
  allColumns: ReadonlyArray<ColumnDef>,
  selection: { selectedIds: ReadonlySet<RowId> },
  rowIdField: string,
  pageSelectableRowIds: ReadonlySet<RowId>,
  allSelectableRowIds: ReadonlySet<RowId>,
  selectionColumnId: string | null,
  range: ViewportRange,
  freeze: { leftCount: number; rightCount: number },
  availableWidth: number,
  getRenderColumns: (columnsInput: ReadonlyArray<ColumnDef>) => ReadonlyArray<ColumnDef>,
  scroller: { getRowOffset: (i: number) => number; getColumnOffset: (i: number) => number },
): VisibleSlice {
  const visibleColumns = resolveVisibleColumnsForWidth(getRenderColumns(allColumns), availableWidth);
  const allColumnWidths = visibleColumns.map((column) => column.width);
  const leftCountWithSelection =
    selectionColumnId !== null ? Math.max(1, freeze.leftCount + 1) : freeze.leftCount;
  const clampedFreeze = clampFreezeCounts(visibleColumns.length, leftCountWithSelection, freeze.rightCount);

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
    rowIdField,
    selectedRowIds: selection.selectedIds,
    pageSelectableRowIds,
    allSelectableRowIds,
    selectionColumnId,
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
