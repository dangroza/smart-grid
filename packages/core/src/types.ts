// =============================================================================
// Smart Grid — Core Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Primitive types
// -----------------------------------------------------------------------------

/** Unique identifier for a row */
export type RowId = string | number;

/** Unique identifier for a column */
export type ColumnId = string;

/** Any cell value */
export type CellValue = string | number | boolean | null | undefined;

/** A single row of data */
export type Row = Readonly<Record<string, CellValue>>;

// -----------------------------------------------------------------------------
// Column definitions
// -----------------------------------------------------------------------------

/** Function that renders a cell's content into a DOM node */
export type CellRendererFn = (
  value: CellValue,
  row: Row,
  column: ColumnDef,
) => HTMLElement | string;

/** Column definition provided by the consumer */
export interface ColumnDef {
  readonly id: ColumnId;
  readonly field: string;
  readonly header: string;
  readonly width: number;
  /** If true, width stays fixed and is excluded from fill-width distribution. */
  readonly fixedWidth?: boolean;
  /** Optional fill weight for using remaining horizontal space. 0/undefined = no fill behavior. */
  readonly flexGrow?: number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly resizable?: boolean;
  readonly visible?: boolean;
  readonly cellRenderer?: CellRendererFn;
  readonly headerRenderer?: CellRendererFn;
}

// -----------------------------------------------------------------------------
// Sort
// -----------------------------------------------------------------------------

export type SortDirection = 'asc' | 'desc';

export interface SortCriterion {
  readonly columnId: ColumnId;
  readonly direction: SortDirection;
}

export interface SortState {
  readonly criteria: ReadonlyArray<SortCriterion>;
}

// -----------------------------------------------------------------------------
// Filter
// -----------------------------------------------------------------------------

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'between'
  | 'in'
  | 'notIn'
  | 'isEmpty'
  | 'isNotEmpty';

export interface FilterCriterion {
  readonly columnId: ColumnId;
  readonly operator: FilterOperator;
  readonly value: CellValue | ReadonlyArray<CellValue>;
}

export type FilterMode = 'client' | 'server';

export interface FilterState {
  readonly criteria: ReadonlyArray<FilterCriterion>;
  readonly mode: FilterMode;
}

// -----------------------------------------------------------------------------
// Pagination
// -----------------------------------------------------------------------------

export interface PaginationState {
  readonly page: number;
  readonly pageSize: number;
  readonly totalRows: number;
}

// -----------------------------------------------------------------------------
// Freeze
// -----------------------------------------------------------------------------

export interface FreezeState {
  readonly leftCount: number;
  readonly rightCount: number;
}

// -----------------------------------------------------------------------------
// Selection
// -----------------------------------------------------------------------------

export interface SelectionState {
  readonly selectedIds: ReadonlySet<RowId>;
  readonly allSelected: boolean;
}

// -----------------------------------------------------------------------------
// Viewport
// -----------------------------------------------------------------------------

export interface ViewportRange {
  readonly startRow: number;
  readonly endRow: number;
  readonly startCol: number;
  readonly endCol: number;
}

export interface ViewportState {
  readonly scrollTop: number;
  readonly scrollLeft: number;
  readonly containerWidth: number;
  readonly containerHeight: number;
  readonly visibleRange: ViewportRange;
}

// -----------------------------------------------------------------------------
// Grid configuration
// -----------------------------------------------------------------------------

export interface GridConfig {
  readonly rowHeight: number;
  readonly headerHeight: number;
  readonly heightMode?: 'auto' | 'fixed';
  readonly height?: number;
  readonly overscanRows: number;
  readonly overscanColumns: number;
  readonly rowIdField: string;
}

// -----------------------------------------------------------------------------
// Grid state — the single source of truth
// -----------------------------------------------------------------------------

export interface GridState {
  readonly data: ReadonlyArray<Row>;
  readonly columns: ReadonlyArray<ColumnDef>;
  readonly processedData: ReadonlyArray<Row>;
  readonly viewport: ViewportState;
  readonly sort: SortState;
  readonly filter: FilterState;
  readonly selection: SelectionState;
  readonly pagination: PaginationState;
  readonly freeze: FreezeState;
  readonly config: GridConfig;
}

// -----------------------------------------------------------------------------
// Data Store
// -----------------------------------------------------------------------------

export type StateUpdater = (prev: GridState) => GridState;
export type StateListener = (state: GridState) => void;
export type Unsubscribe = () => void;

export interface DataStore {
  getState(): GridState;
  update(updater: StateUpdater): void;
  subscribe(listener: StateListener): Unsubscribe;
  select<T>(selector: (state: GridState) => T): T;
  batch(fn: () => void): void;
  destroy(): void;
}

// -----------------------------------------------------------------------------
// Event Bus
// -----------------------------------------------------------------------------

export interface GridEvents {
  // State events
  'state:changed': { state: GridState };
  'data:set': { data: ReadonlyArray<Row> };
  'columns:set': { columns: ReadonlyArray<ColumnDef> };

  // Viewport events
  'scroll': { scrollTop: number; scrollLeft: number };
  'viewport:changed': { range: ViewportRange };
  'resize': { width: number; height: number };

  // Sort events
  'sort:changed': { criteria: ReadonlyArray<SortCriterion> };

  // Filter events
  'filter:changed': { criteria: ReadonlyArray<FilterCriterion> };

  // Selection events
  'selection:changed': { selectedIds: ReadonlySet<RowId> };

  // Pagination events
  'pagination:changed': { page: number; pageSize: number };

  // Freeze events
  'freeze:changed': { leftCount: number; rightCount: number };

