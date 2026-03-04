# Augmented Judgment UI — Project Vision

> A design and architecture reference for the intermediate phase between today's AI-assisted interfaces and fully agentic computing. The guiding principle: **humans want to see, analyze, and decide** — software should make that dramatically better, not replace it.

---

## 1. Context: Where We Are Today

Today's internet is fundamentally a **document-retrieval system wearing a productivity costume**. Even the most sophisticated SaaS apps are: state managed across a client-server boundary, rendered into a 2D grid of pixels, manipulated through pointer and keyboard.

The AI layer added so far sits *beside* this model, not inside it. The interface paradigm hasn't changed; only the smartness of what responds has.

**Current limitations:**
- Interfaces as forms — grids, inputs, modals, dashboards optimized for data entry and display, not thought
- Apps as silos — tools don't share context with each other
- AI as a reactive assistant — you pull, it responds
- The user as integrator — you are the connective tissue between all tools, copying, pasting, routing, deciding

**The core problem:** the human does both the legwork *and* the judgment. The intermediate phase separates these two things cleanly.

---

## 2. The Intermediate Phase: Augmented Judgment (2024–2032)

This is not about replacing human decisions. It is about making **human perception and decision-making dramatically better** by offloading the legwork — gathering, filtering, organizing, surfacing anomalies — and preserving the part that requires a human: **seeing clearly and deciding well.**

The constraint is no longer compute, storage, or connectivity. **The constraint is human attention and intent.** Every product that wins will win by radically reducing the cost of expressing what you want and getting it done.

### Core Design Principles

| Principle | What it means |
|---|---|
| **Legibility over automation** | The system's reasoning must be visible and understandable, not a black box |
| **Reversibility** | Every AI action must be easily undone; the user must never feel trapped |
| **Density with clarity** | Show more information, but make it easier to parse — signal, not minimalism |
| **Earned trust** | The system proves itself on small things before touching big ones |
| **Human initiative is sacred** | The AI never appears uninvited; the human decides when to invoke it |

---

## 3. What the Interface Actually Looks Like

### Intelligent surfaces, not blank canvases

The grid, the dashboard, the document — **these remain**. But they arrive pre-composed for the current context. Not a generic table of all records, but: *here are the items that need your attention today, ranked by urgency, with anomalies highlighted and the key decisions surfaced at the top.*

The human still sees the full picture. The AI did the prep work a good analyst would have done overnight.

### Inline AI, not sidebar AI

The chat window is a transitional crutch. Intelligence should be woven into the surface itself:
- Annotations appear beside data points that need explaining
- Suggested actions float near rows that need attention
- Summaries collapse complex sets into readable insights without hiding the underlying data

The visual stays rich. The human still reads and analyzes. The surface is simply **pre-understood** — waiting for the human's judgment.

### Dashboards that have a point of view

A dashboard shouldn't just display metrics. It should:
- Tell you what changed
- Offer a hypothesis for why it changed
- Indicate what it thinks you should look at next

The human still looks at the charts. But the charts come with a **prepared brief**, not raw data.

### Grids as annotated, not raw

- Rows have embedded context
- Outliers are marked
- Suggested actions are attached — available on hover or focus, never intrusive
- Natural language acts as a **lens over** the grid: *"show me only what's at risk"* reframes the view without replacing it

### Forms as guided conversations

Not a chatbot — a form that:
- Pre-fills intelligently from prior context
- Flags inconsistencies as you type
- Explains why each field matters when that isn't obvious
- Reduces cognitive overhead without removing control

### Multi-source synthesis as first-class

You don't jump between tabs. The app pulls relevant context from wherever it lives — email thread, related record, prior version — and presents it *beside* what you're working on. You see more without navigating more.

---

## 4. The Interaction Triad

The interface operates in three distinct modes. The user moves between them fluidly, always aware of which gear they're in.

