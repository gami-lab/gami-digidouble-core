# Title

Harden Streaming Behavior And Synchronize Documentation

# Context

By the time this slice starts, streaming should work end to end. The remaining work is to close
the EPIC safely: prove the ordering and interruption guarantees, protect backward compatibility,
and update the repository docs so the implemented streaming behavior is the new source of truth.

This slice exists because code-only completion is not acceptable in this repository.

# Scope

Implement now:

- add any missing regression coverage around ordering, interruption, and cleanup
- verify the old non-streaming route still behaves as documented
- verify no listener leaks or duplicate persistence occur in the main streaming paths
- complete the required documentation updates for the shipped behavior
- mark the EPIC complete if and only if all slices are actually done

Out of scope:

- new product scope beyond streaming UX
- WebSocket transport
- new conversation features unrelated to streaming

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Review the full streaming path:
  - shared/public contracts
  - provider adapter streaming
  - application streaming flow
  - HTTP route
  - web client rendering
- Add or tighten tests where the failure modes are most likely:
  - out-of-order delta handling
  - disconnect/abort cleanup
  - no final avatar persistence on interruption
  - final avatar persistence exactly once on success
  - legacy JSON send-message route still returns the documented `ApiResponse<SendMessageResponse>`
- Run the relevant repo checks for touched packages. At minimum, ensure the core and web test suites covering streaming behavior are executed.
- Update docs together, not partially. At minimum review:
  - `docs/PROJECT_STATUS.md`
  - `docs/API_CONTRACT.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TECH_STACK.md`
  - `docs/TEST_STRATEGY.md`
  - `docs/EPICS.md`
- If the data model did not change, explicitly confirm that `docs/DATA_MODEL.md` remains accurate.
- If Game Master timing semantics changed only in documentation detail, update `docs/GAME_MASTER_CONTRACT.md` accordingly.

# Constraints

- Respect current architecture, KISS, YAGNI, DRY, backward compatibility, and explicit contracts.
- Do not leave undocumented route or stream semantics behind.
- Do not mark the EPIC complete in docs unless implementation, tests, and docs are all done.
- Keep the final cleanup surgical and directly traceable to streaming UX.

# Deliverables

- regression hardening across core and web streaming paths
- verified backward compatibility for the legacy JSON message route
- full documentation sync for the shipped streaming behavior
- EPIC status update when appropriate

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Regression coverage exists for ordering, completion, interruption, and cleanup.
- [ ] The legacy non-streaming send-message route remains documented and tested.
- [ ] No duplicate persistence or orphaned listener issue remains in the streaming path.
- [ ] `docs/PROJECT_STATUS.md` is updated.
- [ ] All impacted docs are updated or explicitly verified accurate.
- [ ] `docs/EPICS.md` marks `5.3 Streaming UX Layer` complete only when the implementation is actually finished.
