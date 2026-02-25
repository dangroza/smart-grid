# Smart Grid — Technical Design Document

**Version:** 1.0  
**Date:** February 17, 2026  
**Status:** Phase 3 — Implementation In Progress (Stage 1 complete, Stage 2 started)  

---

## 1. Executive Summary

**Problem:** Existing data grid solutions (ag-grid, etc.) are framework-coupled, heavy, and opaque. There is no lightweight, framework-agnostic, headless grid engine built from scratch for extreme performance with backend-driven data operations.

**Solution:** Smart Grid — a pure TypeScript headless grid engine with:
- Decoupled data store and DOM renderer
- Virtual scrolling (row + column) targeting 50K+ rows
- Plugin-based feature system (sort, filter, pagination, grouping, etc.)
- Cell renderer factory for custom content (framework-agnostic)
- Clean separated CSS theming
- Incremental roadmap from MVP to production

**Key Principles:**
- Performance is non-negotiable — every architectural decision optimizes for speed
- Modularity through composition — small pure functions, plugin features
- Store owns state, renderer is a pure consumer
- Zero framework dependencies in core

---

## 2. Architecture Pattern Evaluation

### Pattern A: Monolithic Grid Class

A single `Grid` class managing data, state, rendering, events, and features.

| Aspect | Assessment |
|---|---|
| **Pros** | Simple mental model, fewer files, quick to start |
| **Cons** | Violates SRP, untestable in isolation, features tightly coupled, becomes unmaintainable at scale |
| **Performance** | No isolation — one slow feature blocks all |
| **Fit** | ❌ Rejected — cannot support 20+ features modularly |

### Pattern B: Plugin Architecture (Kernel + Plugins)

A thin kernel that manages lifecycle; all features are plugins that register hooks.

| Aspect | Assessment |
|---|---|
| **Pros** | Extremely modular, features are independent, easy to add/remove, tree-shakeable |
| **Cons** | Plugin coordination complexity, implicit dependencies between plugins, harder to reason about execution order |
| **Performance** | Good — unused features have zero cost |
| **Fit** | ⚠️ Viable but adds coordination overhead |

### Pattern C: Layered Composition (Store → Pipeline → Renderer)

Clear architectural layers with explicit boundaries. Each layer is a standalone module composed via interfaces. Features are modules that plug into specific layers.

| Aspect | Assessment |
|---|---|
| **Pros** | Clear data flow, each layer independently testable, functional composition, predictable performance, easy to profile per-layer |
| **Cons** | Requires careful interface design upfront |
| **Performance** | Excellent — layers can be optimized independently, renderer never touches raw data |
| **Fit** | ✅ Best fit for decoupled store + renderer requirement |

### **Recommendation: Pattern C (Layered Composition) with Pattern B elements (Feature Modules)**

**Rationale:**
- Layered architecture gives us the clean Store ↔ Renderer decoupling you described
- Feature modules (from Pattern B) plug into specific layers without kernel overhead
- Each layer has a single responsibility and is independently testable
- Performance profiling is trivial — measure each layer separately
- Aligns with functional programming (data flows through pure transformations)

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Consumer API                          │
│         SmartGrid.create(container, config)              │
└────────────────────────┬─────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌──────────┐
│  Data Store │  │   Feature   │  │  Event   │
│             │  │   Modules   │  │   Bus    │
│ • rows      │  │             │  │          │
│ • columns   │  │ • Sort      │  │ pub/sub  │
│ • filters   │  │ • Filter    │  │ typed    │
│ • selection │  │ • Paginate  │  │ events   │
│ • viewport  │  │ • Group     │  │          │
│ • config    │  │ • Select    │  │          │
│             │  │ • Freeze    │  │          │
│ immutable   │  │ • Compute   │  │          │
│ state       │  │ • Resize    │  │          │
└──────┬──────┘  └──────┬──────┘  └────┬─────┘
       │                │              │
       ▼                ▼              ▼
