# Upstream Merge Impact Analysis

**Date:** 2026-02-20  
**Upstream commits:** 61 commits (f7a8c2df2..1b886e737)  
**Version:** 2026.2.20  
**Files changed:** 1,102 files (10,124 insertions, 10,653 deletions)

## Executive Summary

The upstream merge will bring significant improvements including iOS fixes, authentication improvements, memory handling, channel fixes, and version 2026.2.20. However, there are **critical fork-specific files that will be deleted** and need preservation, plus potential merge conflicts in several areas.

## Critical Issues: Files to Preserve

### 1. **FORK-CHANGES.md** ⚠️ WILL BE DELETED

- **Status:** Upstream deletes this file
- **Impact:** HIGH - Contains comprehensive documentation of all fork-specific changes
- **Action Required:**
  - Preserve this file before merge
  - Update references in README.md and .agent/workflows/update_clawdbot.md if needed
  - Consider renaming or moving to a fork-specific location

### 2. **.agents/skills/** ⚠️ WILL BE DELETED

- **Status:** Upstream moves skills to maintainers repository
- **Impact:** MEDIUM - These skills exist in your fork:
  - `PR_WORKFLOW.md`
  - `merge-pr/`
  - `mintlify/`
  - `prepare-pr/`
  - `review-pr/`
- **Action Required:**
  - If you use these skills, preserve them before merge
  - Consider moving to a fork-specific location or maintaining separately
  - Update references in AGENTS.md and other docs

### 3. **.cursor/plans/** ⚠️ WILL BE DELETED

- **Status:** Upstream deletes these planning files
- **Impact:** LOW-MEDIUM - Contains planning documents:
  - `gateway_stability_plan_a8710a7c.plan.md`
  - `phased_stability_refactor_8246eb55.plan.md`
  - `phased_stability_refactor_c67b81a1.plan.md`
  - `plan_review_and_updates_9a5ebf76.plan.md`
- **Action Required:**
  - Archive these if they contain important context
  - Move to a fork-specific location if needed

### 4. **.github/workflows/upstream-sync-test.yml** ⚠️ WILL BE DELETED

- **Status:** Upstream deletes this workflow
- **Impact:** MEDIUM - This is your daily upstream sync test workflow
- **Action Required:**
  - Preserve this workflow file before merge
  - It's referenced in FORK-CHANGES.md and update_clawdbot.md

## Potential Merge Conflicts

Based on git merge-tree analysis, conflicts are likely in:

### High-Confidence Conflict Areas:

1. **CHANGELOG.md**
   - Both sides have modifications
   - Fork has fork-specific entries
   - Upstream has 2026.2.20 release notes
   - **Resolution:** Merge both sets of entries, preserve fork-specific section

