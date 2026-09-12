---
name: gpt-image-playground-feature-release
description: Use when developing, integrating, versioning, releasing, or deploying a gpt_image_playground feature or bug fix.
---

# GPT Image Playground Feature Release

Use the repository's real Git state and npm/Vite checks. Keep feature
integration, versioning, and production deployment as separate authorization
stages.

## Modes

- Start development: inspect the request and create a `codex/` feature branch.
- Finish development: verify, commit, push the branch, and merge to `main` only
  when requested.
- Release: only when the user explicitly requests a production release; bump
  the version, create the tag, and push it to trigger the server deployment.

Passing tests, merging to `main`, or pushing `main` does not authorize a
production release tag.

## Start development

1. Inspect status, branch, remotes, and `origin/main`; fetch before branching.
2. Preserve unrelated changes. If the worktree is dirty with unrelated work,
   stop before switching, stashing, staging, or committing.
3. Keep `main` fast-forwardable to `origin/main`; do not merge or rebase a
   diverged `main` automatically.
4. Create `codex/<short-topic>` from the synchronized `main`.
5. Trace the affected UI, state, API, persistence, and deployment path before
   changing shared behavior.

## Finish development

1. Run focused checks, then `npm run build` and `npm test` for feature work.
2. Review status, staged and unstaged diffs, `git diff --check`, and generated
   file changes. Never stage unrelated files or `dist/`.
3. Use a Chinese Conventional Commit and verify the committed files and clean
   status.
4. Push the feature branch. Merge to `main` only after explicit approval.

## Version policy

The canonical application version is `package.json`. Studio releases use
`MAJOR.MINOR.PATCH-studio.N`, with `N` incremented for each release on the same
base version. A version bump must update all of these together:

- `package.json` and the root package entry in `package-lock.json`.
- `public/sw.js` `CACHE_NAME`.
- The newest `RELEASE.md` section with the actual release date.

Before tagging, search the repository for the previous version and review the
full release diff. Historical entries in `RELEASE.md` remain unchanged.

## Production release

1. Require a clean `main` synchronized with `origin/main` and passing build and
   test checks.
2. Select the next unused version, update the version files, and commit the
   release change on `main`.
3. Create an annotated tag `v<package.json version>`. Never overwrite, delete,
   or force-update an existing tag.
4. Push `main` and the tag. The tag triggers `.github/workflows/docker.yml`.
5. The workflow builds this repository's own image
   `ghcr.io/virtuede/gpt_image_playground:<version>` and deploys it over SSH to
   `deploy@186.244.245.86:/opt/proxy/studio` using the `studio` Compose service.
6. Verify the workflow's build and deploy jobs separately. Confirm the remote
   `sub2api-studio` container uses the new image, is running, and `/studio/`
   returns a successful HTTP response.

The production path is the SSH Studio deployment. GitHub Pages is manual-only
preview infrastructure and is not evidence of a production release.

## Deployment secrets and stop conditions

The workflow must use repository secrets for `DEPLOY_SSH_KEY`,
`DEPLOY_KNOWN_HOSTS`, `GHCR_DEPLOY_USERNAME`, and `GHCR_DEPLOY_TOKEN`. The
default target is `deploy@186.244.245.86:/opt/proxy/studio`; stop if the actual
target differs or required secrets are missing.

Stop on dirty ambiguous scope, diverged `main`, failed required checks, a used
tag, missing deployment secrets, failed image push, or failed remote health
check. Never bypass a stop with force push, skipped checks, or a reused tag.