┌──────────────────────────────────────────────────────────┐
│                  Data Pipeline                           │
│                                                          │
│  Raw Data → Filter → Sort → Group → Compute → Paginate  │
│                                                          │
│  Pure functions, composable, cacheable                   │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼ (processed data slice)
┌──────────────────────────────────────────────────────────┐
│                  Virtual Scroller                        │
│                                                          │
│  • Calculates visible row/column range                   │
│  • Manages scroll position & offsets                     │
│  • Triggers render on scroll (requestAnimationFrame)     │
│  • Row + column virtualization                           │
│  • Overscan buffer (renders extra rows above/below)      │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼ (visible range + data)
┌──────────────────────────────────────────────────────────┐
│                  DOM Renderer                            │
│                                                          │
│  • DOM element pool (recycling, not create/destroy)      │
│  • Cell renderer factory (custom content)                │
│  • Freeze region management (sticky positioning)         │
│  • ARIA attributes & roles                               │
│  • CSS class application (no inline styles)              │
│  • Keyboard navigation handler                           │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                  CSS Layer                                │
│                                                          │
│  • CSS custom properties for theming                     │
│  • BEM naming convention                                 │
│  • Separated stylesheet (no JS-embedded styles)          │
│  • Modular per-feature CSS                               │
└──────────────────────────────────────────────────────────┘
```

### Data Flow (Unidirectional)

```
User Action → Event Bus → Feature Module → Store Update → Pipeline → Scroller → Renderer → DOM
```

No component ever mutates state directly. All changes flow through the store.

---

## 4. Core Module Design

### 4.1 Event Bus

Lightweight typed pub/sub. Zero dependencies.

```ts
// Core contract
type EventHandler<T> = (payload: T) => void;

interface EventBus {
  on<K extends keyof GridEvents>(event: K, handler: EventHandler<GridEvents[K]>): () => void;
  emit<K extends keyof GridEvents>(event: K, payload: GridEvents[K]>): void;
  off<K extends keyof GridEvents>(event: K, handler: EventHandler<GridEvents[K]>): void;
}
```

**Why custom, not a library:** ~30 lines of code, zero bundle cost, fully typed.

### 4.2 Data Store

Immutable state container. Functional updates only.

```ts
interface GridState {
  readonly data: ReadonlyArray<Row>;
  readonly columns: ReadonlyArray<ColumnDef>;
  readonly viewport: ViewportState;
  readonly sort: SortState;
  readonly filter: FilterState;
  readonly selection: SelectionState;
  readonly pagination: PaginationState;
  readonly config: GridConfig;
}

interface DataStore {
  getState(): GridState;
  update(updater: (prev: GridState) => GridState): void;
  subscribe(listener: (state: GridState) => void): () => void;
  select<T>(selector: (state: GridState) => T): T;
}
```

**Key decisions:**
- `ReadonlyArray` enforces immutability at type level
- `update()` takes a pure function — no mutation
- `subscribe()` returns an unsubscribe function (cleanup pattern)
- `select()` enables efficient derived state (memoizable)

### 4.3 Data Pipeline

Chain of pure transformation functions. Each step is independently testable and cacheable.

```ts
type PipelineStep<T> = (data: ReadonlyArray<T>, state: GridState) => ReadonlyArray<T>;

// Each step is a pure function
const filterStep: PipelineStep<Row> = (data, state) => { /* ... */ };
const sortStep: PipelineStep<Row> = (data, state) => { /* ... */ };
const groupStep: PipelineStep<Row> = (data, state) => { /* ... */ };
const paginateStep: PipelineStep<Row> = (data, state) => { /* ... */ };

// Pipeline composes steps
const pipeline = composePipeline([filterStep, sortStep, groupStep, paginateStep]);
```

**Caching:** Each step memoizes its output. If filter state hasn't changed, `filterStep` returns cached result — sort/group/paginate skip reprocessing unchanged data.

### 4.4 Virtual Scroller

Calculates which rows and columns are visible. Manages scroll physics.

```ts
interface VirtualScroller {
  readonly visibleRange: { startRow: number; endRow: number; startCol: number; endCol: number };
  attach(container: HTMLElement): void;
  detach(): void;
  scrollTo(row: number, col?: number): void;
  updateDimensions(rowHeights: number[], colWidths: number[]): void;
}
```

**Performance techniques:**
- `requestAnimationFrame` for scroll handling (no layout thrashing)
- Overscan buffer: render N extra rows above/below viewport to prevent flicker during fast scroll
- Scroll position tracking via `translateY` offset (single reflow, not per-row positioning)
- Column virtualization: only visible columns in DOM (critical for wide grids)

### 4.5 DOM Renderer

Manages a pool of reusable DOM elements. Never creates/destroys — only recycles.

```ts
interface CellRenderer {
  (data: CellData, row: RowData, column: ColumnDef): HTMLElement | string;
}

