---
name: Phased Stability Refactor
overview: "Updated review of the five-phase stability refactor plan. Phase 5 is fully complete, Phase 4b (Ollama streaming) is done via upstream native /api/chat provider. Phases 1, 2, 3, and the remaining Phase 4 items are still pending. Key new context: Discord CV2 rewrite landed; a prior reconnect PR was reverted; Gantt dates need refresh."
todos:
  - id: review-pr17
    content: "Review reverted PR #17 (discord-websocket-recovery-persistence) to understand what failed before re-implementing Phase 2"
    status: pending
  - id: phase2-reconnect
    content: "Phase 2: Increase Discord maxAttempts and add supervisor loop (validate against CV2 architecture)"
    status: pending
  - id: phase2-health
    content: "Phase 2: Add Discord connection health metrics and staleness alerting"
    status: pending
  - id: phase3-ntfy
    content: "Phase 3: Create src/infra/ntfy.ts and wire to internal hooks"
    status: pending
  - id: phase3-searxng
    content: "Phase 3: Add SearXNG as web search provider in web-search.ts"
    status: pending
  - id: phase4a-apishow
    content: "Phase 4a: Add /api/show detailed discovery for Ollama models"
    status: pending
  - id: phase4c-fallback
    content: "Phase 4c: Configure model fallback chain in openclaw.json"
    status: pending
  - id: phase1-compose
    content: "Phase 1: Create docker-compose.prod.yml with gateway + ntfy + SearXNG"
    status: pending
  - id: phase1-deploy
    content: "Phase 1: Create scripts/deploy.sh for zero-downtime rebuilds"
    status: pending
  - id: phase1-migrate
    content: "Phase 1: Migrate config and cron store to Docker volumes"
    status: pending
  - id: update-plan-gantt
    content: Update the plan's Gantt chart and todo statuses to reflect completed items
    status: completed
isProject: false
---

# Phased Stability Refactor -- Updated Review (Feb 15 2026)

## Status at a Glance

| Phase | Description                  | Status                                                                   |
| ----- | ---------------------------- | ------------------------------------------------------------------------ |
| 1     | Docker Compose Unification   | **Pending** -- no files created yet                                      |
| 2     | Discord Connection Hardening | **Pending** -- prior attempt reverted; CV2 rewrite landed                |
| 3     | ntfy + SearXNG Integration   | **Pending** -- no code written                                           |
| 4a    | Ollama `/api/show` discovery | **Pending** -- still uses `/api/tags` only                               |
| 4b    | Ollama streaming             | **DONE** -- native `/api/chat` provider merged                           |
| 4c    | Model fallback chain         | **Pending** (config-only)                                                |
| 5a    | Fork isolation               | **DONE** -- well-isolated in `src/agents/prompt-engine/`                 |
| 5b    | Upstream sync CI             | **DONE** -- `.github/workflows/upstream-sync-test.yml` fully implemented |
| 5c    | Contributing upstream        | Deferred (per plan)                                                      |

---

## Changes Since Plan Was Written

### Completed items to mark done

- **Phase 5b**: The [upstream-sync-test.yml](.github/workflows/upstream-sync-test.yml) is fully implemented with daily schedule, merge test, build/test, binary search for clean vs conflicted commits, issue creation on failure, and upstream preview in job summary.
- **Phase 5a**: Fork-specific logic is isolated in `src/agents/prompt-engine/` and config-gated paths. [FORK-CHANGES.md](FORK-CHANGES.md) documents all divergences comprehensively.
- **Phase 4b (Ollama streaming)**: Upstream merged native `/api/chat` streaming + tool calling (`src/agents/ollama-stream.ts`). The native Ollama provider bypasses the SDK's `streamSimple` entirely and streams directly. The SDK issue #1205 workaround (`streaming: false`) is no longer applied to native Ollama models. This resolves Phase 4b completely.

### New context affecting remaining phases

**1. Discord CV2 rewrite (upstream)**

Commit `9203a2fdb` (`Discord: CV2! (#16364)`) landed a major Discord rewrite. Phase 2 changes (reconnect ceiling, supervisor loop) must be validated against the CV2 architecture. The gateway plugin config at `src/discord/monitor/gateway-plugin.ts:34` still shows `maxAttempts: 50`, so the reconnect ceiling change still applies, but the provider internals may have shifted.

**2. Reverted reconnect PR**

Commit `a65935154` reverted PR #17 (`fix/discord-websocket-recovery-persistence`). This means a prior attempt at Phase 2 work was tried and rolled back. Before re-implementing Phase 2, review what went wrong with PR #17 to avoid repeating the same issues. Check the PR comments on GitHub: `https://github.com/philga7/openclaw-fork/pull/17`.

**3. Ollama native provider changes discovery implications**

The native Ollama provider (`src/agents/ollama-stream.ts`) calls `/api/chat` directly. Phase 4a (`/api/show` detailed discovery) is still needed because model discovery in [models-config.providers.ts](src/agents/models-config.providers.ts) still only uses `/api/tags` and hardcodes `contextWindow: 128000`. The native provider would benefit from accurate context windows.

**4. Gantt chart is stale**

The Gantt shows Phase 1 first starting Feb 17, but the plan body already recommends order 2 -> 3 -> 4 -> 5 -> 1. The Gantt should be updated to reflect the actual order and the fact that Phase 5 and 4b are done.

---

## Remaining Work (Revised)

### Phase 2: Discord Connection Hardening

Still fully pending. Key files unchanged:

- [src/discord/monitor/gateway-plugin.ts](src/discord/monitor/gateway-plugin.ts): `maxAttempts: 50` on line 34
- [src/discord/monitor/provider.ts](src/discord/monitor/provider.ts): no supervisor loop; exits on max reconnect or fatal error

**Before starting**: Review the reverted PR #17 to understand what failed. The CV2 rewrite may have changed internal structures that the prior reconnect fix depended on.

### Phase 3: ntfy + SearXNG Integration

Still fully pending:

- `src/infra/ntfy.ts` does not exist
- [src/agents/tools/web-search.ts](src/agents/tools/web-search.ts): `SEARCH_PROVIDERS` is still `["brave", "perplexity", "grok"]`
- No ntfy/SearXNG config types in `src/config/types.tools.ts`
- No ntfy wiring in [src/hooks/internal-hooks.ts](src/hooks/internal-hooks.ts)

### Phase 4a: Ollama `/api/show` Discovery

Still pending. [models-config.providers.ts](src/agents/models-config.providers.ts) line 228 only calls `/api/tags` and hardcodes `OLLAMA_DEFAULT_CONTEXT_WINDOW = 128000`.

### Phase 4c: Model Fallback Chain

Config-only recommendation; still relevant.

### Phase 1: Docker Compose Unification

Still fully pending:

- No `docker-compose.prod.yml`
- No `scripts/deploy.sh`
- Existing [docker-compose.yml](docker-compose.yml) and [Dockerfile](Dockerfile) handle gateway only
- Gateway still runs via systemd on VPS

---

## Recommended Updated Implementation Order

Since Phase 5 is done and Phase 4b is done:

1. **Phase 2** -- Discord reconnect hardening (review reverted PR #17 first)
2. **Phase 3** -- ntfy + SearXNG integration
3. **Phase 4a/4c** -- Ollama `/api/show` discovery + fallback config
4. **Phase 1** -- Docker Compose cutover (final step)
