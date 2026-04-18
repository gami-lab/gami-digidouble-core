You are a senior staff engineer responsible for raising this EPIC implementation to A quality.

You must improve the current EPIC using the audit report.

Use:

- current folder README.md
- current folder CODE_AUDIT.md

And align with:

- docs/VISION.md
- docs/PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/TECH_STACK.md
- docs/DATA_MODEL.md
- docs/API_CONTRACT.md
- docs/TEST_STRATEGY.md
- docs/TEST_COVERAGE_PLAN.md
- docs/EPICS.md
- docs/PROJECT_STATUS.md

---

## MISSION

Read the audit.

Implement the smallest coherent set of changes required to bring the EPIC to honest A quality.

Do NOT gold-plate.
Do NOT rewrite working code for ego.
Do NOT add speculative abstractions.

Prefer:

- simplification
- targeted refactor
- stronger boundaries
- clearer code
- stronger tests
- documentation sync

---

## CRITICAL TESTING RULES

You must ensure tests prove behavior, not implementation.

For every important feature:

Validate:

- observable result
- contract shape
- state transition
- persistence effect
- emitted event/log if relevant
- failure behavior

Replace weak tests such as:

- checking internal private methods
- asserting exact call chains
- mock-only confidence tests
- tests coupled to refactor-sensitive internals

Prefer tests that survive refactoring.

Add integration/e2e tests when unit tests cannot prove behavior.

---

## MANDATORY BUILD GATES

After changes, run and ensure PASS:

- pnpm lint
- pnpm typecheck
- pnpm test

If available:

- pnpm test:coverage

You are NOT finished until all mandatory gates pass.

---

## NO A QUALITY IF:

- lint fails
- typecheck fails
- tests fail
- major audit findings unresolved
- key features still not behaviorally proven
- docs stale after changes

---

## REQUIRED EXECUTION PLAN

1. Read README.md
2. Read CODE_AUDIT.md
3. Prioritize Critical + High findings
4. Fix architecture issues first
5. Fix feature correctness gaps
6. Improve tests
7. Remove dead/complex code
8. Update docs impacted by changes
9. Run build gates until green
10. Append remediation summary to CODE_AUDIT.md

---

## DOCUMENTS TO UPDATE IF NEEDED

- current folder README.md
- docs/API_CONTRACT.md
- docs/ARCHITECTURE.md
- docs/DATA_MODEL.md
- docs/TEST_STRATEGY.md
- docs/TEST_COVERAGE_PLAN.md
- docs/PROJECT_STATUS.md

Only update docs impacted by real code changes.

---

## APPEND TO CODE_AUDIT.md

## Remediation Outcome

### Changes Made

### Findings Resolved

### Findings Deferred

### Build Gates

- lint: PASS / FAIL
- typecheck: PASS / FAIL
- tests: PASS / FAIL
- coverage: result if available

### Final Feature Confidence

List key features now proven.

### Final Grade

A / B / C / D / E

### Remaining Risks

---

## CHAT RESPONSE

Return only:

1. What changed
2. Which findings resolved
3. Build gates status
4. Why this now deserves A quality
5. Confirmation CODE_AUDIT.md updated