interface DOMRenderer {
  mount(container: HTMLElement): void;
  render(visibleData: VisibleSlice): void;
  destroy(): void;
  setCellRenderer(columnId: string, renderer: CellRenderer): void;
}
```

**DOM recycling:** A pool of `<div>` elements is pre-allocated. On scroll, instead of creating new elements, existing ones are repositioned and their content updated. This eliminates GC pressure — critical for 50K row smooth scrolling.

### 4.6 CSS Theming Layer

```css
/* smart-grid.css — all theming via custom properties */
.sg-grid {
  --sg-font-family: inherit;
  --sg-font-size: 14px;
  --sg-row-height: 40px;
  --sg-header-height: 44px;
  --sg-border-color: #e0e0e0;
  --sg-row-bg: #ffffff;
  --sg-row-bg-alt: #fafafa;
  --sg-row-bg-hover: #f0f4ff;
  --sg-row-bg-selected: #e3ecff;
  --sg-cell-padding: 0 12px;
  --sg-header-bg: #f8f9fa;
  --sg-header-font-weight: 600;
  --sg-focus-ring: 0 0 0 2px #4a90d9;
  /* ... extensible */
}
```

**Principles:**
- Every visual property controlled via CSS custom property
- BEM naming: `.sg-grid`, `.sg-grid__row`, `.sg-grid__cell`, `.sg-grid__header`
- No inline styles from JS — only class toggling (`.sg-grid__row--selected`, `.sg-grid__cell--frozen`)
- Separate CSS file — consumers override variables or replace the stylesheet entirely
- Per-feature CSS is modular (freeze.css, resize.css) — import only what you use

---

## 5. Feature Module Design

Each feature is a self-contained module that:
1. Registers event handlers on the bus
2. Reads/writes specific state slices via the store
3. May add a pipeline step
4. May add DOM behaviors to the renderer

```ts
interface FeatureModule {
  readonly id: string;
  install(context: GridContext): void;
  destroy(): void;
}

interface GridContext {
  store: DataStore;
  eventBus: EventBus;
  pipeline: Pipeline;
  renderer: DOMRenderer;
  scroller: VirtualScroller;
}
```

### Feature Inventory

| Feature | Layer(s) | Stage |
|---|---|---|
| **Sort** | Store + Pipeline | 2 |
| **Filter (FE)** | Store + Pipeline | 2 |
| **Filter (BE)** | Store + EventBus (delegates to consumer) | 2 |
| **Pagination** | Store + Pipeline | 2 |
| **Column Resize** | Renderer + Store | 2 |
| **Column Reorder** | Renderer + Store | 2 |
| **Bulk Selection** | Store + Renderer | 2 |
| **Freeze Regions** | Renderer (CSS sticky) | 3 |
| **Grouping** | Store + Pipeline + Renderer | 3 |
| **Row Expansion** | Renderer + Store | 3 |
| **Computed Columns** | Store + Pipeline | 3 |
| **Global/Page Totals** | Pipeline + Renderer | 3 |
| **Infinite Scroll** | Scroller + Store | 3 |
| **Column Hide/Show** | Store + Renderer | 3 |
| **Column Wrap** | Renderer + CSS | 3 |
| **Cell Lazy Loading** | Renderer + Store | 4 |
| **Config Dispatcher** | Store + EventBus | 4 |
| **Full a11y** | Renderer (ARIA, focus) | 4 |
| **Full i18n** | Store + Renderer | 4 |
| **Keyboard Navigation** | Renderer + EventBus | 2 (basic), 4 (full) |

---

## 6. State Management Pattern Evaluation

### Option A: Custom Immutable Store (Zustand-like, in-house)

Lightweight `getState/update/subscribe` pattern. ~50 lines.

| Aspect | Assessment |
|---|---|
| **Pros** | Zero dependencies, full control, tiny, perfectly fits our needs |
| **Cons** | No devtools out of the box, must build selector memoization |
| **Performance** | Excellent — minimal overhead, no middleware chain |

### Option B: Observable/Reactive Streams (RxJS-like)

State as observable streams, features subscribe to state slices.

| Aspect | Assessment |
|---|---|
| **Pros** | Powerful composition, built-in operators for debounce/throttle |
| **Cons** | Heavy dependency (~30KB), learning curve, overkill for predictable state |
| **Performance** | Good, but added overhead from stream machinery |

### Option C: Redux-like (Actions + Reducers)

Dispatched actions, reducer functions, middleware chain.

| Aspect | Assessment |
|---|---|
| **Pros** | Predictable, time-travel debugging possible, well-understood |
| **Cons** | Boilerplate-heavy, action/reducer ceremony, unnecessary for a library (not an app) |
| **Performance** | Good, but middleware chain adds latency per update |

### **Recommendation: Option A (Custom Immutable Store)**

**Rationale:**
- Zero dependency cost — critical for an npm package
- ~50 lines to build — well under the "build if <50 lines" threshold
- Immutable updates via pure functions = functional programming alignment
- Selector pattern with memoization gives us efficient derived state
- We control every optimization (batched updates, shallow comparison)
- No framework opinions — consumers aren't locked into any pattern

---

## 7. Project Structure

```
smart-grid/
├── docs/
│   ├── core-ui-addapted-design-instructions.md
│   ├── CRITICAL_REQUIREMENTS.md
│   ├── smart_grid_design.md              ← this document
│   ├── smart_grid_design_notes.md
│   └── smart_grid_design_summary.md
├── packages/
│   └── core/                             ← the grid engine
│       ├── src/
│       │   ├── index.ts                  ← public API
│       │   ├── types.ts                  ← all type definitions
│       │   ├── core/
│       │   │   ├── store.ts              ← immutable data store
│       │   │   ├── event-bus.ts          ← typed pub/sub
│       │   │   ├── pipeline.ts           ← data transformation chain
│       │   │   └── grid.ts               ← grid orchestrator (composes layers)
│       │   ├── scroll/
│       │   │   ├── virtual-scroller.ts   ← scroll physics + range calc
│       │   │   └── scroll-utils.ts       ← offset calculations
│       │   ├── render/
│       │   │   ├── dom-renderer.ts       ← DOM pool + recycling
│       │   │   ├── cell-renderer.ts      ← cell content factory
│       │   │   └── dom-utils.ts          ← DOM helpers
│       │   ├── features/
│       │   │   ├── sort/
│       │   │   │   ├── sort.ts
│       │   │   │   └── sort.test.ts
│       │   │   ├── filter/
│       │   │   │   ├── filter.ts
│       │   │   │   └── filter.test.ts
│       │   │   ├── pagination/
│       │   │   ├── selection/
│       │   │   ├── resize/
│       │   │   ├── reorder/
│       │   │   ├── freeze/
│       │   │   ├── grouping/
│       │   │   ├── computed/
│       │   │   ├── totals/
│       │   │   └── ...
│       │   ├── a11y/
│       │   │   └── aria.ts               ← ARIA attribute management
│       │   ├── i18n/
│       │   │   └── i18n.ts               ← translation support
│       │   └── css/
│       │       ├── smart-grid.css         ← base theme
│       │       ├── variables.css          ← custom properties
│       │       ├── freeze.css
│       │       └── resize.css
│       ├── tests/
│       │   ├── unit/
│       │   └── integration/
│       ├── package.json
│       └── tsconfig.json
├── examples/
│   └── basic/                            ← example app
│       ├── index.html
│       ├── main.ts
│       └── mock-data.ts
├── package.json                          ← workspace root
├── tsconfig.json                         ← base TS config
├── LICENSES.md
└── .github/
    └── copilot-instructions.md
