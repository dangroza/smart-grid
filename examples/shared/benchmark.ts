export interface BenchmarkSummary {
  readonly label: string;
  readonly runs: number;
  readonly lastMs: number;
  readonly medianMs: number;
  readonly p95Ms: number;
}

export interface BenchmarkTracker {
  addSample(label: string, durationMs: number): void;
  measure(label: string, action: () => void | Promise<void>, settleFrames?: number): Promise<number>;
  getSummaries(): ReadonlyArray<BenchmarkSummary>;
}

export function createBenchmarkTracker(): BenchmarkTracker {
  const samples = new Map<string, number[]>();

  function addSample(label: string, durationMs: number): void {
    const safeDuration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
    const existing = samples.get(label) ?? [];
    existing.push(safeDuration);
    samples.set(label, existing.slice(-30));
  }

  async function measure(
    label: string,
    action: () => void | Promise<void>,
    settleFrames = 2,
  ): Promise<number> {
    const start = performance.now();
    await action();
    await waitForFrames(settleFrames);
    const duration = performance.now() - start;
    addSample(label, duration);
    return duration;
  }

  function getSummaries(): ReadonlyArray<BenchmarkSummary> {
    return [...samples.entries()]
      .map(([label, values]) => {
        const ordered = [...values].sort((a, b) => a - b);
        return {
          label,
          runs: values.length,
          lastMs: values[values.length - 1] ?? 0,
          medianMs: percentile(ordered, 0.5),
          p95Ms: percentile(ordered, 0.95),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  return {
    addSample,
    measure,
    getSummaries,
  };
}

function waitForFrames(count: number): Promise<void> {
  const frames = Math.max(1, Math.floor(count));

  return new Promise((resolve) => {
    let remaining = frames;

    const step = (): void => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
        return;
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  });
}

function percentile(sortedValues: ReadonlyArray<number>, p: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0] ?? 0;
  }

  const clamped = Math.min(1, Math.max(0, p));
  const index = (sortedValues.length - 1) * clamped;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower] ?? 0;
  }

  const lowerValue = sortedValues[lower] ?? 0;
  const upperValue = sortedValues[upper] ?? lowerValue;
  const weight = index - lower;

  return lowerValue + (upperValue - lowerValue) * weight;
}