```
┌─────────────────────────────────────────────────────────────┐
│                     AI MODE                                  │
│  Curated, annotated, contextually pre-composed surfaces     │
│  AI highlights, ranks, surfaces, suggests                   │
└─────────────────────────────────────────────────────────────┘
                            ↕ explicit mode switch
┌─────────────────────────────────────────────────────────────┐
│                   COMMAND INPUT                              │
│  Human initiative, inline, context-anchored                 │
│  Action precedes articulation                               │
└─────────────────────────────────────────────────────────────┘
                            ↕ explicit mode switch
┌─────────────────────────────────────────────────────────────┐
│                   MANUAL MODE                                │
│  Raw, unfiltered, pure direct manipulation                  │
│  No inference, no curation — ground truth view              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Command Input — Beyond the Text Box

The Cmd+K palette is the obvious answer but it's still a text box — you describe what you want. The more interesting territory is **demonstrating rather than describing.**

### Programming by Example

You don't type a command — you *do the thing once*, manually, and the system watches, infers the rule, and asks: *"apply this to all 340 matching rows?"*

- You move a row, reformat a cell, merge two fields
- The system surfaces the generalization
- Your manual action *is* the command
- You never had to articulate it

Action precedes articulation. The intelligence is in the interpretation of what you did.

### Selection + Transformation

- Select a set of things (rows, records, nodes)
- Then select a second thing — a template, a reference example, an existing row
- The system infers: *"transform the first selection toward the pattern of the second"*
- Two selections, no language, rich intent

### Markup-as-Command

You annotate the interface itself — circle a cluster, strike through a row, draw an arrow between two data points. The annotations *are* the instructions. The system interprets the marks.

This is closer to how a human would direct another human on paper. **Genuinely open territory** — not implemented anywhere well yet.

### Contextual Inline Command (when language is needed)

When natural language is the right tool:
- A minimal input appears **inline**, anchored to what you're focused on — not in a sidebar
- The system already knows the context (what you're looking at, what's selected)
- You don't have to describe the subject — you only supply the verb and intent
- It disappears after execution — no thread, no conversation history

This is not chat. It is a **single directed command fired from the point of attention.**

### The Key Distinction

| Human-initiated command | Agent-initiated action |
|---|---|
| Execute directly | Propose and wait for approval |
| Undo always available | Must be stoppable before execution |
| No approval gate | Explicit confirmation required |

The AI never generates the *idea* — it only interprets the intent the human already formed.

---

## 6. Manual Shift Gear Mode

This is a **first-class, explicit UI concept** — not a buried setting.

### What it does

- AI annotations retract completely
- No highlights, no suggested actions, no pre-composed views
- The interface returns to pure data and structure
- Filters, sorts, navigation — all direct manipulation, no inference
- The system stops anticipating and simply responds to explicit input

### Why it must be prominent

The mode switch is **visible and physical-feeling** — a persistent control in the peripheral view, always accessible. The user always knows which mode they're in. This is non-negotiable; hiding it defeats the purpose.

### Why manual mode matters

| Reason | Explanation |
|---|---|
| **Verification** | When AI has curated a view, you sometimes need raw, unfiltered data to verify you're not being misled by the curation |
| **Edge cases** | The AI's model of context is sometimes wrong; manual mode lets you work around it cleanly |
| **Cognitive rhythm** | Sometimes the discovery *is* the work — exploring without a prepared answer is how some thinking happens |
| **Trust calibration** | Using manual mode occasionally keeps you sharp and aware of what the data actually looks like |
| **Psychological safety** | The existence of manual mode makes users *trust* the AI mode more — like a manual transmission option in a car |

> The car analogy: you trust the automatic transmission most of the time, but you *can* downshift on a steep descent — and the fact that you *can* makes you trust the automatic more.

---

## 7. Interface Builder — Architecture

### Why generating HTML from scratch is wrong

- **Inconsistent** — every generated UI is a snowflake
- **Brittle** — no shared behavior, no guaranteed accessibility
- **Unmaintainable** — can't refactor what you can't reason about
- **Untestable** — no stable component contracts

### The right mental model

> **AI generates composition, not implementation.**

A typed component schema sits between AI intent and rendered UI.

```
Human intent
    ↓
AI generates → ComponentTree (typed JSON/TS schema)
    ↓
Framework renders → consistent, accessible, themeable UI
    ↓
Human can override schema directly (manual gear)
```

The AI never writes component internals. It only **composes** from a finite, well-defined vocabulary of components. It is a compiler from intent to schema — not a code generator.

### The Component Library as Stable Contract

The library defines:
- What components exist: `DataGrid`, `StatCard`, `FilterBar`, `DetailPanel`, `Timeline`, `SplitView`...
- What props they accept — **strictly typed**
- How they compose: `Stack`, `Split`, `Tabs`, `Overlay`...
- What events they emit

The AI learns this vocabulary and **never invents outside it**. When it needs something that doesn't exist, that is a signal to extend the framework — not generate ad-hoc HTML.

### Division of Responsibility

| The Framework owns | The AI owns |
|---|---|
| All interaction behavior | Which components to use |
| Accessibility | How to compose and arrange them |
| Theming and design tokens | What data to bind where |
| Responsiveness | What conditions govern visibility or emphasis |
| Performance (virtualization, lazy loading) | |
| State management contracts | |

### The Schema as Source of Truth

The schema — not the rendered output — is the source of truth.

- **Versionable and diffable** — you can see exactly what changed between two interface states
- **Auditable** — a human reviewing what the AI built reads the schema, not DOM output
- **Overridable** — manual mode edits the schema directly via a structured editor, not code
- **Transparent** — the AI's interface decisions are legible and correctable

A principal engineer can read it, override it, extend it, and version-control it. It is not a black box — it is a structured declaration of what the UI is.

---

## 8. Summary: The Design Frontier

The genuinely hard work in this phase is not building a chat interface and not automating everything. It is the subtle, difficult problem of knowing:

- **Exactly what the human needs to see**
- **At exactly the right moment**
- **To make the best possible decision**

And building interfaces that deliver that, consistently, while keeping the human firmly in control of when to look, what to conclude, and what to do next.

That is the real design frontier right now.

---

*Document compiled from design research and system architecture discussions. Internal reference for project planning.*