```

---

## 8. Incremental Roadmap

### Implementation Status Snapshot (February 17, 2026)

- Stage 1 core architecture is implemented in `packages/core/src` (store, event bus, pipeline, virtual scroller, DOM renderer, orchestrator, CSS).
- 50K-row example app is implemented in `examples/basic`.
- Stage 2 has started with sort feature implementation (`features/sort/sort-feature.ts`) integrated via pipeline.
- Existing unit tests are passing in current repository state.
- Remaining Stage 2+ items below are still tracked as planned work.

### Stage 1 — Foundation (MVP)

**Goal:** Prove the architecture works. Render 50K rows smoothly. Establish all core patterns.

**Scope:**
- [ ] Data Store (immutable state, subscribe, select)
- [ ] Event Bus (typed pub/sub)
- [ ] Data Pipeline (compose, memoize — identity steps only)
- [ ] Virtual Scroller (row virtualization, overscan, `rAF` scroll)
- [ ] DOM Renderer (element pool, recycling, cell renderer factory)
- [ ] Column definitions (field, header, width, cellRenderer)
- [ ] CSS theming layer (custom properties, BEM, separated files)
- [ ] Basic keyboard navigation (arrow keys, tab, enter)
- [ ] Basic ARIA (grid role, row/cell roles, live regions)
- [ ] Grid orchestrator (`SmartGrid.create()` public API)
- [ ] Example app rendering 50K rows
- [ ] Unit tests for store, pipeline, scroller math

**Exit Criteria:** 50K rows render at 60fps scroll, architecture is clean, all core modules tested.

### Stage 2 — Core Features

**Goal:** Feature parity for common grid operations. Validate feature module pattern.

**Scope:**
- [ ] Column virtualization (row + column = full 2D virtualization)
- [ ] Sort module (FE + BE, multi-column, indicator UI)
- [ ] Filter module (FE + BE, per-column, decoupled filter store)
- [ ] Pagination module (page size, page number, offset calc)
- [ ] Column resize (drag handle, min/max width constraints)
- [ ] Column reorder (drag and drop)
- [ ] Bulk selection (checkbox column, select all, range select)
- [ ] Hide/show columns
- [ ] Basic keyboard navigation (column navigation, selection via keyboard)
- [ ] Page number display
- [ ] Unit + integration tests for all features

**Exit Criteria:** All core features work independently, can be composed, 50K rows still 60fps.

### Stage 3 — Advanced Features

**Goal:** Complex features that depend on Stage 2 foundations.

**Scope:**
- [ ] Freeze regions (top/bottom rows, left/right columns via CSS sticky)
- [ ] Grouping (collapsible groups, group headers, nested groups)
- [ ] Row expansion (inline expand below row, custom content renderer)
- [ ] Computed columns (configurable rules, external data, caching)
- [ ] Global totals (aggregate across full dataset)
- [ ] Page totals (aggregate across current page)
- [ ] Infinite scroll (append pages on scroll, virtual window)
- [ ] Column wrap (text wrapping, dynamic row height)
- [ ] Performance profiling & optimization pass

**Exit Criteria:** All advanced features work with 50K rows. No feature degrades scroll perf below 30fps.

### Stage 4 — Production & Polish

**Goal:** Production-ready npm package.

**Scope:**
- [ ] Full a11y audit (screen reader testing, WCAG AA compliance)
- [ ] Full i18n support (RTL, translations, locale-aware formatting)
- [ ] Full keyboard navigation (all features accessible via keyboard)
- [ ] Cell lazy loading with preloader component
- [ ] Config changes dispatcher (persist/restore grid state)
- [ ] npm packaging (ESM + CJS, tree-shaking, type declarations)
- [ ] API documentation
- [ ] Performance benchmark suite
- [ ] Example apps (basic, advanced, with Vue, with React)
- [ ] CI/CD (tests, license check, build, publish)

**Exit Criteria:** Publishable npm package, documented, tested, accessible, performant.

---

## 9. Performance Strategy

### Targets
| Metric | Target |
|---|---|
| Initial render (50K rows) | < 50ms |
| Scroll FPS | 60fps sustained |
| Sort (50K FE) | < 100ms |
| Filter (50K FE) | < 100ms |
| Memory (50K rows, 20 cols) | < 150MB |
| DOM nodes (viewport) | < 500 at any time |

### Techniques
1. **DOM recycling** — fixed pool, never create/destroy during scroll
2. **requestAnimationFrame** — all scroll handling batched to animation frame
3. **Pipeline memoization** — each step caches output, skips unchanged inputs
4. **Overscan buffer** — render 5-10 extra rows above/below viewport
5. **CSS containment** — `contain: strict` on grid container for layout isolation
6. **translateY positioning** — single offset transform, not per-row top values
7. **Passive scroll listeners** — `{ passive: true }` to avoid blocking main thread
8. **Batched state updates** — multiple store updates coalesced into single render
9. **Column virtualization** — only visible columns exist in DOM
10. **Object pooling** — reuse data structures, minimize GC pressure

---

## 10. Testing Strategy

### Unit Tests (Every module)
- **Store:** state updates, immutability, selectors, subscriptions
- **Event Bus:** subscribe, emit, unsubscribe, typed events
- **Pipeline:** each step in isolation, composition, memoization
- **Virtual Scroller:** range calculations, offset math, overscan
- **Feature modules:** each feature's state logic independently

### Integration Tests
- Store + Pipeline + Scroller working together
- Feature modules interacting (sort + filter + pagination)
- DOM Renderer producing correct structure

### Performance Tests
- 50K row render time benchmark
- Scroll FPS measurement
- Memory usage profiling
- Pipeline throughput (ops/sec for sort, filter)

### Tools
- **Vitest** — fast, TypeScript-native, ESM-first (MIT ✅)
- Test runner selection needs formal evaluation (see Open Questions)

---

## 11. Open Questions

1. **Test runner** — Vitest is the strong candidate but needs formal library evaluation per process
2. **Build tool** — esbuild/Rollup/Vite for library bundling — needs evaluation
3. **Variable row heights** — Stage 1 assumes fixed row height; dynamic heights add complexity to scroller
4. **Column virtualization threshold** — at what column count do we activate it? Configurable?
5. **Browser support matrix** — modern only (ES2020+)? Or IE11/legacy?

---

*Document updated to reflect active Phase 3 implementation progress.*
