# Artifact Migration Guide: Where Removed Files Are Going

This document explains where OpenClaw is moving removed artifacts and how to maintain them in your fork.

## Summary

| Artifact                                   | Status        | New Location                | Action Required                                 |
| ------------------------------------------ | ------------- | --------------------------- | ----------------------------------------------- |
| `.agents/skills/`                          | **MOVED**     | `openclaw/maintainers` repo | Pull from maintainers repo or keep fork version |
| `FORK-CHANGES.md`                          | **FORK-ONLY** | N/A (never in upstream)     | Preserve during merge                           |
| `.cursor/plans/`                           | **FORK-ONLY** | N/A (never in upstream)     | Preserve during merge                           |
| `.github/workflows/upstream-sync-test.yml` | **FORK-ONLY** | N/A (never in upstream)     | Preserve during merge                           |

---

## 1. `.agents/skills/` → Moved to `openclaw/maintainers`

### What Was Moved

**Commit:** `9264a8e21` - "chore: move skills to maintainers repository"  
**Author:** Gustavo Madeira Santana  
**Date:** Feb 19, 2026

The following skills were moved from `openclaw/openclaw` to `openclaw/maintainers`:

- `.agents/skills/PR_WORKFLOW.md`
- `.agents/skills/merge-pr/SKILL.md`
- `.agents/skills/merge-pr/agents/openai.yaml`
- `.agents/skills/mintlify/SKILL.md`
- `.agents/skills/prepare-pr/SKILL.md`
- `.agents/skills/prepare-pr/agents/openai.yaml`
- `.agents/skills/review-pr/SKILL.md`
- `.agents/skills/review-pr/agents/openai.yaml`

Also archived (deleted):

- `.agents/archive/PR_WORKFLOW_V1.md`
- `.agents/archive/merge-pr-v1/`
- `.agents/archive/prepare-pr-v1/`
- `.agents/archive/review-pr-v1/`

### New Location

**Repository:** <https://github.com/openclaw/maintainers>  
**Path:** `.agents/skills/`

The maintainers repository structure:

```text
openclaw/maintainers/
├── .agents/
│   └── skills/
│       ├── PR_WORKFLOW.md
│       ├── merge-pr/
│       │   ├── SKILL.md
│       │   └── agents/
│       │       └── openai.yaml
│       ├── mintlify/
│       │   └── SKILL.md
│       ├── prepare-pr/
│       │   ├── SKILL.md
│       │   └── agents/
│       │       └── openai.yaml
│       └── review-pr/
│           ├── SKILL.md
│           └── agents/
│               └── openai.yaml
└── README.md
```

### Reference in Upstream

Upstream added `.agents/maintainers.md` with a single line:

```
Maintainer skills now live in [`openclaw/maintainers`](https://github.com/openclaw/maintainers/).
```

### Options for Your Fork

**Option A: Keep Your Fork's Version**

- Preserve your fork's `.agents/skills/` directory during merge
- Continue using your fork's version of these skills
- No action needed beyond preserving the files

**Option B: Sync from Maintainers Repo**

- After merge, pull the latest from `openclaw/maintainers`
- Use git subtree or manual copy to sync `.agents/skills/` from maintainers repo
- Command example:

  ```bash
  git subtree pull --prefix=.agents/skills \
    https://github.com/openclaw/maintainers.git main --squash
  ```

**Option C: Hybrid Approach**

- Keep your fork's version if you have customizations
- Periodically compare with maintainers repo and merge updates
- Document any fork-specific changes

### Recommendation (skills)

Since your fork may have customizations or different versions of these skills, **Option A (keep fork version)** is recommended. You can always sync from the maintainers repo later if needed.

---

## 2. `FORK-CHANGES.md` → Fork-Only (Never in Upstream)

### FORK-CHANGES status

This file **never existed in upstream**. It was created in your fork to document fork-specific changes.

### Why FORK-CHANGES will be deleted

When merging upstream, git will see that `FORK-CHANGES.md` exists in your fork but not in upstream, and will attempt to delete it.

### Action required (FORK-CHANGES)

**PRESERVE THIS FILE** during merge. Options:

1. **Before merge:** Copy to a safe location
2. **During merge:** When git marks it as deleted, restore it:

   ```bash
   git checkout main -- FORK-CHANGES.md
   ```

3. **After merge:** Ensure it's committed back

### FORK-CHANGES references

This file is referenced in:

- `README.md` - "About this repository" section
- `.agent/workflows/update_clawdbot.md` - Sync workflow documentation
- `.cursor/plans/phased_stability_refactor_c67b81a1.plan.md` - Plan references

