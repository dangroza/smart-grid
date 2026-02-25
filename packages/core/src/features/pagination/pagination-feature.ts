// =============================================================================
// Smart Grid — Pagination Feature
// Pipeline-based page slicing.
// =============================================================================

import type { FeatureModule, GridContext, PipelineStep } from '../../types';

const PAGINATION_STEP_ID = 'feature:pagination';
const PAGINATION_STEP_PRIORITY = 30;

export function createPaginationStep(): PipelineStep {
  return (data, state) => {
    const { page, pageSize } = state.pagination;

    // Disabled when page size is zero or negative.
    if (pageSize <= 0 || data.length === 0) {
      return data;
    }

    const safePageSize = Math.max(1, Math.floor(pageSize));
    const maxPage = Math.max(0, Math.ceil(data.length / safePageSize) - 1);
    const safePage = Math.min(Math.max(0, Math.floor(page)), maxPage);
    const start = safePage * safePageSize;
    const end = Math.min(start + safePageSize, data.length);

    if (start === 0 && end === data.length) {
      return data;
    }

    return data.slice(start, end);
  };
}

export function createPaginationFeature(): FeatureModule {
  let context: GridContext | null = null;

  function install(nextContext: GridContext): void {
    if (context) return;

    context = nextContext;
    context.pipeline.addStep(PAGINATION_STEP_ID, createPaginationStep(), PAGINATION_STEP_PRIORITY);
  }

  function destroy(): void {
    if (!context) return;

    context.pipeline.removeStep(PAGINATION_STEP_ID);
    context = null;
  }

  return {
    id: 'pagination',
    install,
    destroy,
  };
}
