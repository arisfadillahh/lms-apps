# Production Baseline - 2026-08-14

This document records the source reconciliation used to create the `production` branch. It does not represent a deployment or a production restart.

## Baseline

- Previous Git base: `cd8401729f09e1d42d5bb5a6e9ed0a2f304c5240` from `dev-ver-2`.
- Running PM2 application: `lms` from `/root/lms/lms-apps`.
- Running Next.js build ID observed during reconciliation: `ApCOdd8GupaWb5aGEsMfw`.
- Filtered VPS source archive SHA-256: `fbfeccf825042acee33bce0773f0f735c6b78dc8d27cb70ee0688362ea2faebd`.
- Production was not pulled, reset, rebuilt, reloaded, or restarted while this baseline was created.

## Reconciliation Rules

- Runtime source whose behavior was present in the active build was retained.
- Tests, migrations, engineering documentation, and Nginx source that were absent or stale on the VPS were preserved from Git because historical direct-copy deployments did not reliably copy non-runtime files.
- Environment files, credentials, SSH keys, sessions, uploads, dependencies, build output, virtual environments, logs, screenshots, temporary archives, and Codex attachments were excluded.
- Tracked runtime artifacts and a committed deployment SSH key were removed from the new branch. The exposed key must be rotated separately; deleting it in this branch does not remove it from existing Git history.
- Line endings are normalized through `.gitattributes` so Windows and Linux devices do not create false full-file diffs.

## Known Runtime Difference

The active production build did not contain the Coach report `Buka Penilaian` shortcut or saved-score preload introduced in the previous Git commit. The baseline follows the active production behavior for those runtime files. Reintroduce that feature later as a normal task branch with focused verification instead of mixing it into branch reconciliation.

## Cutover Status

The current VPS directory remains the historical dirty checkout. Follow `docs/production-workflow.md` and perform the documented one-time cutover before treating a Git checkout as the deployment source.
