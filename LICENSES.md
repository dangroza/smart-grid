# Third-Party Dependency Review

## Added for performance comparison benchmark (March 3, 2026)

### Purpose
Create a separate comparison implementation using AG Grid Community + Vue 3 in `examples/aggrid-vue3` to benchmark against Smart Grid.

### Why dependency is justified
This is for side-by-side benchmarking against an established grid implementation. It is confined to an example workspace, not core runtime package.

### Alternatives evaluated
1. **Tabulator** — MIT, capable grid, but API/features differ significantly from AG Grid benchmark target.
2. **TanStack Table + custom virtualizer** — MIT, very flexible, but requires substantial glue code and is not a direct AG Grid comparison.
3. **Handsontable Community** — non-MIT/commercial constraints, not suitable for this repo policy.

### Selected
- `ag-grid-community` — MIT
- `ag-grid-vue3` — MIT
- `vue` — MIT
- `@vitejs/plugin-vue` — MIT

### License verification
- `npm view ag-grid-community license` → `MIT`
- `npm view ag-grid-vue3 license` → `MIT`
- `npm view vue license` → `MIT`
- `npm view @vitejs/plugin-vue license` → `MIT`

### Scope control
- Dependencies are used only in `examples/aggrid-vue3`.
- `packages/core` remains dependency-free at runtime.
