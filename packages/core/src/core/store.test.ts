// =============================================================================
// Smart Grid — Data Store Tests
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { createStore } from './store';
import type { GridState } from '../types';

describe('DataStore', () => {
  it('should create with default state', () => {
    const store = createStore();
    const state = store.getState();

    expect(state.data).toEqual([]);
    expect(state.columns).toEqual([]);
    expect(state.config.rowHeight).toBe(40);
    expect(state.config.headerHeight).toBe(44);
    expect(state.config.overscanRows).toBe(10);
    expect(state.config.rowIdField).toBe('id');
  });

  it('should accept custom config', () => {
    const store = createStore({ rowHeight: 32, overscanRows: 5 });
    const state = store.getState();

    expect(state.config.rowHeight).toBe(32);
    expect(state.config.overscanRows).toBe(5);
    // Defaults preserved
    expect(state.config.headerHeight).toBe(44);
  });

  it('should update state immutably', () => {
    const store = createStore();
    const rows = [{ id: 1, name: 'Alice' }];

    store.update((prev) => ({ ...prev, data: rows }));

    expect(store.getState().data).toBe(rows);
  });

  it('should not notify if updater returns same reference', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.update((prev) => prev); // no-op

    expect(listener).not.toHaveBeenCalled();
  });

  it('should notify listeners on update', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.update((prev) => ({ ...prev, data: [{ id: 1 }] }));

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]![0].data).toEqual([{ id: 1 }]);
  });

  it('should unsubscribe correctly', () => {
    const store = createStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    unsub();
    store.update((prev) => ({ ...prev, data: [{ id: 1 }] }));

    expect(listener).not.toHaveBeenCalled();
  });

  it('should select derived state', () => {
    const store = createStore();
    store.update((prev) => ({ ...prev, data: [{ id: 1 }, { id: 2 }] }));

    const count = store.select((s) => s.data.length);
    expect(count).toBe(2);
  });

  it('should batch multiple updates into single notification', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.batch(() => {
      store.update((prev) => ({ ...prev, data: [{ id: 1 }] }));
      store.update((prev) => ({
        ...prev,
        sort: { criteria: [{ columnId: 'name', direction: 'asc' as const }] },
      }));
    });

    // Only one notification, not two
    expect(listener).toHaveBeenCalledOnce();
    const finalState = listener.mock.calls[0]![0] as GridState;
    expect(finalState.data).toEqual([{ id: 1 }]);
    expect(finalState.sort.criteria).toHaveLength(1);
  });

  it('should not notify on batch if no updates occurred', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.batch(() => {
      // No updates
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should support nested batches', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.batch(() => {
      store.update((prev) => ({ ...prev, data: [{ id: 1 }] }));
      store.batch(() => {
        store.update((prev) => ({ ...prev, data: [...prev.data, { id: 2 }] }));
      });
      // Inner batch should not trigger notification yet
      expect(listener).not.toHaveBeenCalled();
    });

    // One notification after outermost batch completes
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0]![0] as GridState).data).toHaveLength(2);
  });

  it('should ignore updates after destroy', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.destroy();
    store.update((prev) => ({ ...prev, data: [{ id: 1 }] }));

    expect(listener).not.toHaveBeenCalled();
    expect(store.getState().data).toEqual([]); // unchanged
  });
});
