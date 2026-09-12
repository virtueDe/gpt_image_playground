---
name: gpt-image-playground-upstream-sync
description: Use when synchronizing gpt_image_playground with its upstream repository or reviewing upstream changes before integration.
---

# GPT Image Playground Upstream Sync

Update the fork through a reviewable sync branch. Preserve Studio behavior,
the custom image, version files, and SSH deployment workflow. Upstream sync,
merging to `main`, and production release are separate stages.

## Source selection

1. Confirm which remote is the fork and which is upstream; keep upstream
   push-disabled.
2. For a version update, prefer the newest verified upstream release tag. Use
   upstream `main` only when explicitly requested.
3. Create `codex/sync-<version>` from the current synchronized `main`. Never
   perform the first upstream merge directly on `main`.

## Inspect before merge

1. Require a clean, unambiguous worktree. Preserve unrelated files and do not
   stash, clean, stage, or delete them automatically.
2. Fetch fork branches, upstream branches, and tags. Require local `main` to
   fast-forward to `origin/main`; stop on divergence.
3. Compare `src/`, `public/`, `deploy/`, `.github/workflows/`, `package.json`,
   `package-lock.json`, and release files against the selected upstream tag.
4. Inventory fork-only behavior: Studio/sub2api model selection, profile
   persistence, `deploy/Dockerfile`, `docker-compose.studio.yml`,
   `remote-deploy.sh`, GHCR image naming, and SSH deployment triggers.
5. Treat version files and `public/sw.js` cache names as a coordinated change.
   Do not import upstream release metadata over the Studio version without a
   version reconciliation plan.

## Merge and verify

1. Merge the verified upstream tag into `codex/sync-*` with an explicit merge
   commit so the upstream boundary stays visible.
2. Resolve conflicts by understanding both behaviors. Do not apply blanket
   `ours` or `theirs` resolution to deployment, API profile, or service-worker
   files.
3. Preserve the project image and deployment contract:
   `ghcr.io/virtuede/gpt_image_playground`,
   `deploy@186.244.245.86:/opt/proxy/studio`, and the `studio` service.
4. Run `npm ci`, `npm run build`, `npm test`, and `git diff --check` when the
   affected files permit. Failed required checks block integration unless the
   user explicitly accepts the named risk.
5. Review the full `origin/main..codex/sync-*` diff and confirm Studio model
   selection and profile persistence remain reachable.

## Integrate and release

1. Push the sync branch for review. Merge it to `main` only when explicitly
   requested and allowed by branch protection.
2. Syncing or merging `main` does not authorize a production release.
3. When release is explicitly requested, increment the Studio suffix in
   `MAJOR.MINOR.PATCH-studio.N`, update package lock, service-worker cache, and
   `RELEASE.md`, then create and push the annotated `v<version>` tag.
4. The tag invokes the Docker workflow, which builds and pushes the project's
   own GHCR image and deploys it to the SSH Studio target. Report image push,
   remote container health, and `/studio/` HTTP verification separately.

## Automation boundary

Safe automation may fetch upstream, detect a newer release tag, create a sync
branch, run checks, and open a PR. Do not configure unattended upstream merge,
conflict resolution, version tagging, image publishing, or production SSH
deployment.

Stop on remote divergence, missing official tag, unclear version mapping,
deployment contract changes, failed required checks, missing release secrets,
or an existing tag. Never force push, replace tags, or skip verification.
