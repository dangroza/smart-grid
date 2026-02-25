# Smart Grid - AI Coding Agent Instructions

## Project Overview

Smart Grid — a high-performance, framework-agnostic headless data grid engine. Pure TypeScript (strict mode), zero runtime dependencies. Targets 50K+ rows at 60fps with virtual scrolling, decoupled data store, and plugin-based features.

## Architecture

**Layered Composition** — four independent layers connected by a typed event bus:

```
Consumer API → Data Store (immutable) → Data Pipeline (pure functions: filter→sort→group→paginate)
→ Virtual Scroller (visible range calc, rAF) → DOM Renderer (element pool, recycling, cell factory) → CSS Layer
```

- **Store** owns ALL state. Renderer is a pure consumer.
- **Pipeline** steps are memoized pure functions — unchanged inputs return cached output.
- **Features** (sort, filter, freeze, etc.) are self-contained modules that plug into specific layers via `FeatureModule` interface.
- **Cells** use a renderer factory `(data, row, col) => HTMLElement` — framework-agnostic.
- **CSS** is separated (custom properties + BEM), no inline styles from JS.

## Mandatory Process

Follow `docs/core-ui-addapted-design-instructions.md` (v3.0). Blocking requirements: `docs/CRITICAL_REQUIREMENTS.md`.

### ⛔ Implementation Blockers
1. **Design Pattern Selection** — Evaluate 2-3 patterns, get human approval (✅ Completed: Layered Composition + Feature Modules)
2. **Clean Code Standards** — SOLID, SRP, TypeScript strict, immutability, pure functions
3. **Library Approval** — Justify → evaluate 2-3 alternatives → verify license → get approval → document in `LICENSES.md`
4. **NPM License Verification** — Only MIT/Apache-2.0/BSD/ISC. GPL/AGPL = blocked.

## Code Conventions

- **TypeScript strict mode** — always
- **Pure functions** — no side effects, no direct mutation, `ReadonlyArray` for collections
- **Single Responsibility** — one purpose per function/module
- **Meaningful names** — express intent, no abbreviations
- **Explicit error handling** — no silent failures
- **Unit tests co-located** with feature modules (`feature.ts` + `feature.test.ts`)
- **CSS** — BEM naming (`.sg-grid__cell--frozen`), custom properties for theming, no inline styles

## Key Files and Directories

```
packages/core/src/
├── core/          — store.ts, event-bus.ts, pipeline.ts, grid.ts (orchestrator)
├── scroll/        — virtual-scroller.ts (range calc, scroll physics)
├── render/        — dom-renderer.ts (pool/recycling), cell-renderer.ts (factory)
├── features/      — sort/, filter/, pagination/, selection/, resize/, freeze/, grouping/, computed/, totals/
├── a11y/          — ARIA attribute management
├── i18n/          — translation support
├── css/           — smart-grid.css, variables.css, per-feature CSS
├── types.ts       — all type definitions
└── index.ts       — public API
```

Design docs: `docs/smart_grid_design.md`, `docs/smart_grid_design_notes.md`, `docs/smart_grid_design_summary.md`

## Incremental Roadmap

## Current Progress Snapshot (February 17, 2026)

- **Design phase:** Completed and implemented in code (Layered Composition + Feature Modules).
- **Stage 1 (Foundation):** Core modules implemented in `packages/core/src`:
	- Store (`core/store.ts`)
	- Event bus (`core/event-bus.ts`)
	- Pipeline (`core/pipeline.ts`)
	- Virtual scroller (`scroll/virtual-scroller.ts` + `scroll/scroll-utils.ts`)
	- DOM renderer + cell registry (`render/dom-renderer.ts`, `render/cell-renderer.ts`)
	- Grid orchestrator (`core/grid.ts`)
	- CSS layer (`css/smart-grid.css`, `css/variables.css`)
	- 50K row example app (`examples/basic`)
- **Stage 2 (Core Features):** Started.
	- Sort feature implemented and integrated (`features/sort/sort-feature.ts`).
	- Remaining Stage 2 features still open (filter, pagination, resize, reorder, selection, etc.).
- **Test status:** Current Vitest suite is passing (`npx vitest run`).
- **Process/compliance follow-ups:** Formal dependency/license documentation and CI license enforcement still pending (`LICENSES.md`, strict `license-check` pipeline).

- **Stage 1 (Foundation):** Mostly complete in code; basic keyboard/a11y hardening and explicit perf benchmarking remain.
- **Stage 2 (Core Features):** In progress (sort complete; filter/pagination/resize/reorder/selection pending).
- **Stage 3 (Advanced):** Freeze regions, Grouping, Row expansion, Computed columns, Totals, Infinite scroll
- **Stage 4 (Production):** Full a11y/i18n, Config persistence, npm packaging, CI/CD, docs

## Adding a New Dependency

```
STOP → Justify → Evaluate 2-3 alternatives → Verify license (npm view <pkg> license)
→ Assess bundle size → Get human approval → Document in LICENSES.md
```

If <50 lines to build in-house → build it yourself. This project targets zero runtime dependencies.

---

*Update this file as implementation progresses through stages.*
