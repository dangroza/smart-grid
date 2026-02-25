// =============================================================================
// Smart Grid — Example: Smart Side Panel (Config Form)
//
// No dependencies. Pure DOM.
// =============================================================================

import type {
  ColumnDef,
  FilterCriterion,
  FilterMode,
  FilterOperator,
  GridConfig,
  Row,
  SmartGridAPI,
  SortCriterion,
} from '@smart-grid/core';

export interface SidePanelOptions {
  readonly target: HTMLElement;
  readonly grid: SmartGridAPI;
  readonly generateRows: (count: number, columnCount: number) => Row[];
  readonly generateColumns: (count: number) => ColumnDef[];
  readonly initialRowCount: number;
  readonly initialColumnCount: number;
}

const ROW_COUNT_PRESETS = [10, 50, 100, 500, 1_000, 5_000, 10_000, 25_000, 50_000] as const;
const COLUMN_COUNT_PRESETS = Array.from({ length: 50 }, (_, i) => i + 1);

const FILTER_OPERATORS: ReadonlyArray<FilterOperator> = [
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'lessThan',
  'greaterThanOrEqual',
  'lessThanOrEqual',
  'between',
  'in',
  'notIn',
  'isEmpty',
  'isNotEmpty',
];

export function mountSmartSidePanel(options: SidePanelOptions): () => void {
  const { target, grid, generateRows, generateColumns, initialRowCount, initialColumnCount } = options;

  target.classList.add('sg-sidepanel');

  let lastColumnsRef: ReadonlyArray<ColumnDef> | null = null;
  let lastConfigRef: GridConfig | null = null;

  // --- DOM helpers ---

  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function labeledRow(label: string, input: HTMLElement, hint?: string): HTMLElement {
    const row = el('div', 'sg-sidepanel__row');
    const labelEl = el('label', 'sg-sidepanel__label', label);
    row.appendChild(labelEl);
    row.appendChild(input);
    if (hint) row.appendChild(el('div', 'sg-sidepanel__hint', hint));
    return row;
  }

  function makeNumberInput(opts: {
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly value: number;
  }): HTMLInputElement {
    const input = el('input', 'sg-sidepanel__input') as HTMLInputElement;
    input.type = 'number';
    if (opts.min !== undefined) input.min = String(opts.min);
    if (opts.max !== undefined) input.max = String(opts.max);
    if (opts.step !== undefined) input.step = String(opts.step);
    input.value = String(opts.value);
    return input;
  }

  function makeSelect<T extends number>(values: readonly T[], current: number): HTMLSelectElement {
    const select = el('select', 'sg-sidepanel__select') as HTMLSelectElement;
    for (const v of values) {
      const option = document.createElement('option');
      option.value = String(v);
      option.textContent = v.toLocaleString();
      if (v === current) option.selected = true;
      select.appendChild(option);
    }
    return select;
  }

  function makeStringSelect(values: readonly string[], current: string): HTMLSelectElement {
    const select = el('select', 'sg-sidepanel__select') as HTMLSelectElement;
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      if (value === current) option.selected = true;
      select.appendChild(option);
    }
    return select;
  }

  function makeTextInput(value = ''): HTMLInputElement {
    const input = el('input', 'sg-sidepanel__input') as HTMLInputElement;
    input.type = 'text';
    input.value = value;
    return input;
  }

  function makeButton(text: string, onClick: () => void, kind: 'primary' | 'default' = 'default'): HTMLButtonElement {
    const btn = el('button', `sg-sidepanel__btn sg-sidepanel__btn--${kind}`, text) as HTMLButtonElement;
    btn.type = 'button';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });
    return btn;
  }

  function parsePositiveInt(value: string, fallback: number): number {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function parseNonNegativeInt(value: string, fallback: number): number {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  function parseScalar(raw: string): string | number | boolean | null {
    const trimmed = raw.trim();

    if (trimmed === '') return '';
    if (trimmed.toLowerCase() === 'null') return null;
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;

    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) return asNumber;

    return trimmed;
  }

  function parseFilterValue(operator: FilterOperator, raw: string): FilterCriterion['value'] {
    if (operator === 'isEmpty' || operator === 'isNotEmpty') {
      return '';
    }

    if (operator === 'between') {
      const parts = raw
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .slice(0, 2);
      if (parts.length === 2) {
        return [parseScalar(parts[0]!), parseScalar(parts[1]!)];
      }
      return [parseScalar(raw), parseScalar(raw)];
    }

    if (operator === 'in' || operator === 'notIn') {
      return raw
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part) => parseScalar(part));
    }

    return parseScalar(raw);
  }

  function applySort(criteria: ReadonlyArray<SortCriterion>): void {
    grid.setSort(criteria);
  }

  function applyFilter(criteria: ReadonlyArray<FilterCriterion>, mode: FilterMode): void {
    grid.setFilter(criteria, mode);
  }

  function setSelectOptions(
    select: HTMLSelectElement,
    options: ReadonlyArray<{ readonly value: string; readonly label: string }>,
  ): void {
    const previous = select.value;
    select.innerHTML = '';

    for (const optionData of options) {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.label;
      select.appendChild(option);
    }

    const hasPrevious = options.some((option) => option.value === previous);
    if (hasPrevious) {
      select.value = previous;
    }
  }

  function applyColumnsVisibility(nextColumns: ReadonlyArray<ColumnDef>): void {
    grid.setColumns(nextColumns);
  }

  // --- Render ---

  const header = el('div', 'sg-sidepanel__header');
  header.appendChild(el('div', 'sg-sidepanel__title', 'Grid Config'));
  const summary = el('div', 'sg-sidepanel__summary', '');
  header.appendChild(summary);

  const content = el('div', 'sg-sidepanel__content');

  // Dataset section
  const datasetSection = el('section', 'sg-sidepanel__section');
  datasetSection.appendChild(el('h2', 'sg-sidepanel__section-title', 'Dataset'));

  const rowCountSelect = makeSelect(ROW_COUNT_PRESETS, initialRowCount);
  const colCountSelect = makeSelect(COLUMN_COUNT_PRESETS, initialColumnCount);

  const applyDatasetBtn = makeButton('Apply dataset', () => {
    const nextRowCount = parsePositiveInt(rowCountSelect.value, initialRowCount);
    const nextColCount = parsePositiveInt(colCountSelect.value, initialColumnCount);

    const nextColumns = generateColumns(nextColCount);
    const nextRows = generateRows(nextRowCount, nextColCount);

    const store = grid.getStore();
    store.batch(() => {
      grid.setColumns(nextColumns);
      grid.setData(nextRows);
    });
  }, 'primary');

  datasetSection.appendChild(labeledRow('Rows', rowCountSelect, 'Regenerates mock data'));
  datasetSection.appendChild(labeledRow('Total columns', colCountSelect, 'Regenerates columns + mock data'));
  datasetSection.appendChild(applyDatasetBtn);

  // Visible columns section
  const columnsSection = el('section', 'sg-sidepanel__section');
  columnsSection.appendChild(el('h2', 'sg-sidepanel__section-title', 'Visible Columns'));

  const columnsToolbar = el('div', 'sg-sidepanel__toolbar');
  const columnsList = el('div', 'sg-sidepanel__columns');

  const btnAll = makeButton('All', () => {
    const state = grid.getState();
    applyColumnsVisibility(state.columns.map((c) => ({ ...c, visible: true })));
  });
  const btnNone = makeButton('None', () => {
    const state = grid.getState();
    applyColumnsVisibility(state.columns.map((c) => ({ ...c, visible: false })));
  });
  const btnReset = makeButton('Reset', () => {
    // Reset to "all visible" while preserving column definitions
    const state = grid.getState();
    applyColumnsVisibility(state.columns.map((c) => ({ ...c, visible: true })));
  });

  columnsToolbar.appendChild(btnAll);
  columnsToolbar.appendChild(btnNone);
  columnsToolbar.appendChild(btnReset);

  columnsSection.appendChild(columnsToolbar);
  columnsSection.appendChild(columnsList);

  function renderColumnsList(columns: ReadonlyArray<ColumnDef>): void {
    columnsList.innerHTML = '';

    for (const col of columns) {
      const row = el('label', 'sg-sidepanel__checkrow');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = col.visible !== false;
      input.addEventListener('change', () => {
        const state = grid.getState();
        const next = state.columns.map((c) =>
          c.id === col.id ? ({ ...c, visible: input.checked } as ColumnDef) : c,
        );
        applyColumnsVisibility(next);
      });

      const name = el('span', 'sg-sidepanel__checklabel', col.header);
      const meta = el('span', 'sg-sidepanel__checkmeta', col.id);

      row.appendChild(input);
      row.appendChild(name);
      row.appendChild(meta);
      columnsList.appendChild(row);
    }
  }

  // Grid settings section
  const settingsSection = el('section', 'sg-sidepanel__section');
  settingsSection.appendChild(el('h2', 'sg-sidepanel__section-title', 'Grid Settings'));

  function readConfig(): GridConfig {
    return grid.getState().config;
  }

  const config = readConfig();
  const rowHeightInput = makeNumberInput({ value: config.rowHeight, min: 16, max: 200, step: 1 });
  const headerHeightInput = makeNumberInput({ value: config.headerHeight, min: 24, max: 200, step: 1 });
  const heightModeSelect = makeStringSelect(['fixed', 'auto'], config.heightMode ?? 'fixed');
  const gridHeightInput = makeNumberInput({ value: config.height ?? 600, min: 80, max: 5000, step: 1 });
  const overscanRowsInput = makeNumberInput({ value: config.overscanRows, min: 0, max: 200, step: 1 });
  const overscanColsInput = makeNumberInput({ value: config.overscanColumns, min: 0, max: 200, step: 1 });

  const applyConfigBtn = makeButton('Apply settings', () => {
    const patch: Partial<GridConfig> = {
      rowHeight: parsePositiveInt(rowHeightInput.value, readConfig().rowHeight),
      headerHeight: parsePositiveInt(headerHeightInput.value, readConfig().headerHeight),
      heightMode: heightModeSelect.value === 'auto' ? 'auto' : 'fixed',
      height: parsePositiveInt(gridHeightInput.value, readConfig().height ?? 600),
      overscanRows: Math.max(0, parsePositiveInt(overscanRowsInput.value, readConfig().overscanRows)),
      overscanColumns: Math.max(0, parsePositiveInt(overscanColsInput.value, readConfig().overscanColumns)),
    };

    grid.setConfig(patch);
  }, 'primary');

  settingsSection.appendChild(labeledRow('Row height (px)', rowHeightInput));
  settingsSection.appendChild(labeledRow('Header height (px)', headerHeightInput));
  settingsSection.appendChild(labeledRow('Grid height mode', heightModeSelect));
  settingsSection.appendChild(labeledRow('Grid fixed height (px)', gridHeightInput));
  settingsSection.appendChild(labeledRow('Overscan rows', overscanRowsInput, 'Extra rows rendered above/below viewport'));
  settingsSection.appendChild(labeledRow('Overscan cols', overscanColsInput, 'Extra columns rendered left/right of viewport'));
  settingsSection.appendChild(applyConfigBtn);

  // Column sizing section
  const sizingSection = el('section', 'sg-sidepanel__section');
  sizingSection.appendChild(el('h2', 'sg-sidepanel__section-title', 'Column Sizing'));

  const sizeColumnSelect = makeStringSelect(['id'], 'id');
  const baseWidthInput = makeNumberInput({ value: 120, min: 40, max: 1000, step: 1 });
  const fixedWidthSelect = makeStringSelect(['false', 'true'], 'false');
  const flexGrowInput = makeNumberInput({ value: 0, min: 0, max: 20, step: 1 });

  const applySizingBtn = makeButton('Apply column sizing', () => {
    const columnId = sizeColumnSelect.value;
    if (!columnId) return;

    const state = grid.getState();
    const nextColumns = state.columns.map((column) => {
      if (column.id !== columnId) return column;
      const width = parsePositiveInt(baseWidthInput.value, column.width);
      const fixedWidth = fixedWidthSelect.value === 'true';
      const flexGrow = parseNonNegativeInt(flexGrowInput.value, column.flexGrow ?? 0);

      return {
        ...column,
        width,
        fixedWidth,
        flexGrow,
      } as ColumnDef;
    });

    grid.setColumns(nextColumns);
  }, 'primary');

  sizingSection.appendChild(labeledRow('Column', sizeColumnSelect));
  sizingSection.appendChild(labeledRow('Base width (px)', baseWidthInput));
  sizingSection.appendChild(labeledRow('Fixed width', fixedWidthSelect));
  sizingSection.appendChild(labeledRow('Fill weight (flexGrow)', flexGrowInput, '0 means no fill behavior'));
  sizingSection.appendChild(applySizingBtn);

  // Freeze section
  const freezeSection = el('section', 'sg-sidepanel__section');
  freezeSection.appendChild(el('h2', 'sg-sidepanel__section-title', 'Freeze Columns'));

  const freezeLeftSelect = makeStringSelect(['none'], 'none');
  const freezeRightSelect = makeStringSelect(['none'], 'none');
  const freezeInfo = el('div', 'sg-sidepanel__hint', '');
  const freezeToolbar = el('div', 'sg-sidepanel__toolbar');

  const applyFreezeBtn = makeButton('Apply freeze', () => {
    const visibleColumns = grid.getState().columns.filter((column) => column.visible !== false);

    const leftId = freezeLeftSelect.value;
    const rightId = freezeRightSelect.value;

    const leftIndex = visibleColumns.findIndex((column) => column.id === leftId);
    const rightIndex = visibleColumns.findIndex((column) => column.id === rightId);

    const leftCount = leftId === 'none' || leftIndex < 0 ? 0 : leftIndex + 1;
    const rightCount = rightId === 'none' || rightIndex < 0 ? 0 : visibleColumns.length - rightIndex;

    grid.setFrozenColumns(leftCount, rightCount);
  }, 'primary');

  const clearFreezeBtn = makeButton('Clear', () => {
    grid.clearFreeze();
  });

  freezeToolbar.appendChild(applyFreezeBtn);
  freezeToolbar.appendChild(clearFreezeBtn);

  freezeSection.appendChild(labeledRow('Freeze left to column', freezeLeftSelect, 'Inclusive (freezes all before it)'));
  freezeSection.appendChild(labeledRow('Freeze right from column', freezeRightSelect, 'Inclusive (freezes all after it)'));
  freezeSection.appendChild(freezeToolbar);
  freezeSection.appendChild(freezeInfo);

  // Sorting section
  const sortSection = el('section', 'sg-sidepanel__section');
  sortSection.appendChild(el('h2', 'sg-sidepanel__section-title', 'Sorting'));

  const sortColumnSelect = makeStringSelect(['id'], 'id');
  const sortDirectionSelect = makeStringSelect(['asc', 'desc'], 'asc');
  const sortList = el('div', 'sg-sidepanel__columns');
  const sortToolbar = el('div', 'sg-sidepanel__toolbar');

  const addSortBtn = makeButton('Add/Update', () => {
    const columnId = sortColumnSelect.value;
    const direction = sortDirectionSelect.value === 'desc' ? 'desc' : 'asc';
    const state = grid.getState();

    if (!columnId) return;

    const existingIndex = state.sort.criteria.findIndex((criterion) => criterion.columnId === columnId);
    const next = [...state.sort.criteria];
    const criterion: SortCriterion = { columnId, direction };

    if (existingIndex >= 0) {
      next[existingIndex] = criterion;
    } else {
      next.push(criterion);
    }

    applySort(next);
  }, 'primary');

  const clearSortBtn = makeButton('Clear', () => {
    grid.clearSort();
  });

  sortToolbar.appendChild(addSortBtn);
  sortToolbar.appendChild(clearSortBtn);

  sortSection.appendChild(labeledRow('Column', sortColumnSelect));
  sortSection.appendChild(labeledRow('Direction', sortDirectionSelect));
  sortSection.appendChild(sortToolbar);
  sortSection.appendChild(sortList);

  // Filtering section
  const filterSection = el('section', 'sg-sidepanel__section');
  filterSection.appendChild(el('h2', 'sg-sidepanel__section-title', 'Filtering'));

  const filterModeSelect = makeStringSelect(['client', 'server'], 'client');
  const filterColumnSelect = makeStringSelect(['id'], 'id');
  const filterOperatorSelect = makeStringSelect(FILTER_OPERATORS, 'contains');
  const filterValueInput = makeTextInput('');
  const filterList = el('div', 'sg-sidepanel__columns');
  const filterToolbar = el('div', 'sg-sidepanel__toolbar');

  const applyFilterBtn = makeButton('Add filter', () => {
    const state = grid.getState();
    const columnId = filterColumnSelect.value;
    const operator = filterOperatorSelect.value as FilterOperator;
    const mode = filterModeSelect.value === 'server' ? 'server' : 'client';

    if (!columnId) return;

    const criterion: FilterCriterion = {
      columnId,
      operator,
      value: parseFilterValue(operator, filterValueInput.value),
    };

    applyFilter([...state.filter.criteria, criterion], mode);
  }, 'primary');

  const applyFilterModeBtn = makeButton('Apply mode', () => {
    const mode = filterModeSelect.value === 'server' ? 'server' : 'client';
    const state = grid.getState();
    applyFilter(state.filter.criteria, mode);
  });

  const clearFilterBtn = makeButton('Clear', () => {
    const mode = filterModeSelect.value === 'server' ? 'server' : 'client';
    applyFilter([], mode);
  });

  filterToolbar.appendChild(applyFilterBtn);
  filterToolbar.appendChild(applyFilterModeBtn);
  filterToolbar.appendChild(clearFilterBtn);

  filterSection.appendChild(labeledRow('Mode', filterModeSelect));
  filterSection.appendChild(labeledRow('Column', filterColumnSelect));
  filterSection.appendChild(labeledRow('Operator', filterOperatorSelect));
  filterSection.appendChild(labeledRow('Value', filterValueInput, 'For in/between use comma-separated values'));
  filterSection.appendChild(filterToolbar);
  filterSection.appendChild(filterList);

  // Pagination section
  const paginationSection = el('section', 'sg-sidepanel__section');
  paginationSection.appendChild(el('h2', 'sg-sidepanel__section-title', 'Pagination'));

  const paginationToolbar = el('div', 'sg-sidepanel__toolbar');
  const paginationInfo = el('div', 'sg-sidepanel__hint', '');

  const statePagination = grid.getState().pagination;
  const pageSizeInput = makeNumberInput({
    value: statePagination.pageSize,
    min: 0,
    max: 50_000,
    step: 1,
  });
  const pageInput = makeNumberInput({ value: statePagination.page + 1, min: 1, step: 1 });

  const btnPrev = makeButton('Prev', () => {
    const current = grid.getState().pagination;
    grid.setPagination(Math.max(0, current.page - 1));
  });

  const btnNext = makeButton('Next', () => {
    const current = grid.getState().pagination;
    grid.setPagination(current.page + 1);
  });

  const btnDisable = makeButton('Disable', () => {
    grid.clearPagination();
  });

  const applyPaginationBtn = makeButton('Apply pagination', () => {
    const current = grid.getState().pagination;
    const nextPageSize = parseNonNegativeInt(pageSizeInput.value, current.pageSize);
    const nextPage1Based = parsePositiveInt(pageInput.value, current.page + 1);
    grid.setPagination(nextPage1Based - 1, nextPageSize);
  }, 'primary');

  paginationToolbar.appendChild(btnPrev);
  paginationToolbar.appendChild(btnNext);
  paginationToolbar.appendChild(btnDisable);

  paginationSection.appendChild(labeledRow('Page size (0 = disabled)', pageSizeInput));
  paginationSection.appendChild(labeledRow('Page (1-based)', pageInput));
  paginationSection.appendChild(paginationToolbar);
  paginationSection.appendChild(applyPaginationBtn);
  paginationSection.appendChild(paginationInfo);

  // Compose sidepanel
  content.appendChild(datasetSection);
  content.appendChild(columnsSection);
  content.appendChild(settingsSection);
  content.appendChild(sizingSection);
  content.appendChild(freezeSection);
  content.appendChild(sortSection);
  content.appendChild(filterSection);
  content.appendChild(paginationSection);

  target.appendChild(header);
  target.appendChild(content);

  function updateSummary(): void {
    const state = grid.getState();
    const totalCols = state.columns.length;
    const visibleCols = state.columns.filter((c) => c.visible !== false).length;
    const { page, pageSize, totalRows } = state.pagination;
    const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1;
    const pageSummary = pageSize > 0 ? ` · page ${(page + 1).toLocaleString()}/${totalPages.toLocaleString()}` : '';

    summary.textContent =
      `${state.data.length.toLocaleString()} rows · ` +
      `${visibleCols.toLocaleString()}/${totalCols.toLocaleString()} cols visible` +
      pageSummary;
  }

  function syncConfigInputs(nextConfig: GridConfig): void {
    rowHeightInput.value = String(nextConfig.rowHeight);
    headerHeightInput.value = String(nextConfig.headerHeight);
    heightModeSelect.value = nextConfig.heightMode ?? 'fixed';
    gridHeightInput.value = String(nextConfig.height ?? 600);
    overscanRowsInput.value = String(nextConfig.overscanRows);
    overscanColsInput.value = String(nextConfig.overscanColumns);
  }

  function syncColumnSizingUI(): void {
    const state = grid.getState();
    const options = state.columns.map((column) => ({ value: column.id, label: `${column.header} (${column.id})` }));
    setSelectOptions(sizeColumnSelect, options.length > 0 ? options : [{ value: '', label: '—' }]);

    const selected = state.columns.find((column) => column.id === sizeColumnSelect.value) ?? state.columns[0];
    if (!selected) return;

    sizeColumnSelect.value = selected.id;
    baseWidthInput.value = String(selected.width);
    fixedWidthSelect.value = selected.fixedWidth ? 'true' : 'false';
    flexGrowInput.value = String(selected.flexGrow ?? 0);
  }

  function syncPaginationUI(): void {
    const { pagination } = grid.getState();
    const totalPages =
      pagination.pageSize > 0 ? Math.max(1, Math.ceil(pagination.totalRows / pagination.pageSize)) : 1;
    const visibleRows = grid.getState().processedData.length;

    pageInput.value = String(pagination.page + 1);
    pageSizeInput.value = String(pagination.pageSize);
    paginationInfo.textContent =
      pagination.pageSize > 0
        ? `Page ${pagination.page + 1}/${totalPages} · ${visibleRows.toLocaleString()} rows shown`
        : `Pagination disabled · ${visibleRows.toLocaleString()} rows shown`;
  }

  function syncSortFilterUI(): void {
    const state = grid.getState();

    const sortableColumns = state.columns
      .filter((column) => column.sortable !== false)
      .map((column) => ({ value: column.id, label: `${column.header} (${column.id})` }));

    const filterableColumns = state.columns
      .filter((column) => column.filterable !== false)
      .map((column) => ({ value: column.id, label: `${column.header} (${column.id})` }));

    setSelectOptions(sortColumnSelect, sortableColumns.length > 0 ? sortableColumns : [{ value: '', label: '—' }]);
    setSelectOptions(
      filterColumnSelect,
      filterableColumns.length > 0 ? filterableColumns : [{ value: '', label: '—' }],
    );

    filterModeSelect.value = state.filter.mode;

    sortList.innerHTML = '';
    if (state.sort.criteria.length === 0) {
      sortList.appendChild(el('div', 'sg-sidepanel__hint', 'No active sort criteria'));
    } else {
      state.sort.criteria.forEach((criterion, index) => {
        const row = el('div', 'sg-sidepanel__checkrow');
        row.appendChild(
          el('span', 'sg-sidepanel__checklabel', `${criterion.columnId} · ${criterion.direction.toUpperCase()}`),
        );
        const removeBtn = makeButton('Remove', () => {
          const next = state.sort.criteria.filter((_, i) => i !== index);
          applySort(next);
        });
        row.appendChild(removeBtn);
        sortList.appendChild(row);
      });
    }

    filterList.innerHTML = '';
    if (state.filter.criteria.length === 0) {
      filterList.appendChild(el('div', 'sg-sidepanel__hint', 'No active filters'));
    } else {
      state.filter.criteria.forEach((criterion, index) => {
        const row = el('div', 'sg-sidepanel__checkrow');
        row.appendChild(
          el(
            'span',
            'sg-sidepanel__checklabel',
            `${criterion.columnId} · ${criterion.operator} · ${JSON.stringify(criterion.value)}`,
          ),
        );
        const removeBtn = makeButton('Remove', () => {
          const next = state.filter.criteria.filter((_, i) => i !== index);
          applyFilter(next, state.filter.mode);
        });
        row.appendChild(removeBtn);
        filterList.appendChild(row);
      });
    }
  }

  function syncFreezeUI(): void {
    const state = grid.getState();
    const visibleColumns = state.columns.filter((column) => column.visible !== false);

    const options = [
      { value: 'none', label: 'none' },
      ...visibleColumns.map((column) => ({ value: column.id, label: `${column.header} (${column.id})` })),
    ];

    setSelectOptions(freezeLeftSelect, options);
    setSelectOptions(freezeRightSelect, options);

    const leftSelected = state.freeze.leftCount > 0 ? visibleColumns[state.freeze.leftCount - 1]?.id : undefined;
    const rightStartIndex = visibleColumns.length - state.freeze.rightCount;
    const rightSelected =
      state.freeze.rightCount > 0 && rightStartIndex >= 0 ? visibleColumns[rightStartIndex]?.id : undefined;

    freezeLeftSelect.value = leftSelected ?? 'none';
    freezeRightSelect.value = rightSelected ?? 'none';
    freezeInfo.textContent =
      `Frozen left: ${state.freeze.leftCount.toLocaleString()} · ` +
      `frozen right: ${state.freeze.rightCount.toLocaleString()}`;
  }

  // Initial render
  updateSummary();
  renderColumnsList(grid.getState().columns);
  lastConfigRef = grid.getState().config;
  syncColumnSizingUI();
  syncFreezeUI();
  syncPaginationUI();
  syncSortFilterUI();

  // Keep UI in sync with grid state
  const unsubscribe = grid.getStore().subscribe((state) => {
    updateSummary();

    if (lastColumnsRef !== state.columns) {
      lastColumnsRef = state.columns;
      renderColumnsList(state.columns);
      syncColumnSizingUI();
    }

    // Keep config inputs synced only when config changes elsewhere
    if (lastConfigRef !== state.config) {
      lastConfigRef = state.config;
      syncConfigInputs(state.config);
    }
    syncFreezeUI();
    syncPaginationUI();
    syncSortFilterUI();
  });

  return () => {
    unsubscribe();
    target.innerHTML = '';
    target.classList.remove('sg-sidepanel');
  };
}
