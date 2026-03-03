// =============================================================================
// Smart Grid — Public API
// =============================================================================

// Core types
export type {
  // Primitives
  RowId,
  ColumnId,
  CellValue,
  Row,

  // Column
  ColumnDef,
  CellRendererFn,

  // State
  GridState,
  SortState,
  SortCriterion,
  SortDirection,
  FilterState,
  FilterCriterion,
  FilterOperator,
  FilterMode,
  PaginationState,
  FreezeState,
  GroupingState,
  TotalsMode,
  TotalsState,
  SelectionState,
  ViewportState,
  ViewportRange,
  GridConfig,

  // Store
  DataStore,
  StateUpdater,
  StateListener,
  Unsubscribe,

  // Event Bus
  EventBus,
  GridEvents,
  GridEventName,
  EventHandler,

  // Pipeline
  Pipeline,
  PipelineStep,

  // Scroller
  VirtualScroller,
  ScrollerConfig,

  // Renderer
  DOMRenderer,
  VisibleSlice,

  // Feature
  FeatureModule,
  GridContext,

  // Grid
  GridOptions,
  SmartGridAPI,
} from './types';

// Factory functions
export { createGrid } from './core/grid';
export { createStore } from './core/store';
export { createEventBus } from './core/event-bus';
export { createPipeline } from './core/pipeline';
export { createVirtualScroller } from './scroll/virtual-scroller';
export { createDOMRenderer } from './render/dom-renderer';
export { createCellRendererRegistry, defaultCellRenderer } from './render/cell-renderer';
export { resolveVisibleColumnsForWidth } from './features/columns/column-widths';
export { buildFrozenRenderColumnIndexes, clampFreezeCounts } from './features/freeze/freeze-utils';
export { createFilterFeature, createFilterStep } from './features/filter/filter-feature';
export { createGroupingFeature, createGroupingStep } from './features/grouping/grouping-feature';
export { createPaginationFeature, createPaginationStep } from './features/pagination/pagination-feature';
export { createTotalsFeature, createTotalsStep } from './features/totals/totals-feature';
export { createSortFeature, createSortStep } from './features/sort/sort-feature';
