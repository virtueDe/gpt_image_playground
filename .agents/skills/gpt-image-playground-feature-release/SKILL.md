---
name: gpt-image-playground-feature-release
description: Use when developing, integrating, releasing, or deploying a gpt_image_playground feature or bug fix.
---

# GPT Image Playground Feature Release

Use the real Git state and the repository's npm/Vite workflows. Keep feature
integration and production release separate.

## Development

1. Inspect status, branch, and remotes before changing files.
2. Preserve unrelated work. If the worktree is dirty with unrelated changes,
   stop before switching, stashing, staging, or committing.
3. Use a `codex/` prefixed branch for new work unless the user specifies another
   branch. Keep `main` fast-forwardable to `origin/main`.
4. For a new business feature, trace the existing UI, state, API, and storage
   path before editing. Confirm unclear contracts before implementation.

## Verification and commit

1. Run the focused checks, then `npm run build` and `npm test` for completed
   feature work unless the user explicitly asks to skip one.
2. Review status, unstaged and staged diffs, and `git diff --check`.
3. Stage only the requested files. Never use blanket staging when unrelated
   files exist.
4. Use a Chinese Conventional Commit such as
   `feat(studio): 支持按分组选择图片模型`.
5. Verify `HEAD`, committed files, and clean status after committing.

## Deployment

1. Pushing `main` triggers the GitHub Pages workflow. A successful Git push is
   not proof that the Actions deployment succeeded; report the workflow result
   when it is accessible.
2. Version tags use `v<package.json version>` and must never be overwritten or
   force-updated. Create and push a tag only when the user explicitly requests
   a release/version deployment.
3. Before a version release, update `package.json`, `package-lock.json`,
   `public/sw.js`, and `RELEASE.md` together, then run build and tests.
4. Vercel release deployment is controlled by the repository workflow and its
   configured deploy hook; do not expose or request secrets in chat.

Never force push, rewrite history, skip failing checks as a workaround, or
commit generated `dist/` output.
