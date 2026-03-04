# Smart Grid vs AG Grid (Vue 3) — Benchmark Comparison

**Date:** March 4, 2026  
**Dataset:** 50,000 rows × 50 columns  
**Runs per scenario:** 10 (recommended)

## Apps

- Smart Grid baseline: [examples/basic](../examples/basic)
- AG Grid Vue 3 benchmark: [examples/aggrid-vue3](../examples/aggrid-vue3)

## How to run

1. Start one app at a time in the same browser/environment.
2. Use the benchmark bar/buttons in each app.
3. For each scenario, run at least 10 times.
4. Record median and p95 from the in-app benchmark table.

Commands:

- `npm run dev:basic`
- `npm run dev:aggrid`

## Scenario definitions

- `dataset:generate` — dataset generation time before mount
- `sort:salary-desc` — apply descending sort to salary column
- `filter:*` — apply text filter
- `filter:clear` — clear active filter

---

## Results (fill from in-app benchmark table)

| Scenario | Smart Grid Last (ms) | Smart Grid Median (ms) | Smart Grid P95 (ms) | AG Grid Last (ms) | AG Grid Median (ms) | AG Grid P95 (ms) |
|---|---:|---:|---:|---:|---:|---:|
| dataset:generate |  |  |  |  |  |  |
| sort:salary-desc |  |  |  |  |  |  |
| filter:quick:alice (or equivalent) |  |  |  |  |  |  |
| filter:clear |  |  |  |  |  |  |

## Notes

- Keep browser version, machine power mode, and tab conditions the same.
- Ignore first-run warm-up outliers if needed.
- AG Grid bundle is significantly larger in current setup; compare runtime behavior, not bundle size in this table.
