# Design Notes: Smart Grid

**Process History:**
- Created: February 13, 2026 using design-create v3.0
- Phase 1 completed: February 13, 2026
- Phase 2 started: February 16, 2026
- Phase 3 started: February 17, 2026

**Current State:** Phase 3 — Implementation in progress (Stage 1 complete, Stage 2 started)

**Last Updated:** February 17, 2026

---

## 🔄 Regeneration Prompt

**Purpose:** Enable AI agent to restart design process from current state

**Current State:** Phase 3 — Active implementation

### Required Context:
- **Project:** Framework-agnostic headless grid engine (pure TypeScript)
- **Scale:** 50K+ rows, smooth 60fps scroll
- **Architecture:** Layered Composition — Store → Pipeline → Scroller → Renderer
- **State:** Custom immutable store (no dependencies)
- **Features:** Plugin-based modules (sort, filter, paginate, group, freeze, etc.)
- **CSS:** Separated, BEM, custom properties — no inline styles
- **Cell rendering:** Factory function returning DOM nodes (framework-agnostic)
- **Data ops:** Both frontend + backend filtering/sorting
- **Decoupled store:** Data management separate from visual rendering
- **Distribution:** npm package (eventually), example app in repo

### To Restart:
1. Read this design notes file
2. Read `smart_grid_design.md` (technical specification)
3. Read `docs/CRITICAL_REQUIREMENTS.md` (blocking requirements)
4. Follow `docs/core-ui-addapted-design-instructions.md` v3.0
5. Continue from Phase 2 approval or Phase 3 implementation

---

## 🔥 Key Issues & Decisions

**Last Updated:** Phase 2 — February 16, 2026

1. **TypeScript strict mode confirmed** — Zero runtime cost, critical for this scale of project — RESOLVED
2. **Layered Composition + Feature Modules** — Selected over monolithic and pure plugin architectures — RESOLVED
3. **Custom immutable store** — Selected over RxJS and Redux patterns; ~50 LOC, zero deps — RESOLVED
4. **DOM-based virtual scrolling** — Selected over canvas for a11y/i18n/CSS compatibility — RESOLVED
5. **Test runner selection** — Vitest adopted in repo and test suite is passing; formal alternatives/license documentation still pending — PARTIAL
6. **Build tool selection** — esbuild/Rollup/Vite for library output — needs evaluation — OPEN
7. **Browser support matrix** — Modern only (ES2020+)? Needs decision — OPEN

### Implementation Snapshot (February 17, 2026)

- Core architecture is implemented in code (`store`, `event-bus`, `pipeline`, `virtual-scroller`, `dom-renderer`, `grid` orchestrator).
- CSS base/variables are implemented and integrated.
- Example app renders 50K rows with virtualization (`examples/basic`).
- Sort feature module is implemented and integrated into pipeline/grid.
- Remaining Stage 2 features are not yet implemented (filter, pagination, resize/reorder, selection, etc.).

---

## Phase 1: Problem Structure & Understanding

**Created during design-create process (February 13, 2026)**

### Problem Presentation
User needs a high-performance, framework-agnostic grid component with features comparable to ag-grid but purpose-built for backend-driven data operations. Must handle 50K+ rows, be extremely modular, and follow functional programming principles.

### Initial Understanding
**AI's Understanding:**
Headless data grid engine — decoupled store and renderer, virtual scrolling, plugin-based features, cell renderer factory for custom content, clean CSS theming. Incremental roadmap from MVP to production npm package.

### Questions Asked (10 clarifying questions):
1. Framework-agnostic strategy (core engine vs Vue wrapper?)
2. Rendering engine (virtual scroll vs canvas vs WebGL?)
3. Backend-only filtering or both FE+BE?
4. Config changes dispatcher scope?
5. Row expansion behavior (inline vs overlay?)
6. Computed columns data sources?
7. Scale target (5K/50K/500K?)
8. Theming approach?
9. Distribution model?
10. Existing constraints?

