# Smart Grid - AI Coding Agent Instructions

## Project Overview

Smart grid management system — currently in initial design phase. No code yet; application description pending.

## Mandatory Process — Read Before ANY Work

Follow the three-phase design methodology in `docs/core-ui-addapted-design-instructions.md` (v3.0). Blocking requirements are in `docs/CRITICAL_REQUIREMENTS.md`.

### ⛔ Implementation Blockers (Cannot Write Code Until ALL Cleared)
1. **Design Pattern Selection** — Evaluate 2-3 patterns with pros/cons, get explicit human approval
2. **Clean Code Standards** — SOLID, SRP, TypeScript strict mode, accessibility-first, immutability
3. **Library Approval** — Every external dependency needs: justification, 2-3 alternatives evaluated, license verified, human approval
4. **NPM License Verification** — Only MIT/Apache-2.0/BSD/ISC without legal review. GPL/AGPL = blocked. Run `license-checker` in CI

### Three-Phase Workflow
- **Phase 1** (10-15%): Summarize understanding → ask clarifying questions → DO NOT propose solutions yet
- **Phase 2** (20-25%): Evaluate multiple approaches → create design docs → get approval before implementation
- **Phase 3** (60-65%): Stage 1 Foundation (MVP) → Stage 2 Refinement → Stage 3 Production

### Required Artifacts
- `{project}_design.md` — Full technical specification
- `{project}_design_notes.md` — Process journal, decision log, regeneration prompt
- `{project}_design_summary.md` — Executive summary for stakeholders
- `LICENSES.md` — All dependency licenses documented

## Code Conventions

- **TypeScript strict mode** required
- **Meaningful names** — variables, functions, components express intent
- **Single Responsibility** — one purpose per function/component
- **Pure functions** preferred, no direct state mutation
- **Explicit error handling** — no silent failures
- **Accessibility-first** — WCAG compliance from day one, not retrofitted
- **Mobile-first** responsive design
- **Semantic HTML** with proper ARIA attributes

## Key Files and Directories

- `/docs/core-ui-addapted-design-instructions.md` — Full AI design methodology (v3.0)
- `/docs/CRITICAL_REQUIREMENTS.md` — Blocking requirements quick reference
- `/.github/copilot-instructions.md` — This file

## Adding a New Dependency

```
STOP → Justify why needed → Evaluate 2-3 alternatives → Verify license (npm view <pkg> license)
→ Assess bundle size → Get human approval → Document in LICENSES.md
```

If functionality is <50 lines to build in-house → build it yourself.

---

*Update this file as architecture, tech stack, and conventions are established.*
