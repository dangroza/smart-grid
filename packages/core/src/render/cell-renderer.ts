// =============================================================================
// Smart Grid — Cell Renderer
// Default cell rendering and renderer management.
// =============================================================================

import type { CellRendererFn, CellValue, ColumnDef, ColumnId, Row } from '../types';

/**
 * Default cell renderer — renders cell value as text content.
 */
export const defaultCellRenderer: CellRendererFn = (
  value: CellValue,
): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

/**
 * Manages per-column cell renderers with a default fallback.
 */
export function createCellRendererRegistry(): {
  getRenderer: (columnId: ColumnId) => CellRendererFn;
  setRenderer: (columnId: ColumnId, renderer: CellRendererFn) => void;
  renderCell: (value: CellValue, row: Row, column: ColumnDef) => HTMLElement | string;
} {
  const renderers = new Map<ColumnId, CellRendererFn>();

  function getRenderer(columnId: ColumnId): CellRendererFn {
    return renderers.get(columnId) ?? defaultCellRenderer;
  }

  function setRenderer(columnId: ColumnId, renderer: CellRendererFn): void {
    renderers.set(columnId, renderer);
  }

  function renderCell(value: CellValue, row: Row, column: ColumnDef): HTMLElement | string {
    // Column definition renderer takes precedence over registry
    const renderer = column.cellRenderer ?? getRenderer(column.id);
    return renderer(value, row, column);
  }

  return { getRenderer, setRenderer, renderCell };
}