### User Responses (Key decisions):
- **Framework:** Ignore frameworks for now, pure performance-first
- **TypeScript vs JS:** AI recommended TS (zero runtime cost) — accepted
- **Rendering:** Virtual scrolling in DOM (for a11y, i18n, CSS cleanliness)
- **Filtering:** Both FE + BE, decoupled store manages data, renderer shows clean text
- **Row expansion:** Inline below row, deferred to later stage
- **Computed columns:** Decoupled from renderer, store-level concern
- **Scale:** 50K rows
- **Theming:** Component rendering in cells solves complex cases, CSS separated
- **Distribution:** npm package (later), example in repo
- **Constraints:** Full freedom, performance is king
- **Cell lazy loading:** Preloader pattern, potentially decoupled

### Confirmed Design Philosophy:
- Performance is non-negotiable
- Modularity through composition and pure functions
- Store owns ALL state, renderer is pure consumer
- Zero framework dependencies in core
- Clean separated CSS (custom properties, BEM, no inline)
- Build in-house when <50 lines, evaluate libraries rigorously

---

## Phase 2: Solution Strategy & Design

**Created during design-create process (February 16, 2026)**

### Strategy Development

**Architecture Patterns Evaluated:**
1. **Monolithic Grid Class** — ❌ Rejected (violates SRP, untestable, unmaintainable)
2. **Plugin Architecture** — ⚠️ Viable (very modular but coordination overhead)
3. **Layered Composition** — ✅ Selected (clean data flow, independently testable layers)

**Final:** Layered Composition with Feature Module elements from Plugin pattern

**State Management Evaluated:**
1. **Custom Immutable Store** — ✅ Selected (~50 LOC, zero deps, perfect fit)
2. **RxJS Observables** — ❌ Too heavy (~30KB), overkill
3. **Redux-like** — ❌ Too ceremonial for a library

**Key Tradeoffs Accepted:**
- Fixed row height in Stage 1 (variable height deferred — adds scroller complexity)
- Column virtualization deferred to Stage 2 (row-only in Stage 1)
- Framework adapters completely deferred (pure TS core first)

### Design Documents Created:
- `smart_grid_design.md` — Full technical specification
- `smart_grid_design_notes.md` — This file
- `smart_grid_design_summary.md` — Executive summary

### Scaffolding Decisions:
- Row expansion design — [TBD - HIGH CONFIDENCE] — deferred to Stage 3
- Cell lazy loading pattern — [TBD - HIGH CONFIDENCE] — deferred to Stage 4
- i18n approach — [TBD - HIGH CONFIDENCE] — deferred to Stage 4
- Build tool selection — [TBD - HIGH CONFIDENCE] — evaluate at Stage 1 start
- Test runner — [TBD - HIGH CONFIDENCE] — evaluate at Stage 1 start

---

## Decision Log

### Decision 1: TypeScript Strict Mode
**Date:** February 13, 2026
**Context:** User questioned if vanilla JS would be faster
**Options:** TypeScript strict / JavaScript / TypeScript loose
**Decision:** TypeScript strict mode
**Rationale:** Zero runtime cost (compiles away), catches bugs at build time in complex virtualization logic, self-documenting API, refactoring safety for incremental development

### Decision 2: DOM-based Virtual Scrolling
**Date:** February 13, 2026
**Context:** Need viewport-only rendering for 50K rows
**Options:** Virtual scroll (DOM) / Canvas rendering / WebGL
**Decision:** DOM-based virtual scrolling with element recycling
**Rationale:** Full a11y support, i18n text reflow, CSS theming works naturally, keyboard navigation — user confirmed preference

### Decision 3: Layered Composition Architecture
**Date:** February 16, 2026
**Context:** Need extreme modularity with decoupled store and renderer
**Options:** Monolithic / Plugin / Layered Composition
**Decision:** Layered Composition (Store → Pipeline → Scroller → Renderer) with Feature Modules
**Rationale:** Clean unidirectional data flow, each layer independently testable and optimizable, aligns with functional programming, supports decoupled store requirement

### Decision 4: Custom Immutable Store
**Date:** February 16, 2026
**Context:** Need state management for grid data, config, and feature states
**Options:** Custom store / RxJS / Redux-like
**Decision:** Custom immutable store (~50 LOC)
**Rationale:** Zero dependency cost (critical for npm package), well under 50-line build threshold, immutable updates via pure functions match FP values, full control over optimization

---
