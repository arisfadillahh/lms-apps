# Production release retention and VPS audit

## Policy

After a successful deployment, keep the active release and **two previous successful releases** for rollback. A build candidate is not a successful deployment until the production health checks and PM2 runtime check have passed.

`scripts/deploy-production.sh` invokes `scripts/retain-production-releases.mjs` while holding the existing deployment lock. The helper records the successful deployment sequence in `/root/lms/shared/release-retention.json`; directory modification times do not determine rollback order. A failed retention check prints a warning and keeps the healthy deployment running.

The helper defaults to a **read-only dry run**. Deployment explicitly passes `--apply` after health verification. An apply writes only the retention ledger and asks Git to remove exact expired release worktrees. It does not run Docker prune, remove volumes, restart services, or delete arbitrary directories.

### First rollout

Existing historical directories have no trustworthy success ledger. On first use, adopt only the verified previous checkout and the new successful active checkout. Older unknown directories are listed as `unmanaged` and preserved. Later successful deployments rotate the managed set to three releases.

This deliberately leaves the initial historical cleanup for a separate reviewed operation. Do not seed the ledger from modification times or assume every candidate with a build succeeded in production. Failed candidates and unrelated QA checkouts also remain report-only.

### Safety checks

- Require the current symlink, exact commit SHA, registered Git worktree, and online LMS PM2 process to agree.
- Only remove real direct children named with exact 40-character commit SHAs under `releases/`.
- Preserve the current and previous checkout and any checkout referenced by PM2 configuration or a live process.
- Preserve dirty source, unknown local files, and runtime data that is not a symlink to the expected shared location.
- Preserve `/shared`, WhatsApp sessions, uploaded files, payroll data, backup directories, secrets, Node runtimes, legacy source, other projects, and all Docker resources.
- Treat a malformed or symlinked ledger as an error; do not attempt to repair it by deleting files.
- Recheck the current symlink, live process references, worktree, and local contents immediately before removal.

If extra protected checkouts remain, the safety check takes priority over reaching three directories. The JSON report explains the blocked entries.

### Inspection and verification

While no deployment is running, use the active release's pinned Node runtime and run the helper **without `--apply`**. Pass `--active` the exact deployed SHA, `--previous` the existing previous-release target, and pipe `pm2 jlist` on stdin. PM2 environment values are consumed in memory and are not printed.

Only the deployment workflow should apply retention, under its deployment lock and after the health checks. A dry run does not create or update the ledger.

Local focused verification:

```sh
node --test scripts/retain-production-releases.test.mjs
bash -n scripts/deploy-production.sh
```

The tests use temporary real Git repositories/worktrees. They verify deployment order, first-rollout preservation, rollback count, shared session/data protection, unknown files, dirty source, runtime symlinks, old PM2 references, malformed state, and symlink rejection.

## Read-only VPS audit — 6 November 2026

This audit issued **no cleanup, prune, restart, deployment, or remote configuration changes**. Sizes below use decimal GB and reflect an inspection snapshot.

- Root disk: **85% used**, 86.50 GB used of 102.89 GB; 16.37 GB available. Inodes: 18% used.
- Current release: `aa00d6dedcd20a67b0fd8cec14d4eab1e5e8bc44`.
- Previous release: `2cfec6e025d559823c65da85188bc5d26fe07cd2`.
- Five existing release checkouts: 6.00 GB total, approximately 1.20 GB each.
- No production deployment lock was held during inspection.
- LMS runs in PM2 from a release checkout; these copies are **not Docker build images**.

| Candidate | Potential recovery | Conditions |
| --- | ---: | --- |
| Generated `.next` and `node_modules` in three inactive LMS `security-qa/` checkouts | 3.571 GB | Remove only generated artifacts after reviewing the exact paths; preserve source, environments, and any data. No process, Docker bind mount, or cron reference to these QA checkouts was found. Dependencies/builds can be recreated. |
| Nineteen old `.next*` snapshots in legacy `lms-apps/`, excluding the live `.next` | 1.765 GB | Review and remove only the named old build snapshots. Preserve the legacy source, live build, data, auth, and nested event-manager. |
| Two excess release copies if the active release and two previous versions are retained | Approximately 2.40 GB | First verify actual successful deployment history and select the two historical deletions. No trustworthy historical success ledger exists; do not pick by mtime alone. |

The first two groups total approximately **5.34 GB of generated artifacts**. With separately reviewed historical release cleanup, the total could reach approximately **7.73 GB**. Nothing has been removed.

### Resources that must remain protected

- The legacy `lms-apps/` tree is still operational: three root cron jobs run its nested `event-manager` every 10 minutes, 15 minutes, and hourly. It also contains approximately 53.7 MB of WhatsApp authentication data and local runtime data. **Do not delete this tree wholesale.**
- `/root/lms/shared` contains the current persistent WhatsApp session, payroll/runtime data, uploads, and security backups. Its approximately 62.7 MB is not build clutter.
- Docker reports **11 images, all 11 referenced by containers**, and **0 B reclaimable image space**. Some references are from stopped rollback containers; an image being used only by a stopped container does not make the rollback disposable.
- Seven stopped containers have approximately 3.95 GB of writable layers; approximately 3.94 GB belongs to old n8n rollback containers. These belong to other operational recovery plans and are outside LMS cleanup scope.
- Docker volumes total approximately 6.87 GB. n8n data and backup volumes are protected. The reported 80.9 MB of unused volume space is not authorization to remove them.
- Build cache totals approximately 419.8 MB, with Docker reporting 0 B reclaimable in this snapshot. Do not infer that it is safe to prune from its age or size.
- Large Go/npm/editor caches and other application directories exist elsewhere under `/root`; they are outside this LMS audit's cleanup scope.

The repository contains the new retention policy and tests. The VPS wrapper obtains the committed deploy script from `origin/production`; these local changes have not been pushed or deployed by this audit. The current production retention behavior therefore remains unchanged until the normal authorized deployment flow installs this change.
