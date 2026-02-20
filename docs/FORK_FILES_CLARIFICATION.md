# Clarification: Fork Files & Skills Types

## 1. Fork-Only Files During Merge

### Your understanding is correct

You're right that your fork-specific files (`FORK-CHANGES.md`, `.cursor/plans/`, `.github/workflows/upstream-sync-test.yml`) are committed in your fork and preserved in your git history.

### However, during merge

When you merge upstream into your fork, git compares the two trees:

- **Your fork has:** `FORK-CHANGES.md`, `.cursor/plans/`, etc.
- **Upstream has:** (these files don't exist)

Git will mark these files as **"deleted"** in the merge because upstream doesn't have them. This is normal git behavior - it's trying to sync your fork to match upstream's state.

### What Happens

1. **During merge:** Git marks fork-only files as deleted
2. **After merge:** You need to restore them explicitly
3. **Then commit:** They'll be preserved going forward

### Example from Your History

Looking at your past merges (like `8040518be`), you've successfully merged upstream before. The same pattern applies - fork-only files get marked as deleted, then you restore them.

### Solution

After merge, restore fork-only files:

```bash
git checkout HEAD~1 -- FORK-CHANGES.md .cursor/plans/ .github/workflows/upstream-sync-test.yml
```

Or use a backup branch:

```bash
git checkout backup-branch -- FORK-CHANGES.md .cursor/plans/ .github/workflows/upstream-sync-test.yml
```

**Bottom line:** Your files are safe in git history, but you need to restore them after merge because git merge tries to sync to upstream's state.

---

## 2. OpenClaw `.agents/skills/` vs Foundry Skills

### These Are COMPLETELY Different Things! 🎯

#### `.agents/skills/` (Being Moved to `openclaw/maintainers`)

**What they are:** Maintainer workflow skills for Cursor/agent assistants

**Purpose:** Help maintainers process PRs using Cursor's agent system

**Examples:**

- `review-pr` - Reviews PRs and produces findings
- `prepare-pr` - Rebases, fixes, runs gates, pushes to PR branch
- `merge-pr` - Squash-merges PRs, verifies state
- `mintlify` - Builds/maintains Mintlify docs

**Where they live:** `.agents/skills/` in the repo root (now moving to `openclaw/maintainers`)

**Who uses them:** Maintainers using Cursor to process GitHub PRs

**Not used by:** The OpenClaw gateway runtime or agents

---

#### Foundry Skills (Runtime Skills)

**What they are:** Runtime skills that teach OpenClaw agents how to use tools

**Purpose:** Extend the agent's capabilities during normal operation

**Examples:**

- Skills that teach the agent to use specific APIs
- Skills that provide domain expertise
- Skills that define workflows for specific tasks

**Where they live:**

1. Bundled skills: `skills/` directory in the repo (shipped with install)
2. Managed/local: `~/.openclaw/skills` (user-installed)
3. Workspace: `<workspace>/skills` (per-agent)
4. **Plugin skills:** Foundry provides skills via its plugin

**Who uses them:** The OpenClaw gateway runtime when agents are running

**Loaded by:** `src/agents/skills/` - the runtime skill loader

---

### Foundry Integration

Foundry is a **plugin** that can provide runtime skills. From `docs/tools/skills.md`:

> **Plugins + skills**
>
> Plugins can ship their own skills by listing `skills` directories in `openclaw.plugin.json` (paths relative to the plugin root). Plugin skills load when the plugin is enabled and participate in the normal skill precedence rules.

So Foundry's skills are:

- Runtime skills (not maintainer workflow skills)
- Loaded via the plugin system
- Used by OpenClaw agents during normal operation
- Completely separate from `.agents/skills/`

---

### Summary Table

| Aspect           | `.agents/skills/`              | Foundry Skills            |
| ---------------- | ------------------------------ | ------------------------- |
| **Type**         | Maintainer workflow            | Runtime agent skills      |
| **Purpose**      | PR processing in Cursor        | Extend agent capabilities |
| **Used by**      | Maintainers/Cursor             | OpenClaw gateway runtime  |
| **Location**     | `.agents/skills/` (repo root)  | Foundry plugin directory  |
| **Moving to**    | `openclaw/maintainers` repo    | Stays in Foundry          |
| **Affects you?** | Only if you use Cursor for PRs | Yes, if you use Foundry   |

---

## Impact on Your Fork

### `.agents/skills/` Removal

**If you don't use Cursor for PR processing:** This doesn't affect you at all. These are maintainer tools, not runtime features.

**If you do use Cursor for PRs:** You can either:

1. Keep your fork's version (preserve `.agents/skills/` after merge)
2. Pull from `openclaw/maintainers` repo if you want upstream's version

### Foundry Skills

**Completely unaffected** - Foundry's skills are separate and loaded via the plugin system. They're not in `.agents/skills/` and won't be affected by this change.

---

## Conclusion

1. **Fork-only files:** Safe in git history, but need restoration after merge
2. **`.agents/skills/`:** Maintainer tools, not runtime skills - unrelated to Foundry
3. **Foundry skills:** Runtime skills loaded via plugin - completely separate system
4. **You use Foundry skills:** Yes, via the Foundry plugin
5. **You use `.agents/skills/`:** Only if you process PRs with Cursor

The skills being moved are **not** the same as Foundry's runtime skills. They're maintainer workflow tools that have nothing to do with how OpenClaw agents operate.
