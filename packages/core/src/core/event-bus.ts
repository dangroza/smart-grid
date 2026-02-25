// =============================================================================
// Smart Grid — Event Bus
// Lightweight typed pub/sub. Zero dependencies.
// =============================================================================

import type { EventBus, EventHandler, GridEventName, GridEvents, Unsubscribe } from '../types';

/**
 * Creates a typed event bus for grid communication.
 *
 * All inter-layer communication flows through this bus.
 * Handlers are invoked synchronously in registration order.
 */
export function createEventBus(): EventBus {
  const handlers = new Map<GridEventName, Set<EventHandler<GridEventName>>>();

  function on<K extends GridEventName>(event: K, handler: EventHandler<K>): Unsubscribe {
    let set = handlers.get(event);
    if (!set) {
      set = new Set();
      handlers.set(event, set);
    }
    set.add(handler as EventHandler<GridEventName>);

    return () => off(event, handler);
  }

  function off<K extends GridEventName>(event: K, handler: EventHandler<K>): void {
    const set = handlers.get(event);
    if (set) {
      set.delete(handler as EventHandler<GridEventName>);
      if (set.size === 0) {
        handlers.delete(event);
      }
    }
  }

  function emit<K extends GridEventName>(event: K, payload: GridEvents[K]): void {
    const set = handlers.get(event);
    if (set) {
      // Iterate a copy to allow handler removal during emit
      for (const handler of [...set]) {
        handler(payload);
      }
    }
  }

  function destroy(): void {
    handlers.clear();
  }

  return { on, off, emit, destroy };
}
