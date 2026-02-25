// =============================================================================
// Smart Grid — DOM Renderer
// Element pool with recycling. No create/destroy during scroll.
// =============================================================================

import type {
  CellRendererFn,
  ColumnDef,
  ColumnId,
  DOMRenderer,
  Row,
  VisibleSlice,
} from '../types';
import {
  GROUP_ROW_COLUMN_ID_FIELD,
  GROUP_ROW_COUNT_FIELD,
  GROUP_ROW_EXPANDED_FIELD,
  GROUP_ROW_KEY_FIELD,
  GROUP_ROW_LABEL_FIELD,
  GROUP_ROW_LEVEL_FIELD,
  isGroupRow,
} from '../features/grouping/grouping-row';
import { createCellRendererRegistry } from './cell-renderer';
import { applyCellContent, createElement, setCSSVar } from './dom-utils';

/**
 * Creates the DOM renderer with element pooling and recycling.
 *
 * The renderer never creates or destroys elements during scroll.
 * Instead, it maintains a pool of row and cell elements that are
 * repositioned and updated with new content as the viewport changes.
 */
export function createDOMRenderer(): DOMRenderer {
  const cellRenderers = createCellRendererRegistry();

  // DOM structure
  let container: HTMLElement | null = null;
  let scrollContainer: HTMLElement | null = null;
  let headerContainer: HTMLElement | null = null;
  let bodyContainer: HTMLElement | null = null;
  let spacer: HTMLElement | null = null;

  // Element pool — reusable row and cell elements
  const rowPool: HTMLElement[] = [];
  const cellPool: Map<HTMLElement, HTMLElement[]> = new Map();

  function mount(target: HTMLElement): void {
    container = target;
    container.classList.add('sg-grid');

    // Header
    headerContainer = createElement('div', 'sg-grid__header');
    headerContainer.setAttribute('role', 'rowgroup');

    // Scroll container (this is what scrolls)
    scrollContainer = createElement('div', 'sg-grid__scroll-container');

    // Spacer (sets total scrollable area)
    spacer = createElement('div', 'sg-grid__spacer');

    // Body (contains visible rows, translated within spacer)
    bodyContainer = createElement('div', 'sg-grid__body');
    bodyContainer.setAttribute('role', 'rowgroup');

    scrollContainer.appendChild(spacer);
    scrollContainer.appendChild(bodyContainer);

    container.setAttribute('role', 'grid');
    container.setAttribute('aria-rowcount', '0');
    container.setAttribute('aria-colcount', '0');
    container.appendChild(headerContainer);
    container.appendChild(scrollContainer);
  }

  function render(slice: VisibleSlice): void {
    if (!container || !bodyContainer || !spacer || !scrollContainer || !headerContainer) return;

    const {
      rows,
      columns,
      columnIndexes,
      allColumnWidths,
      leftFrozenCount,
      rightFrozenCount,
      range,
      totalRows,
      rowOffset,
      columnOffset,
    } = slice;
    const visibleRowCount = range.endRow - range.startRow;
    const visibleColCount = columns.length;
    const totalVisibleCols = allColumnWidths.length;

    // Update ARIA counts
    container.setAttribute('aria-rowcount', String(totalRows));
    container.setAttribute('aria-colcount', String(totalVisibleCols));

    // Update spacer to set total scrollable area
    const rowHeight = parseInt(
      getComputedStyle(container).getPropertyValue('--sg-row-height') || '40',
    );
    const headerHeight = parseInt(
      getComputedStyle(container).getPropertyValue('--sg-header-height') || '44',
    );

    setCSSVar(spacer, '--sg-total-height', `${totalRows * rowHeight}px`);

    // Render header
    renderHeader(
      columns,
      columnIndexes,
      allColumnWidths,
      leftFrozenCount,
      rightFrozenCount,
      columnOffset,
      headerHeight,
    );

    // Ensure we have enough row elements in the pool
    ensureRowPool(visibleRowCount, visibleColCount);

    // Position the body container using translateY for the row offset
    setCSSVar(bodyContainer, '--sg-body-offset', `${rowOffset}px`);

    // Update each visible row
    for (let ri = 0; ri < visibleRowCount; ri++) {
      const row = rows[ri];
      const rowEl = rowPool[ri]!;
      const cells = cellPool.get(rowEl)!;
      const absoluteRowIndex = range.startRow + ri;
      const isGroup = !!row && isGroupRow(row);

      // Show this row element
      rowEl.style.display = '';

      // Update row attributes
      rowEl.setAttribute('aria-rowindex', String(absoluteRowIndex + 1)); // 1-based
      rowEl.classList.toggle('sg-grid__row--even', absoluteRowIndex % 2 === 0);
      rowEl.classList.toggle('sg-grid__row--odd', absoluteRowIndex % 2 !== 0);
      rowEl.classList.toggle('sg-grid__row--group', isGroup);

      // Update cells
      for (let ci = 0; ci < visibleColCount; ci++) {
        const col = columns[ci];
        const cellEl = cells[ci]!;

        // Show this cell
        cellEl.style.display = '';

        if (row && col) {
          if (isGroup) {
            if (ci === 0) {
              applyCellContent(cellEl, renderGroupCellContent(row, col));
            } else {
              applyCellContent(cellEl, '');
            }
          } else {
            const value = row[col.field];
            const content = cellRenderers.renderCell(value, row, col);
            applyCellContent(cellEl, content);
          }

          // Position cell via CSS (left offset + width)
          const colAbsoluteIndex = columnIndexes[ci] ?? 0;
          cellEl.setAttribute('aria-colindex', String(colAbsoluteIndex + 1));

          const cellLeft = getCellLeft(
            colAbsoluteIndex,
            allColumnWidths,
            leftFrozenCount,
            rightFrozenCount,
            scrollContainer,
            columnOffset,
          );

          setCSSVar(cellEl, '--sg-cell-left', `${cellLeft}px`);
          setCSSVar(cellEl, '--sg-cell-width', `${col.width}px`);

          cellEl.classList.toggle('sg-grid__cell--frozen-left', colAbsoluteIndex < leftFrozenCount);
          cellEl.classList.toggle(
            'sg-grid__cell--frozen-right',
            colAbsoluteIndex >= totalVisibleCols - rightFrozenCount,
          );
          cellEl.classList.toggle('sg-grid__cell--group-main', isGroup && ci === 0);
          cellEl.classList.toggle('sg-grid__cell--group-empty', isGroup && ci > 0);
        }
      }

      // Hide extra cells beyond visible columns
      for (let ci = visibleColCount; ci < cells.length; ci++) {
        cells[ci]!.style.display = 'none';
      }
    }

    // Hide extra rows beyond visible range
    for (let ri = visibleRowCount; ri < rowPool.length; ri++) {
      rowPool[ri]!.style.display = 'none';
    }
  }

  function renderHeader(
    columns: ReadonlyArray<ColumnDef>,
    columnIndexes: ReadonlyArray<number>,
    allColumnWidths: ReadonlyArray<number>,
    leftFrozenCount: number,
    rightFrozenCount: number,
    columnOffset: number,
    _headerHeight: number,
  ): void {
    if (!headerContainer || !scrollContainer) return;

    const visibleColCount = columns.length;
    const totalVisibleCols = allColumnWidths.length;
    const scrollLeft = scrollContainer.scrollLeft;

    // Ensure header has enough cells
    while (headerContainer.children.length < visibleColCount) {
      const cell = createElement('div', 'sg-grid__header-cell');
      cell.setAttribute('role', 'columnheader');
      cell.tabIndex = 0;
      const label = createElement('span', 'sg-grid__header-label');
      const resizeHandle = createElement('div', 'sg-grid__header-resize-handle');
      resizeHandle.setAttribute('role', 'separator');
      resizeHandle.setAttribute('aria-orientation', 'vertical');
      cell.appendChild(label);
      cell.appendChild(resizeHandle);
      headerContainer.appendChild(cell);
    }

    for (let ci = 0; ci < visibleColCount; ci++) {
      const col = columns[ci];
      const cell = headerContainer.children[ci] as HTMLElement;

      cell.style.display = '';

      if (col) {
        const label = cell.querySelector('.sg-grid__header-label') as HTMLElement | null;
        if (label) {
          label.textContent = col.header;
        }

        const colAbsoluteIndex = columnIndexes[ci] ?? 0;
        cell.setAttribute('data-column-id', col.id);
        cell.setAttribute('data-visible-col-index', String(colAbsoluteIndex));
        cell.setAttribute(
          'aria-label',
          `${col.header}. Alt+Arrow to resize. Alt+Shift+Arrow to reorder.`,
        );
        cell.draggable = false;
        cell.setAttribute('aria-colindex', String(colAbsoluteIndex + 1));

        const cellLeft = getCellLeft(
          colAbsoluteIndex,
          allColumnWidths,
          leftFrozenCount,
          rightFrozenCount,
          scrollContainer,
          columnOffset,
        );

        setCSSVar(cell, '--sg-cell-left', `${cellLeft - scrollLeft}px`);
        setCSSVar(cell, '--sg-cell-width', `${col.width}px`);

        cell.classList.toggle('sg-grid__header-cell--frozen-left', colAbsoluteIndex < leftFrozenCount);
        cell.classList.toggle(
          'sg-grid__header-cell--frozen-right',
          colAbsoluteIndex >= totalVisibleCols - rightFrozenCount,
        );
      }
    }

    // Hide extra header cells
    for (let ci = visibleColCount; ci < headerContainer.children.length; ci++) {
      (headerContainer.children[ci] as HTMLElement).style.display = 'none';
    }
  }

  function getCellLeft(
    absoluteColumnIndex: number,
    allColumnWidths: ReadonlyArray<number>,
    leftFrozenCount: number,
    rightFrozenCount: number,
    scrollerEl: HTMLElement,
    fallbackOffset: number,
  ): number {
    const prefix = buildPrefixSums(allColumnWidths);
    const totalColumns = allColumnWidths.length;

    if (absoluteColumnIndex < leftFrozenCount) {
      return scrollerEl.scrollLeft + (prefix[absoluteColumnIndex] ?? 0);
    }

    if (absoluteColumnIndex >= totalColumns - rightFrozenCount) {
      const totalWidth = prefix[prefix.length - 1] ?? 0;
      const rightOffset = totalWidth - (prefix[absoluteColumnIndex + 1] ?? totalWidth);
      const width = allColumnWidths[absoluteColumnIndex] ?? 0;
      return scrollerEl.scrollLeft + scrollerEl.clientWidth - rightOffset - width;
    }

    return prefix[absoluteColumnIndex] ?? fallbackOffset;
  }

  function buildPrefixSums(widths: ReadonlyArray<number>): number[] {
    const sums: number[] = [0];
    for (let i = 0; i < widths.length; i++) {
      sums.push((sums[i] ?? 0) + (widths[i] ?? 0));
    }
    return sums;
  }

  function ensureRowPool(rowCount: number, colCount: number): void {
    if (!bodyContainer) return;

    // Add rows to pool if needed
    while (rowPool.length < rowCount) {
      const rowEl = createElement('div', 'sg-grid__row');
      rowEl.setAttribute('role', 'row');
      bodyContainer.appendChild(rowEl);
      rowPool.push(rowEl);

      const cells: HTMLElement[] = [];
      cellPool.set(rowEl, cells);
    }

    // Ensure each row has enough cells
    for (let ri = 0; ri < rowCount; ri++) {
      const rowEl = rowPool[ri]!;
      const cells = cellPool.get(rowEl)!;

      while (cells.length < colCount) {
        const cellEl = createElement('div', 'sg-grid__cell');
        cellEl.setAttribute('role', 'gridcell');
        rowEl.appendChild(cellEl);
        cells.push(cellEl);
      }
    }
  }

  function renderGroupCellContent(row: Row, column: ColumnDef): HTMLElement {
    const wrapper = createElement('div', 'sg-grid__group-cell');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sg-grid__group-toggle';

    const key = row[GROUP_ROW_KEY_FIELD];
    if (typeof key === 'string') {
      button.setAttribute('data-group-key', key);
    }

    const level = row[GROUP_ROW_LEVEL_FIELD];
    const safeLevel = typeof level === 'number' && Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
    button.setAttribute('data-group-level', String(safeLevel));

    const expanded = row[GROUP_ROW_EXPANDED_FIELD] !== false;
    const icon = createElement('span', 'sg-grid__group-toggle-icon');
    icon.textContent = expanded ? '▾' : '▸';
    icon.setAttribute('aria-hidden', 'true');

    const labelRaw = row[GROUP_ROW_LABEL_FIELD];
    const countRaw = row[GROUP_ROW_COUNT_FIELD];
    const label = labelRaw === null || labelRaw === undefined ? '∅' : String(labelRaw);
    const count = typeof countRaw === 'number' && Number.isFinite(countRaw) ? Math.max(0, Math.floor(countRaw)) : 0;

    const groupingColumnId = row[GROUP_ROW_COLUMN_ID_FIELD];
    const groupingLabel = typeof groupingColumnId === 'string' ? groupingColumnId : column.header;
    const levelPrefix = safeLevel > 0 ? `${'• '.repeat(safeLevel)}` : '';
    const text = `${levelPrefix}${groupingLabel}: ${label} (${count})`;
    const labelEl = createElement('span', 'sg-grid__group-toggle-label');
    labelEl.textContent = text;

    button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} group ${label}`);
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.appendChild(icon);
    button.appendChild(labelEl);
    wrapper.appendChild(button);

    return wrapper;
  }

  function setCellRenderer(columnId: ColumnId, renderer: CellRendererFn): void {
    cellRenderers.setRenderer(columnId, renderer);
  }

  function destroy(): void {
    if (container) {
      container.innerHTML = '';
      container.classList.remove('sg-grid');
      container.removeAttribute('role');
      container.removeAttribute('aria-rowcount');
      container.removeAttribute('aria-colcount');
    }

    rowPool.length = 0;
    cellPool.clear();
    container = null;
    scrollContainer = null;
    headerContainer = null;
    bodyContainer = null;
    spacer = null;
  }

  return { mount, render, setCellRenderer, destroy };
}