  // Column events
  'column:resized': { columnId: ColumnId; width: number };
  'column:reordered': { columnId: ColumnId; fromIndex: number; toIndex: number };
  'column:visibility': { columnId: ColumnId; visible: boolean };

  // Config events
  'config:changed': { config: GridConfig };

  // Render lifecycle
  'render:before': undefined;
  'render:after': { visibleRange: ViewportRange };
}

export type GridEventName = keyof GridEvents;
export type EventHandler<K extends GridEventName> = (payload: GridEvents[K]) => void;

export interface EventBus {
  on<K extends GridEventName>(event: K, handler: EventHandler<K>): Unsubscribe;
  off<K extends GridEventName>(event: K, handler: EventHandler<K>): void;
  emit<K extends GridEventName>(event: K, payload: GridEvents[K]): void;
  destroy(): void;
}

// -----------------------------------------------------------------------------
// Data Pipeline
// -----------------------------------------------------------------------------

export type PipelineStep = (
  data: ReadonlyArray<Row>,
  state: GridState,
) => ReadonlyArray<Row>;

export interface Pipeline {
  addStep(id: string, step: PipelineStep, priority: number): void;
  removeStep(id: string): void;
  process(data: ReadonlyArray<Row>, state: GridState): ReadonlyArray<Row>;
  clear(): void;
}

// -----------------------------------------------------------------------------
// Virtual Scroller
// -----------------------------------------------------------------------------

export interface ScrollerConfig {
  readonly rowHeight: number;
  readonly overscanRows: number;
  readonly overscanColumns: number;
}

export interface VirtualScroller {
  attach(container: HTMLElement): void;
  detach(): void;
  getVisibleRange(): ViewportRange;
  scrollTo(row: number, col?: number): void;
  setDimensions(totalRows: number, columnWidths: ReadonlyArray<number>): void;
  /** Updates scroller configuration at runtime (e.g. rowHeight, overscan). */
  setConfig(config: Partial<ScrollerConfig>): void;
  onRangeChanged(callback: (range: ViewportRange) => void): Unsubscribe;
  getTotalHeight(): number;
  getTotalWidth(): number;
  getRowOffset(rowIndex: number): number;
  getColumnOffset(colIndex: number): number;
  destroy(): void;
}

// -----------------------------------------------------------------------------
// DOM Renderer
// -----------------------------------------------------------------------------

export interface VisibleSlice {
  readonly rows: ReadonlyArray<Row>;
  readonly columns: ReadonlyArray<ColumnDef>;
  readonly columnIndexes: ReadonlyArray<number>;
  readonly allColumnWidths: ReadonlyArray<number>;
  readonly leftFrozenCount: number;
  readonly rightFrozenCount: number;
  readonly range: ViewportRange;
  readonly totalRows: number;
  readonly rowOffset: number;
  readonly columnOffset: number;
}

export interface DOMRenderer {
  mount(container: HTMLElement): void;
  render(slice: VisibleSlice): void;
  setCellRenderer(columnId: ColumnId, renderer: CellRendererFn): void;
  destroy(): void;
}

// -----------------------------------------------------------------------------
// Feature Module
// -----------------------------------------------------------------------------

export interface GridContext {
  readonly store: DataStore;
  readonly eventBus: EventBus;
  readonly pipeline: Pipeline;
  readonly renderer: DOMRenderer;
  readonly scroller: VirtualScroller;
}

export interface FeatureModule {
  readonly id: string;
  install(context: GridContext): void;
  destroy(): void;
}

// -----------------------------------------------------------------------------
// Grid (public API)
// -----------------------------------------------------------------------------

export interface GridOptions {
  readonly container: HTMLElement;
  readonly columns: ReadonlyArray<ColumnDef>;
  readonly data?: ReadonlyArray<Row>;
  /** Preferred options bag for grid configuration at initialization. */
  readonly config?: Partial<GridConfig>;
  readonly initialSort?: ReadonlyArray<SortCriterion>;
  readonly initialFilter?: ReadonlyArray<FilterCriterion>;
  readonly initialFilterMode?: FilterMode;
  readonly initialPagination?: {
    readonly page?: number;
    readonly pageSize?: number;
  };
  readonly initialFreeze?: {
    readonly leftCount?: number;
    readonly rightCount?: number;
  };
  readonly height?: number | 'auto';
  readonly rowHeight?: number;
  readonly headerHeight?: number;
  readonly overscanRows?: number;
  readonly overscanColumns?: number;
  readonly rowIdField?: string;
  readonly features?: ReadonlyArray<FeatureModule>;
}

export interface SmartGridAPI {
  setData(data: ReadonlyArray<Row>): void;
  setColumns(columns: ReadonlyArray<ColumnDef>): void;
  /** Updates grid configuration (row height, overscan, etc.) at runtime. */
  setConfig(config: Partial<GridConfig>): void;
  setSort(criteria: ReadonlyArray<SortCriterion>): void;
  clearSort(): void;
  setFilter(criteria: ReadonlyArray<FilterCriterion>, mode?: FilterMode): void;
  clearFilter(): void;
  setPagination(page: number, pageSize?: number): void;
  clearPagination(): void;
  setFrozenColumns(leftCount: number, rightCount: number): void;
  freezeLeftTo(columnId: ColumnId): void;
  freezeRightFrom(columnId: ColumnId): void;
  clearFreeze(): void;
  resizeColumn(columnId: ColumnId, width: number): void;
  reorderColumn(columnId: ColumnId, toVisibleIndex: number): void;
  getState(): GridState;
  getStore(): DataStore;
  getEventBus(): EventBus;
  scrollTo(row: number, col?: number): void;
  destroy(): void;
}
