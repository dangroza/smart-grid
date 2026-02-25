// =============================================================================
// Smart Grid — DOM Utilities
// Pure helper functions for DOM operations.
// =============================================================================

/**
 * Creates an element with a class name.
 */
export function createElement(
  tag: string,
  className: string,
): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/**
 * Applies cell content to an element.
 * Handles both string content (textContent) and HTMLElement content.
 */
export function applyCellContent(
  cell: HTMLElement,
  content: HTMLElement | string,
): void {
  // Clear existing content
  cell.textContent = '';

  if (typeof content === 'string') {
    cell.textContent = content;
  } else {
    cell.appendChild(content);
  }
}

/**
 * Sets a CSS custom property on an element.
 */
export function setCSSVar(
  el: HTMLElement,
  name: string,
  value: string,
): void {
  el.style.setProperty(name, value);
}
