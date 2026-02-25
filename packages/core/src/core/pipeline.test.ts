// =============================================================================
// Smart Grid — Data Pipeline Tests
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { createPipeline } from './pipeline';
import type { GridState, Row } from '../types';

// Minimal mock state for pipeline testing
const mockState = {} as GridState;

function makeRows(count: number): ReadonlyArray<Row> {
  return Array.from({ length: count }, (_, i) => ({ id: i, value: `row-${i}` }));
}

describe('Pipeline', () => {
  it('should return input data when no steps are added', () => {
    const pipeline = createPipeline();
    const data = makeRows(3);

    const result = pipeline.process(data, mockState);

    expect(result).toBe(data); // same reference
  });

  it('should apply a single step', () => {
    const pipeline = createPipeline();
    const data = makeRows(5);
    const filterStep = vi.fn((rows: ReadonlyArray<Row>) =>
      rows.filter((r) => (r['id'] as number) < 3),
    );

    pipeline.addStep('filter', filterStep, 10);
    const result = pipeline.process(data, mockState);

    expect(result).toHaveLength(3);
    expect(filterStep).toHaveBeenCalledOnce();
  });

  it('should apply steps in priority order', () => {
    const pipeline = createPipeline();
    const data = makeRows(5);
    const order: string[] = [];

    pipeline.addStep('second', (rows) => {
      order.push('second');
      return rows;
    }, 20);

    pipeline.addStep('first', (rows) => {
      order.push('first');
      return rows;
    }, 10);

    pipeline.addStep('third', (rows) => {
      order.push('third');
      return rows;
    }, 30);

    pipeline.process(data, mockState);

    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('should chain step outputs as next step inputs', () => {
    const pipeline = createPipeline();
    const data: ReadonlyArray<Row> = [
      { id: 3 },
      { id: 1 },
      { id: 2 },
    ];

    // Filter: keep id > 1
    pipeline.addStep('filter', (rows) =>
      rows.filter((r) => (r['id'] as number) > 1),
    10);

    // Sort: ascending
    pipeline.addStep('sort', (rows) =>
      [...rows].sort((a, b) => (a['id'] as number) - (b['id'] as number)),
    20);

    const result = pipeline.process(data, mockState);

    expect(result).toEqual([{ id: 2 }, { id: 3 }]);
  });

  it('should memoize step output when inputs unchanged', () => {
    const pipeline = createPipeline();
    const data = makeRows(3);
    const step = vi.fn((rows: ReadonlyArray<Row>) => rows);

    pipeline.addStep('identity', step, 10);

    pipeline.process(data, mockState);
    pipeline.process(data, mockState); // same inputs

    // Step should only execute once due to memoization
    expect(step).toHaveBeenCalledOnce();
  });

  it('should invalidate cache when input data changes', () => {
    const pipeline = createPipeline();
    const step = vi.fn((rows: ReadonlyArray<Row>) => rows);

    pipeline.addStep('identity', step, 10);

    pipeline.process(makeRows(3), mockState);
    pipeline.process(makeRows(3), mockState); // new array reference

    expect(step).toHaveBeenCalledTimes(2);
  });

  it('should remove a step', () => {
    const pipeline = createPipeline();
    const data = makeRows(5);

    pipeline.addStep('filter', (rows) => rows.filter((r) => (r['id'] as number) < 3), 10);
    pipeline.removeStep('filter');

    const result = pipeline.process(data, mockState);

    expect(result).toHaveLength(5);
  });

  it('should replace step when adding with same id', () => {
    const pipeline = createPipeline();
    const data = makeRows(5);

    pipeline.addStep('filter', (rows) => rows.filter((r) => (r['id'] as number) < 3), 10);
    pipeline.addStep('filter', (rows) => rows.filter((r) => (r['id'] as number) < 2), 10);

    const result = pipeline.process(data, mockState);

    expect(result).toHaveLength(2); // replaced filter
  });

  it('should clear all steps', () => {
    const pipeline = createPipeline();
    const data = makeRows(5);

    pipeline.addStep('filter', (rows) => rows.slice(0, 1), 10);
    pipeline.clear();

    const result = pipeline.process(data, mockState);

    expect(result).toHaveLength(5);
  });
});
