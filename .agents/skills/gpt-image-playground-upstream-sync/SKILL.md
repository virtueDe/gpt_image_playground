---
name: gpt-image-playground-upstream-sync
description: Use when synchronizing gpt_image_playground with its upstream repository or reviewing upstream changes before integration.
---

# GPT Image Playground Upstream Sync

Treat upstream synchronization as a reviewable branch operation. Preserve
local product behavior, deployment configuration, and user-facing settings.

## Source and branch rules

1. Confirm which remote is the fork and which is upstream before fetching.
2. Fetch branches and tags, then require a clean, unambiguous worktree.
3. Create a dedicated `codex/sync-*` branch from the current synchronized
   `main`; never merge upstream directly on `main`.
4. Prefer a verified upstream release tag when the user asks for a version
   sync. Use upstream `main` only when explicitly requested.

## Review before merge

1. Compare `src/`, `public/`, `scripts/`, `deploy/`, `.github/workflows/`,
   `package.json`, and lockfiles for local behavior before merging.
2. Review API profile contracts, persistence migrations, service worker cache
   versions, and deployment triggers as shared behavior.
3. Resolve conflicts by understanding both implementations. Do not apply
   blanket `ours` or `theirs` resolution.
4. Recheck version and release files after every upstream merge.

## Verification and integration

1. Run `npm ci`, `npm run build`, `npm test`, and `git diff --check` when the
   affected files permit; failures block integration unless the user accepts
   the named risk.
2. Confirm local features remain reachable, especially Studio/sub2api model
   selection and API profile persistence.
3. Push the sync branch for review. Merge into `main` only when explicitly
   requested.
4. Synchronizing `main` does not authorize creating or pushing a production
   release tag.

Do not force push, overwrite tags, delete migrations or generated assets, or
enable unattended auto-merge, auto-tagging, or production deployment.
