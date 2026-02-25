// =============================================================================
// Smart Grid — Event Bus Tests
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from './event-bus';

describe('EventBus', () => {
  it('should emit and receive events', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('sort:changed', handler);
    bus.emit('sort:changed', { criteria: [] });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ criteria: [] });
  });

  it('should support multiple handlers for the same event', () => {
    const bus = createEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('scroll', handler1);
    bus.on('scroll', handler2);
    bus.emit('scroll', { scrollTop: 100, scrollLeft: 0 });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('should unsubscribe via returned function', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    const unsubscribe = bus.on('scroll', handler);
    unsubscribe();
    bus.emit('scroll', { scrollTop: 0, scrollLeft: 0 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should unsubscribe via off()', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('scroll', handler);
    bus.off('scroll', handler);
    bus.emit('scroll', { scrollTop: 0, scrollLeft: 0 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not throw when emitting event with no handlers', () => {
    const bus = createEventBus();
    expect(() => bus.emit('scroll', { scrollTop: 0, scrollLeft: 0 })).not.toThrow();
  });

  it('should not throw when removing handler that was never added', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    expect(() => bus.off('scroll', handler)).not.toThrow();
  });

  it('should allow handler removal during emit without skipping', () => {
    const bus = createEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn(() => {
      bus.off('scroll', handler1);
    });
    const handler3 = vi.fn();

    bus.on('scroll', handler1);
    bus.on('scroll', handler2);
    bus.on('scroll', handler3);
    bus.emit('scroll', { scrollTop: 0, scrollLeft: 0 });

    // All three should fire on this emit (iterating a copy)
    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
    expect(handler3).toHaveBeenCalledOnce();

    // handler1 was removed, so next emit should not call it
    bus.emit('scroll', { scrollTop: 10, scrollLeft: 0 });
    expect(handler1).toHaveBeenCalledOnce(); // still 1
    expect(handler3).toHaveBeenCalledTimes(2);
  });

  it('should clean up all handlers on destroy', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('scroll', handler);
    bus.on('sort:changed', handler);
    bus.destroy();

    bus.emit('scroll', { scrollTop: 0, scrollLeft: 0 });
    bus.emit('sort:changed', { criteria: [] });

    expect(handler).not.toHaveBeenCalled();
  });
});
