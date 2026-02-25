// =============================================================================
// Smart Grid — Freeze Utilities Tests
// =============================================================================

import { describe, expect, it } from 'vitest';
import { buildFrozenRenderColumnIndexes, clampFreezeCounts } from './freeze-utils';

describe('freeze-utils', () => {
  it('clamps left/right counts to valid bounds', () => {
    expect(clampFreezeCounts(10, 3, 4)).toEqual({ leftCount: 3, rightCount: 4 });
    expect(clampFreezeCounts(10, 50, 4)).toEqual({ leftCount: 10, rightCount: 0 });
    expect(clampFreezeCounts(10, 3, 50)).toEqual({ leftCount: 3, rightCount: 7 });
  });

  it('returns center range when no freeze is active', () => {
    const indexes = buildFrozenRenderColumnIndexes(10, 3, 6, 0, 0);
    expect(indexes).toEqual([3, 4, 5]);
  });

  it('includes left frozen + center + right frozen without duplicates', () => {
    const indexes = buildFrozenRenderColumnIndexes(10, 2, 7, 3, 2);
    expect(indexes).toEqual([0, 1, 2, 3, 4, 5, 6, 8, 9]);
  });

  it('works with small ranges where center overlaps frozen zones', () => {
    const indexes = buildFrozenRenderColumnIndexes(6, 0, 2, 2, 2);
    expect(indexes).toEqual([0, 1, 4, 5]);
  });
});