All these references should be preserved.

---

## 3. `.cursor/plans/` → Fork-Only (Never in Upstream)

### .cursor/plans status

These planning files **never existed in upstream**. They were created in your fork for planning purposes.

### Files Affected

- `.cursor/plans/gateway_stability_plan_a8710a7c.plan.md`
- `.cursor/plans/phased_stability_refactor_8246eb55.plan.md`
- `.cursor/plans/phased_stability_refactor_c67b81a1.plan.md`
- `.cursor/plans/plan_review_and_updates_9a5ebf76.plan.md`

### Why .cursor/plans will be deleted

Upstream doesn't have these files, so git merge will try to delete them.

### Action required (.cursor/plans)

**PRESERVE THESE FILES** if they contain important planning context:

1. **Before merge:** Archive them if needed
2. **During merge:** Restore them:

   ```bash
   git checkout main -- .cursor/plans/
   ```

3. **After merge:** Commit them back

### Recommendation (.cursor/plans)

If these plans are still active or contain important context, preserve them. If they're historical/archived, you can let them be deleted or move them to an archive location.

---

## 4. `.github/workflows/upstream-sync-test.yml` → Fork-Only (Never in Upstream)

### upstream-sync-test status

This workflow **never existed in upstream**. It was created in your fork for daily upstream sync testing.

### Purpose

This workflow runs daily to:

- Test merging upstream changes
- Detect conflicts before manual merge
- Generate upstream preview summaries
- Open issues when conflicts or failures are detected

### Why upstream-sync-test will be deleted

Upstream doesn't have this workflow, so git merge will try to delete it.

### Action required (upstream-sync-test)

**PRESERVE THIS WORKFLOW** - it's critical for your fork's maintenance:

1. **Before merge:** Ensure it's backed up
2. **During merge:** Restore it:

   ```bash
   git checkout main -- .github/workflows/upstream-sync-test.yml
   ```

3. **After merge:** Commit it back

### upstream-sync-test references

This workflow is referenced in:

- `FORK-CHANGES.md` - "Phase 5: Upstream merge strategy"
- `.agent/workflows/update_clawdbot.md` - Sync workflow documentation

---

## Merge Strategy: Preserving Fork-Only Files

### Recommended Approach

1. **Before merge:** Create a backup branch

   ```bash
   git branch backup-pre-merge-$(date +%Y%m%d)
   ```

2. **Perform merge:**

   ```bash
   git merge upstream/main
   ```

3. **Restore fork-only files immediately after merge:**

   ```bash
   # Restore fork-only files
   git checkout backup-pre-merge-$(date +%Y%m%d) -- FORK-CHANGES.md
   git checkout backup-pre-merge-$(date +%Y%m%d) -- .cursor/plans/
   git checkout backup-pre-merge-$(date +%Y%m%d) -- .github/workflows/upstream-sync-test.yml

   # For .agents/skills/, decide: keep fork version or sync from maintainers
   git checkout backup-pre-merge-$(date +%Y%m%d) -- .agents/skills/
   ```

4. **Commit restored files:**

   ```bash
   git add FORK-CHANGES.md .cursor/plans/ .github/workflows/upstream-sync-test.yml .agents/skills/
   git commit -m "preserve: restore fork-only files after upstream merge"
   ```

### Alternative: Use `.gitattributes` Merge Strategy

Create `.gitattributes` to tell git to always keep your version:

```gitattributes
FORK-CHANGES.md merge=ours
.cursor/plans/** merge=ours
.github/workflows/upstream-sync-test.yml merge=ours
.agents/skills/** merge=ours
```

Then configure the merge driver:

```bash
git config merge.ours.driver true
```

This tells git to always keep your version of these files during merges.

---

## Summary Checklist

- [ ] **.agents/skills/**: Decide whether to keep fork version or sync from `openclaw/maintainers`
- [ ] **FORK-CHANGES.md**: Preserve (critical fork documentation)
- [ ] **.cursor/plans/**: Preserve if still relevant, archive if historical
- [ ] **.github/workflows/upstream-sync-test.yml**: Preserve (critical for fork maintenance)
- [ ] Create backup branch before merge
- [ ] Restore fork-only files after merge
- [ ] Update any references if paths change
- [ ] Test that restored files work correctly

---

## Questions?

- **Where are the skills now?** → `openclaw/maintainers` repository at `.agents/skills/`
- **Why are other files being deleted?** → They're fork-only and never existed in upstream
- **How do I keep them?** → Restore them from your backup branch after merge
- **Should I sync skills from maintainers?** → Only if you want upstream's version; your fork version may have customizations
