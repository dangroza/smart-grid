# 🚨 CRITICAL REQUIREMENTS - Quick Reference

**For:** AI-Assisted Web Application Design Instructions v3.0
**Date:** December 8, 2025

---

## ⛔ BLOCKING REQUIREMENTS (Must Complete Before Implementation)

### 1. Design Pattern Selection ⛔
**Status:** MANDATORY - Implementation BLOCKED until completed

**Requirements:**
- [ ] Evaluate 2-3 industry-standard patterns
- [ ] Document pros/cons for each option
- [ ] Recommend pattern with explicit rationale
- [ ] Get human approval

**Pattern Categories to Consider:**
- Component Architecture (Atomic Design, Container/Presentational, etc.)
- State Management (Flux/Redux, Observer, Command, Repository)
- Application Architecture (MVC/MVVM, Feature-Sliced, Layered, Micro-frontends)

**Checkpoint:**
```
"Before implementation, which design pattern should we use?
I've evaluated [A], [B], [C]. Recommending [X] because [rationale].
Approved?"
```

---

### 2. Clean Code Compliance ⛔
**Status:** MANDATORY - All code must follow these principles

**Non-Negotiable Standards:**
- ✅ Meaningful names (variables, functions, components express intent)
- ✅ Single Responsibility (one purpose per function/component)
- ✅ Small functions (do one thing well)
- ✅ DRY Principle (extract reusable patterns)
- ✅ SOLID Principles
- ✅ Pure functions preferred (no side effects)
- ✅ Immutability (no direct state mutation)
- ✅ Explicit error handling

**Web-Specific Best Practices:**
- ✅ Accessibility-First (WCAG from day one)
- ✅ Performance Budgets (defined and enforced)
- ✅ Mobile-First design
- ✅ Progressive Enhancement
- ✅ Semantic HTML
- ✅ Component Testing
- ✅ TypeScript Strict Mode
- ✅ Code Splitting

---

### 3. External Library Approval ⛔
**Status:** MANDATORY - NEVER use library without approval

