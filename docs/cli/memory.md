---
summary: "CLI reference for `openclaw memory` (status/index/search/compact)"
read_when:
  - You want to index or search semantic memory
  - You’re debugging memory availability or indexing
  - You want to compact a session transcript from the CLI
title: "memory"
---

# `openclaw memory`

Manage semantic memory indexing and search, and session compaction.
Provided by the active memory plugin (default: `memory-core`; set `plugins.slots.memory = "none"` to disable).

Related:

- Memory concept: [Memory](/concepts/memory)
- Compaction: [Compaction](/concepts/compaction)
- Plugins: [Plugins](/tools/plugin)

## Examples

```bash
openclaw memory status
openclaw memory status --deep
openclaw memory status --deep --index
openclaw memory status --deep --index --verbose
openclaw memory index
openclaw memory index --verbose
openclaw memory search "release checklist"
openclaw memory status --agent main
openclaw memory index --agent main --verbose
openclaw memory compact --agent main
openclaw memory compact --agent main --instructions "focus on decisions"
```

## Subcommands

### `memory status`

Show memory search index status (vector, embeddings, indexed files). Use `--deep` to probe availability; use `--index` to reindex if dirty.

### `memory index`

Reindex memory files (and optional extra paths). Use `--force` for a full reindex.

### `memory search <query>`

Run a semantic search over memory files. Options: `--max-results`, `--min-score`, `--json`.

### `memory compact`

Compact the **latest** session transcript for the given agent: summarize older history and prune to stay within context limits. Same logic as the `/compact` slash command; useful when no channel session is active (e.g. from a script or SSH).

- **Required:** `--agent <id>` — agent whose latest session to compact.
- **Optional:** `--instructions <string>` — extra instructions for the summarizer (e.g. "focus on decisions").
- **Optional:** `--force` — reserved for future use.
- **Optional:** `--verbose` — verbose logging.

Uses the default model and workspace (cwd + config). The most recently modified `.jsonl` in that agent's sessions dir is chosen.

## Options

Common:

- `--agent <id>`: scope to a single agent (default: all configured agents for status/index/search; **required** for compact).
- `--verbose`: emit detailed logs during probes and indexing.

Notes:

- `memory status --deep` probes vector + embedding availability.
- `memory status --deep --index` runs a reindex if the store is dirty.
- `memory index --verbose` prints per-phase details (provider, model, sources, batch activity).
- `memory status` includes any extra paths configured via `memorySearch.extraPaths`.
