# Smart Grid — Design Summary

**Date:** February 27, 2026  
**Status:** Implementation In Progress — Stage 1 complete, Stage 2 mostly complete, Stage 3 partially started  

---

## What

A high-performance, framework-agnostic headless data grid engine. Pure TypeScript, zero dependencies. Think ag-grid — but modular, lightweight, and built for backend-driven data operations at scale.

## Why

Existing grid solutions are framework-coupled, monolithic, and opaque. Smart Grid decouples data management from rendering, enabling extreme performance and flexibility.

## Architecture

**Layered Composition:** Four independent layers connected by a typed event bus.

| Layer | Responsibility |
|---|---|
| **Data Store** | Immutable state container — all grid state lives here |
| **Data Pipeline** | Pure function chain: filter → sort → group → paginate (memoized) |
| **Virtual Scroller** | Calculates visible rows/columns, manages scroll physics |
| **DOM Renderer** | Element pool with recycling, cell factory, CSS class toggling |

Features (sort, filter, resize, etc.) are self-contained modules that plug into specific layers.

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript strict | Zero runtime cost, catches bugs in complex virtualization |
| Framework | None (headless) | Pure core, framework adapters later |
| Rendering | DOM virtual scroll | a11y, i18n, CSS theming compatibility |
| State | Custom immutable store | ~50 LOC, zero deps, functional |
| Styling | Separated CSS + custom properties | No inline styles, fully customizable |
| Cell content | Renderer factory (returns DOM nodes) | Framework-agnostic, consumers mount anything |

## Roadmap

| Stage | Scope | Goal |
|---|---|---|
| **1 — Foundation** | Store, Pipeline, Scroller, Renderer, CSS, basic a11y | 50K rows at 60fps |
| **2 — Core Features** | Sort, Filter, Paginate, Resize, Reorder, Selection, Column virtualization | Feature parity for common ops |
| **3 — Advanced** | Freeze, Grouping, Row expansion, Computed columns, Totals, Infinite scroll | Complex features on solid foundation |
| **4 — Production** | Full a11y, i18n, Config persistence, npm packaging, Docs, CI/CD | Publishable package |

## Current Progress Snapshot (February 27, 2026)

- **Stage 1 Foundation:** Implemented in `packages/core/src` (store, event bus, pipeline, virtual scroller, DOM renderer, grid orchestrator, CSS).
- **Example app:** 50K × 50 demo in `examples/basic` with advanced side panel controls.
- **Stage 2 implemented features:** sorting, filtering, pagination, column resize, column reorder, fixed/fill column sizing, height mode (`auto`/`fixed`).
- **Stage 3 features already implemented early:** left/right freeze and grouping (including expandable/collapsible group rows).
- **Tests:** Vitest suite passing (unit + integration coverage for core pipeline/features).
- **Open (highest priority):** selection, keyboard/a11y hardening depth, column virtualization hardening, advanced stage remainder (row expansion/computed/totals/infinite scroll), packaging/license automation.

## Available Features & Configuration

### Initialization (`createGrid(options)`)

- **Data/columns:** `data`, `columns`
- **View config:** `rowHeight`, `headerHeight`, `overscanRows`, `overscanColumns`, `rowIdField`, `height`
	- `height` supports numeric fixed height or `'auto'`
- **Initial feature state:**
	- `initialSort`
	- `initialFilter`, `initialFilterMode`
	- `initialPagination`
	- `initialFreeze`
	- `initialGrouping`
- **Extensibility:** `features` (feature modules)

### Runtime API (`SmartGridAPI`)

- **Dataset/columns/config:** `setData`, `setColumns`, `setConfig`
- **Sort/filter/pagination:** `setSort`/`clearSort`, `setFilter`/`clearFilter`, `setPagination`/`clearPagination`
- **Freeze:** `setFrozenColumns`, `freezeLeftTo`, `freezeRightFrom`, `clearFreeze`
- **Grouping:** `setGrouping`, `clearGrouping`, `toggleGroup`
- **Columns:** `resizeColumn`, `reorderColumn`
- **Navigation/lifecycle:** `scrollTo`, `destroy`

### Column sizing model

- **Base width:** `width`
- **Fixed columns:** `fixedWidth: true` (excluded from fill-width distribution)
- **Fill columns:** `flexGrow > 0` (receives proportional remaining width)
- **Resize constraints:** `minWidth`/`maxWidth`, `resizable`

### Example side panel coverage

The example side panel exposes runtime controls for:

- Dataset size and column count
- Column visibility
- Grid dimensions and overscan
- Height mode + fixed height
- Column sizing (`width`, `fixedWidth`, `flexGrow`)
- Freeze left/right boundaries
- Grouping (primary/secondary + expand/collapse)
- Sort criteria
- Filter mode and criteria
- Pagination page/page size

## Remaining TODO (feature roadmap)

1. **Selection feature (Stage 2)**
2. **Column virtualization hardening + keyboard navigation depth (Stage 2/4 overlap)**
3. **Row expansion (Stage 3)**
4. **Computed columns (Stage 3)**
5. **Global/page totals (Stage 3)**
6. **Infinite scroll (Stage 3)**
7. **Full a11y + i18n + config persistence + packaging/license CI (Stage 4)**

## Performance Targets

- **50K rows** rendered at **60fps** sustained scroll
- **< 50ms** initial render
- **< 500 DOM nodes** in viewport at any time
- **< 100ms** for frontend sort/filter on 50K rows

## Benchmark Comparison Example

An AG Grid Community + Vue 3 comparison app is available at:

- [examples/aggrid-vue3](examples/aggrid-vue3)

Run commands:

- `npm run dev:basic` (Smart Grid baseline)
- `npm run dev:aggrid` (AG Grid Vue benchmark)

The AG Grid example includes quick benchmark controls (sort/filter/clear) and timing logs to support side-by-side manual comparison.

---

*Full specification: `smart_grid_design.md`*  
*Process journal: `smart_grid_design_notes.md`*