2. **src/auto-reply/reply/** (multiple files)
   - Import statements differ
   - Fork may have additional functionality
   - **Resolution:** Keep fork imports + upstream changes

3. **README.md**
   - Fork has "About this repository" section
   - Upstream has updated content
   - **Resolution:** Preserve fork section, merge upstream updates

4. **src/agents/system-prompt.ts**
   - Fork integrates ClawdBot-Next prompt-engine
   - Upstream has other changes
   - **Critical:** Must preserve fork's prompt-engine integration
   - **Resolution:** Keep fork's async `buildAgentSystemPrompt` with prompt-engine

5. **src/agents/pi-embedded-runner/system-prompt.ts**
   - Fork passes `userPrompt` through
   - Upstream may have other changes
   - **Resolution:** Preserve fork's userPrompt handling

6. **src/config/sessions/paths.ts**
   - Fork has `getLatestSessionTranscriptForAgent` changes
   - Upstream has path validation/APIs
   - **Resolution:** Merge both, preserve fork's agent-scoped path resolution

7. **src/auto-reply/reply/get-reply-run.ts**
   - Fork has session path fixes (pass `agentId`)
   - Upstream has other changes
   - **Resolution:** Preserve fork's `agentId` passing logic

## Major Upstream Changes by Category

### 1. Version & Release (2026.2.20)

- Version bump across all platforms
- Release notes in CHANGELOG.md
- **Impact:** Low conflict risk, but CHANGELOG needs merging

### 2. iOS Improvements

- Background refresh fixes
- Pairing scope preservation
- Onboarding improvements
- **Impact:** Low conflict risk (fork doesn't modify iOS heavily)

### 3. Memory Handling

- ENOENT error handling improvements
- Shared helpers
- **Impact:** Low conflict risk

### 4. Authentication

- OAuth sync to all agents
- Profile-id drift fixes
- Bidirectional mode/type compatibility
- **Impact:** Medium conflict risk - fork may have customizations

### 5. Gateway/Pairing

- Bootstrap recovery
- Local pairing fallback
- Scope checks alignment
- **Impact:** Medium conflict risk - verify fork's pairing logic preserved

### 6. Channel Fixes

- Telegram streaming improvements
- Slack `recipient_team_id` fixes
- Signal group ID case preservation
- WhatsApp fallback prevention
- **Impact:** Low-Medium conflict risk - fork has Slack fixes too

### 7. Skills/Agents Migration

- Skills moved to maintainers repository
- Old PR workflow skills archived
- **Impact:** HIGH - Fork's skills will be deleted

### 8. UI/Docs

- Animated nav tabs
- Various documentation updates
- **Impact:** Low conflict risk

### 9. Security

- Hono bump for timing-safe auth
- **Impact:** Low conflict risk

### 10. Docker

- Base images pinned to SHA256
- **Impact:** Low conflict risk

## Fork-Specific Areas to Protect

### Critical Fork Features (MUST PRESERVE):

1. **ClawdBot-Next Prompt-Engine Integration**
   - `src/agents/prompt-engine/` directory
   - `src/agents/system-prompt.ts` async changes
   - `src/agents/pi-embedded-runner/system-prompt.ts` userPrompt passing
   - Domain-map and JSON-driven routing
   - Skills loader resolution logic

2. **Fork-Specific Tooling**
   - Gateway tools stderr piping
   - Tool-level concurrency locks
   - Agent loop guardrails
   - Native compaction command

3. **Docker Helpers**
   - `scripts/docker-helpers/` directory
   - Health check, weather, himalaya shims

4. **Cron Reliability**
   - Zombie scheduler fixes
   - In-flight job persistence
   - Timer log throttling

5. **Session Path Fixes**
   - `agentId` passing in `resolveSessionFilePath`
   - Defensive fallback for legacy paths

6. **Discord Gateway Stability**
   - Reconnect ceiling and supervisor loop
   - Connection health watchdog
   - Empty payload validation

7. **Slack Streaming**
   - `recipient_team_id` fixes (may conflict with upstream)

## Testing Strategy Per Change Scope

### Phase 1: Core System (Build & Type Check)

- **Scope:** Build system, TypeScript, dependencies
- **Commands:**
  ```bash
  pnpm install
  pnpm build
  pnpm tsgo
  ```
- **Expected:** Should pass if conflicts resolved correctly

### Phase 2: Prompt-Engine Integration

- **Scope:** `src/agents/prompt-engine/`, system-prompt.ts
- **Commands:**
  ```bash
  pnpm test src/agents/system-prompt.test.ts
  pnpm test src/agents/prompt-engine/
  ```
- **Expected:** All tests pass, prompt-engine still functional

### Phase 3: Memory & Sessions

- **Scope:** Memory handling, session paths
- **Commands:**
  ```bash
  pnpm test src/agents/memory
  pnpm test src/config/sessions/
  ```
- **Expected:** ENOENT handling works, session paths resolve correctly

### Phase 4: Authentication & Pairing

- **Scope:** OAuth, pairing, auth profiles
- **Commands:**
  ```bash
  pnpm test src/agents/auth-profiles/
  pnpm test src/gateway/pairing/
  ```
- **Expected:** OAuth sync works, pairing preserves scopes

### Phase 5: Channels

- **Scope:** Discord, Slack, Telegram, Signal, WhatsApp
- **Commands:**
  ```bash
  pnpm test src/discord/
  pnpm test src/slack/
  pnpm test src/telegram/
  pnpm test src/signal/
  ```
- **Expected:** Streaming fixes work, recipient IDs pass correctly

### Phase 6: Gateway & Tools

- **Scope:** Gateway stability, tool execution
- **Commands:**
  ```bash
  pnpm test src/gateway/
  pnpm test src/agents/bash-tools/
  pnpm test src/agents/pi-tools/
  ```
- **Expected:** Stderr piping works, singleton tools function

### Phase 7: Cron & Scheduling

- **Scope:** Cron service, zombie recovery
- **Commands:**
  ```bash
  pnpm test src/cron/
  ```
- **Expected:** Anti-zombie recovery works, timer throttling active

### Phase 8: Full Test Suite

- **Scope:** Everything
- **Commands:**
  ```bash
  pnpm test
  pnpm test:coverage
  ```
- **Expected:** All tests pass, coverage maintained

## Recommended Merge Strategy

### Pre-Merge Checklist:

1. ✅ Backup `FORK-CHANGES.md` to a safe location
2. ✅ Backup `.agents/skills/` if you use them
3. ✅ Archive `.cursor/plans/` if needed
4. ✅ Backup `.github/workflows/upstream-sync-test.yml`
5. ✅ Ensure working tree is clean
6. ✅ Create a backup branch: `git branch backup-pre-merge-$(date +%Y%m%d)`

### Merge Approach:

1. **Use merge (not rebase)** to preserve history
2. **Resolve conflicts systematically** by category:
   - First: CHANGELOG.md (merge both)
   - Second: Core prompt-engine files (preserve fork)
   - Third: Session paths (merge both)
   - Fourth: Channel fixes (merge both)
   - Fifth: Other conflicts

3. **After merge, restore fork-specific files:**
   - Restore `FORK-CHANGES.md`
   - Restore `.github/workflows/upstream-sync-test.yml`
   - Optionally restore `.agents/skills/` if needed
   - Update references if paths changed

### Post-Merge Verification:

1. Build succeeds
2. Type check passes
3. Tests pass (run per scope above)
4. Fork-specific features still work:
   - Prompt-engine integration
   - Session path resolution
   - Docker helpers
   - Cron reliability
   - Gateway stability features

## Risk Assessment

| Category                | Risk Level | Mitigation                              |
| ----------------------- | ---------- | --------------------------------------- |
| Fork file deletion      | HIGH       | Backup before merge, restore after      |
| Prompt-engine conflicts | MEDIUM     | Preserve fork's async changes           |
| Session path conflicts  | MEDIUM     | Merge both sets of fixes                |
| Channel fixes conflicts | LOW-MEDIUM | Merge both, verify Slack fixes          |
| Skills deletion         | MEDIUM     | Backup if needed, move to fork location |
| Build/test failures     | LOW        | Run tests per scope, fix incrementally  |

## Next Steps

1. Review this analysis
2. Backup critical files
3. Proceed with merge
4. Resolve conflicts systematically
5. Test per scope
6. Restore fork-specific files
7. Verify all functionality
