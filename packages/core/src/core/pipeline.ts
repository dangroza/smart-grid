// =============================================================================
// Smart Grid — Data Pipeline
// Composable chain of pure transformation functions with memoization.
// =============================================================================

import type { GridState, Pipeline, PipelineStep, Row } from '../types';

interface StepEntry {
  readonly id: string;
  readonly step: PipelineStep;
  readonly priority: number;
}

/**
 * Creates a data pipeline that transforms raw data through ordered steps.
 *
 * Steps are pure functions: (data, state) => data
 * Ordering is by priority (lower = runs first).
 * Each step is memoized — unchanged inputs return cached output.
 */
export function createPipeline(): Pipeline {
  let steps: StepEntry[] = [];
  let sorted = true;

  // Per-step memoization cache
  const cache = new Map<string, { input: ReadonlyArray<Row>; state: GridState; output: ReadonlyArray<Row> }>();

  function ensureSorted(): void {
    if (!sorted) {
      steps = [...steps].sort((a, b) => a.priority - b.priority);
      sorted = true;
    }
  }

  function addStep(id: string, step: PipelineStep, priority: number): void {
    // Remove existing step with same id
    steps = steps.filter((s) => s.id !== id);
    steps.push({ id, step, priority });
    sorted = false;
    cache.delete(id);
  }

  function removeStep(id: string): void {
    steps = steps.filter((s) => s.id !== id);
    cache.delete(id);
  }

  function process(data: ReadonlyArray<Row>, state: GridState): ReadonlyArray<Row> {
    ensureSorted();

    let current = data;

    for (const entry of steps) {
      const cached = cache.get(entry.id);

      // Cache hit: same input array reference and same state reference
      if (cached && cached.input === current && cached.state === state) {
        current = cached.output;
        continue;
      }

      const output = entry.step(current, state);
      cache.set(entry.id, { input: current, state, output });
      current = output;
    }

    return current;
  }

  function clear(): void {
    steps = [];
    sorted = true;
    cache.clear();
  }

  return { addStep, removeStep, process, clear };
}
