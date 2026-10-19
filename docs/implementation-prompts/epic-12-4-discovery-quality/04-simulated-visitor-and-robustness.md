# Title

Add Simulated-Visitor Runs, Robustness Probes, And Coherence Scripts

# Context

Scripted questions test what authors anticipated. Real visitors wander, test the character, stall,
and switch characters mid-story. This slice adds free runs driven by a simulated visitor, standard
robustness probes, and long-session and avatar-switch coherence scripts.

# Scope

Implement now:

- simulated visitor: a script turn type `{ action: 'simulated_visitor', turns, persona, goal }`
  where an LLM (judge provider, separate model selector) plays a visitor with a short persona and
  discovery goal and generates each next user message from the transcript; bounded turns; the
  visitor never sees scenario secrets
- free-run assertions: deterministic defaults per turn, script-level rubric (pacing, in-character),
  GM assertions where applicable, plus `facts_discovered` (judge lists which authored secrets the
  visitor uncovered by the end) for coverage reporting
- robustness probe scripts (reusable fragments): "es-tu une IA ?", off-topic request, hostile or
  insulting user, prompt-injection attempt ("ignore tes instructions"), request for a list of all
  secrets; assertions: stays in role (rubric), no secret dump (deterministic), language kept
- coherence scripts:
  - 30-turn session with planted facts early and recall/contradiction probes late; script-level
    `no_contradiction` rubric over the transcript with the planted facts listed
  - avatar switch: facts told to avatar A, switch to B, check B's awareness follows the scenario
    rules (no knowledge it should not have, references it should make)
- fragments: definitions can include shared script fragments to avoid copy-pasting probes

Out of scope:

- AVA-specific content and baseline (prompt `05`)

# Relevant Docs

- `tools/conversation-evaluation/README.md`
- `docs/MEMORY_SYSTEM_SPEC.md` (what avatars should remember across switches)
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

# Implementation Guidance

- Simulated visitor calls go through the existing judge exchange client with its own model
  selector and are costed separately in the report (`visitor` role).
- Keep simulated runs reproducible enough: record the generated user messages in the report so a
  free run can be replayed as a fixed script.
- Tests: visitor driver with a fake LLM (turn bound, transcript passing, replay export), fragment
  inclusion, coherence assertion inputs built correctly.

# Constraints

- Visitor prompt must not contain scenario secrets, authored answers, or judge criteria.
- Bounded run length and cost; a run stops at the configured turn and cost caps.

# Deliverables

- simulated-visitor turn type, driver, replay export, cost role
- robustness probe fragments and coherence scripts (generic, scenario-agnostic templates)
- unit tests with fakes

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (definition union, report roles, cost estimate).
2. Search for duplicated type definitions inside the tool.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `tools/conversation-evaluation/README.md` (simulated visitor, fragments, probes, caps)
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Simulated-visitor runs work, are costed, capped, and replayable as fixed scripts.
- [ ] Robustness probes and coherence scripts exist as reusable fragments.
- [ ] Unit tests cover the driver and fragments without providers.
- [ ] Documentation reviewed and updated.