**Before ANY library usage:**
1. ⛔ **STOP** - Do not proceed without approval
2. ✅ **Justify** - Why needed? Can't build in-house?
3. ✅ **Evaluate** - Compare 2-3 alternatives
4. ✅ **Verify License** - Commercial use compatible? (see #4)
5. ✅ **Assess Impact** - Bundle size, maintenance status
6. ✅ **Get Approval** - Explicit human consent

**Template:**
```
"For [functionality], I need [library] because [can't reasonably build].

Evaluated options:
1. [Library A] - [pros/cons] - License: [type] ✅/❌
2. [Library B] - [pros/cons] - License: [type] ✅/❌
3. Build in-house - [effort] - [pros/cons]

Recommendation: [choice]
Rationale: [why]

LICENSE VERIFIED: ✅ Commercial use compatible

Approved?"
```

**Red Flag - Challenge:**
```
"WAIT - We're adding [library] for [simple task].
Can we implement this ourselves in <50 lines?
Bundle impact: [size]. Worth it?"
```

---

### 4. 🚨 NPM Licensing Verification ⛔
**Status:** HIGHEST PRIORITY - BLOCKING FOR COMMERCIAL USE

**ABSOLUTE RULE:**
**ALL dependencies MUST be verified for commercial use compatibility**

**Process (MANDATORY for EVERY dependency):**
1. ✅ Verify license type (`npm view package license`)
2. ✅ Confirm commercial use permitted
3. ✅ Check license compatibility
4. ✅ Document in `LICENSES.md`
5. ✅ Monitor for license changes

**✅ SAFE Licenses (Commercial Use Allowed):**
- MIT
- Apache 2.0
- BSD (2-Clause, 3-Clause)
- ISC
- 0BSD

**⚠️ REQUIRES LEGAL REVIEW:**
- GPL (v2, v3) - ⚠️ May block proprietary use
- AGPL - ⚠️ Very restrictive for web services
- LGPL - ⚠️ Depends on linking method
- MPL 2.0 - ⚠️ File-level copyleft
- EPL - ⚠️ Needs review

**❌ NEVER USE (Without Legal Approval):**
- GPL/AGPL for proprietary commercial projects
- SSPL (Server Side Public License)
- Commons Clause additions
- Custom/Proprietary licenses
- No License / "All Rights Reserved"

**Automation (REQUIRED):**
```json
// package.json
{
  "scripts": {
    "license-check": "license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC' --summary"
  }
}
```

**CI/CD Integration (REQUIRED):**
- License check runs on every PR
- Blocks merge if non-approved license
- Generates report for review

**Verification Example:**
```
"Proposing 'react-query' for data fetching.

LICENSE VERIFICATION:
✅ License: MIT
✅ Commercial Use: Permitted
✅ Attribution: Required (in bundle comments)
✅ Dependencies: All MIT or Apache 2.0

VERIFIED SAFE FOR COMMERCIAL USE

Documented in LICENSES.md
Approved?"
```

**🚨 BLOCKING Scenario:**
```
"🚨 BLOCKING ISSUE: '[package]' has GPL-3.0 license.
INCOMPATIBLE with commercial proprietary use.

I CANNOT proceed with this dependency.

Options:
1. Find MIT/Apache alternative (recommended)
2. Build in-house
3. Seek legal approval (delays project)

Which approach?"
```

---

## 📋 Pre-Implementation Checklist

**Before writing ANY code, verify:**

- [ ] **Design Pattern Selected** with rationale and approval
- [ ] **Clean Code Standards** understood and agreed
- [ ] **ALL Libraries Approved** with alternatives evaluated
- [ ] **ALL Licenses Verified** for commercial use (MIT/Apache/BSD/ISC)
- [ ] **Performance Budgets** defined (Core Web Vitals targets)
- [ ] **Accessibility Target** set (WCAG A/AA/AAA)
- [ ] **Tech Stack Justified** (framework, styling, state management)
- [ ] **Component Architecture** pattern selected
- [ ] **Testing Strategy** defined
- [ ] **`LICENSES.md`** created and ready

**If ANY checkbox is unchecked → IMPLEMENTATION BLOCKED ⛔**

---

## 🎯 Quick Decision Trees

### "Should I use this library?"

```
Is functionality trivial (<50 lines to build)?
  ├─ YES → Build in-house ✅
  └─ NO → Continue evaluation

Can we defer to later stage?
  ├─ YES → Defer to Stage 2/3 ✅
  └─ NO → Continue evaluation

License compatible with commercial use?
  ├─ NO → BLOCKED ❌ Find alternative
  └─ YES → Continue evaluation

Bundle size acceptable (<20KB added)?
  ├─ NO → Challenge necessity ⚠️
  └─ YES → Continue evaluation

Actively maintained (updated <6 months)?
  ├─ NO → Warning ⚠️ Evaluate alternatives
  └─ YES → Continue evaluation

Evaluated 2+ alternatives?
  ├─ NO → Must evaluate alternatives
  └─ YES → Proceed to approval request ✅
```

### "What license is acceptable?"

```
License type?
  ├─ MIT/Apache/BSD/ISC → ✅ APPROVED
  ├─ GPL/AGPL → ❌ BLOCKED (proprietary)
  ├─ LGPL/MPL/EPL → ⚠️ REQUIRES REVIEW
  ├─ Custom/Unknown → ❌ BLOCKED (must clarify)
  └─ No License → ❌ BLOCKED
```

### "Which design pattern?"

```
Application type?
  ├─ Simple Landing Page → Minimal patterns, Context API
  ├─ Dashboard (Complex State) → Redux/Zustand + Repository
  ├─ Real-time App → Observer + Flux patterns
  └─ Large Multi-team → Feature-Sliced Design + Micro-frontends

ALWAYS evaluate 2-3 options with pros/cons ✅
ALWAYS get approval before implementing ✅
```

---

## ⚡ Emergency Responses

### If AI tries to use unapproved library:
```
"STOP ⛔ - I haven't approved [library] yet.

Required before proceeding:
1. Justification (why needed)
2. Alternatives evaluation (2-3 options)
3. License verification (commercial use)
4. Bundle size impact
5. My explicit approval

Please provide evaluation first."
```

### If AI skips pattern selection:
```
"STOP ⛔ - We haven't selected design patterns yet.

Required before implementation:
1. Evaluate component architecture pattern
2. Evaluate state management pattern
3. Document pros/cons for each
4. Recommend with rationale
5. Get my approval

Which patterns should we evaluate?"
```

### If license is incompatible:
```
"🚨 BLOCKING ISSUE - GPL license detected.
This BLOCKS commercial use.

Action required:
1. Find MIT/Apache alternative
2. Or build in-house
3. Or pause for legal review

Cannot proceed with GPL dependency."
```

---

## 📞 Escalation Triggers

**Immediately escalate to human if:**

1. 🚨 **License is GPL/AGPL/Unknown** for commercial project
2. 🚨 **Cannot find commercial-safe alternative** for required functionality
3. 🚨 **Library has no clear license** or custom restrictive license
4. ⚠️ **Bundle size exceeds budget** significantly (>50KB added)
5. ⚠️ **Library unmaintained** (no updates >1 year) for critical functionality
6. ⚠️ **Security vulnerabilities** in dependencies
7. ⚠️ **Pattern selection unclear** - multiple equally valid options

---

## ✅ Success Indicators

**You know the process is working when:**

- ✅ AI **always asks about design patterns first**
- ✅ AI **never uses libraries without asking**
- ✅ AI **verifies licenses automatically**
- ✅ AI **challenges unnecessary dependencies**
- ✅ AI **evaluates alternatives** before recommending
- ✅ AI **blocks on GPL/AGPL** without human intervention
- ✅ **`LICENSES.md` file created** automatically
- ✅ **License check scripts added** to package.json
- ✅ **Clean code principles** evident in all code
- ✅ **Performance budgets** defined before implementation

---

**Keep this reference handy when working with AI on web projects! 🎯**
