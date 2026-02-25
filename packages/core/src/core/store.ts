// =============================================================================
// Smart Grid — Data Store
// Immutable state container with batched updates and subscriptions.
// =============================================================================

import type {
  DataStore,
  GridConfig,
  GridState,
  StateListener,
  StateUpdater,
  Unsubscribe,
} from '../types';

/** Default configuration values */
const DEFAULT_CONFIG: GridConfig = {
  rowHeight: 40,
  headerHeight: 44,
  heightMode: 'fixed',
  height: 600,
  overscanRows: 10,
  overscanColumns: 5,
  rowIdField: 'id',
};

/** Creates the initial empty grid state */
function createInitialState(config?: Partial<GridConfig>): GridState {
  const mergedConfig: GridConfig = { ...DEFAULT_CONFIG, ...config };
  return {
    data: [],
    columns: [],
    processedData: [],
    viewport: {
      scrollTop: 0,
      scrollLeft: 0,
      containerWidth: 0,
      containerHeight: 0,
      visibleRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
    },
    sort: { criteria: [] },
    filter: { criteria: [], mode: 'client' },
    selection: { selectedIds: new Set(), allSelected: false },
    pagination: { page: 0, pageSize: 0, totalRows: 0 },
    freeze: { leftCount: 0, rightCount: 0 },
    grouping: { columnIds: [], collapsedKeys: new Set() },
    config: mergedConfig,
  };
}

/**
 * Creates an immutable data store.
 *
 * The store owns ALL grid state. Updates are functional — the updater
 * receives the previous state and returns a new state object.
 * Listeners are notified after each update (or after a batch completes).
 */
export function createStore(initialConfig?: Partial<GridConfig>): DataStore {
  let state: GridState = createInitialState(initialConfig);
  const listeners = new Set<StateListener>();
  let batchDepth = 0;
  let batchDirty = false;
  let destroyed = false;

  function getState(): GridState {
    return state;
  }

  function notify(): void {
    for (const listener of [...listeners]) {
      listener(state);
    }
  }

  function update(updater: StateUpdater): void {
    if (destroyed) return;

    const nextState = updater(state);

    // Skip if updater returned the same reference (no change)
    if (nextState === state) return;

    state = nextState;

    if (batchDepth > 0) {
      batchDirty = true;
    } else {
      notify();
    }
  }

  function subscribe(listener: StateListener): Unsubscribe {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function select<T>(selector: (s: GridState) => T): T {
    return selector(state);
  }

  function batch(fn: () => void): void {
    batchDepth++;
    try {
      fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0 && batchDirty) {
        batchDirty = false;
        notify();
      }
    }
  }

  function destroy(): void {
    destroyed = true;
    listeners.clear();
  }

  return { getState, update, subscribe, select, batch, destroy };
}
