# LMS Production Workflow

This workflow keeps every Codex device and the VPS on one source of truth without changing the currently running production application during branch setup.

## Branch Roles

- `production`: canonical source that is allowed to be deployed.
- `codex/<device>-<task>`: short-lived branch for one device and one coherent task.
- `dev-ver-2`: legacy history. Keep it available for reference, but do not deploy it or merge it wholesale into `production`.

The deployed commit must always exist on `origin/production`. A local branch, unpushed commit, copied file, or dirty VPS checkout is not a valid deployment source.

## Start Work On Any Device

Use a unique device label such as `desktop-aris`, `laptop-aris`, or `office-pc`.

```powershell
git fetch origin --prune
git status --short
git switch --create codex/<device>-<task> origin/production
```

Stop when the worktree is not clean. Preserve and understand existing work before switching branches; never discard another agent's changes.

Before editing, read `AGENTS.md`, search `docs/error-fixing/index.md`, and inspect related entries. Keep one task per branch so another device can review or continue it without unrelated changes.

## Finish A Task Branch

Run the checks required by `AGENTS.md`, then synchronize with the latest production branch:

```powershell
git fetch origin
git rebase origin/production
npm test -- --run
npx tsc --noEmit
git diff --check origin/production...HEAD
npm run build
git push --set-upstream origin codex/<device>-<task>
```

If the rebase changes code, rerun the affected checks. Do not resolve conflicts by blindly choosing one side; preserve current production invariants and the verified task behavior.

## Integrate Into Production

Only one person or agent integrates at a time:

```powershell
git fetch origin --prune
git switch production
git pull --ff-only origin production
git merge --ff-only origin/codex/<device>-<task>
git push origin production
git rev-parse HEAD
```

Use a normal reviewed merge instead of `--ff-only` only when the task branch cannot be rebased safely. Never force-push `production`.

Record the resulting SHA. Publishing Git does not deploy the application.

## Deploy An Exact Production SHA

After the one-time cutover, every normal implementation task is deployed immediately after its verified commit is integrated into `origin/production`, unless the user explicitly requests no deployment or inspection only.

Every later deployment must:

1. Acquire `/var/lock/lms-production-deploy.lock` with non-blocking `flock`.
2. Fetch `origin/production` in a clean VPS checkout.
3. Confirm the requested SHA exactly matches or is an ancestor of `origin/production` and is the approved commit.
4. Check out that exact SHA, install locked dependencies, run the build, and only then reload PM2.
5. Verify the PM2 process, health route, recent logs, and deployed SHA.
6. Release the lock even when a step fails.

Run the committed deployment workflow with:

```bash
ssh root@72.61.213.46 "bash /root/lms/deploy-production.sh <production-sha>"
```

The script refuses a SHA that is not the current `origin/production` head, builds and smoke-tests a separate release first, switches `/root/lms/current` atomically, and rolls PM2 back to the previous release when post-switch health checks fail.

Deployments must fail when the checkout is dirty, the SHA is not on `origin/production`, the build fails, or another deployment holds the lock. Do not fall back to `scp` or editing source on the VPS.

## One-Time VPS Cutover

The branch setup does not modify or restart production. Schedule the cutover separately:

1. Record the currently running PM2 process, environment, Node version, and production baseline tag/SHA.
2. Back up the dirty VPS source outside the deployment directory without including `.env`, sessions, uploads, dependencies, or build output in Git.
3. Create a clean clone tracking `origin/production` beside the running directory.
4. Restore runtime-only configuration from the existing server, install dependencies, and build in the clean clone.
5. Smoke-test the clean clone on a temporary port.
6. During a short maintenance window, point PM2 to the clean checkout and reload it.
7. Verify authenticated routes, payment callbacks, scheduled jobs, WhatsApp connectivity, push notifications, and recent PM2 logs.
8. Keep the prior runtime directory intact until verification is complete.

Only after this cutover is the Git-based deploy workflow authoritative on the VPS.

## Rollback

Rollback uses a previously verified commit already on `origin/production`; it is not a source-file copy:

1. Acquire the same deployment lock.
2. Check out the recorded previous production SHA in the clean deployment checkout.
3. Install/build for that SHA.
4. Reload PM2 and run smoke checks.
5. Record the rollback SHA and reason in `docs/error-fixing` when it relates to a regression.

Database rollback is separate. Never reverse a migration automatically unless its data-safety impact has been reviewed.

## Handoff Between Devices

Push the task branch before changing devices. On the receiving device:

```powershell
git fetch origin --prune
git switch --track origin/codex/<device>-<task>
```

The receiving agent must read the branch diff, `AGENTS.md`, and relevant error logs before continuing. Do not use the VPS as an informal source repository.
