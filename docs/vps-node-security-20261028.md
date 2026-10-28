# VPS Node security verification — 28 October 2026

This is an operational receipt, not a guarantee against all vulnerabilities. It contains no credentials, environment values, database rows or session material. Evidence/backup directories are root-only and outside Git.

## Verified active services

| Service | Active source/image | Runtime | Checks |
| --- | --- | --- | --- |
| LMS | `1bc5baaa91ce2125908ca53a21b45dfafcfc9b58`, or its subsequent documentation-only release | Node 24.22.1; Next 16.4.2; Sharp 0.35.5; Zod 4.6.7 | 116 files / 634 actual tests, TypeScript, build and production audit 0 on pinned Node; login 200; protected dashboards 307; admin checkout API 401 |
| PM2 daemon / host default | `/opt/nodejs/node-v24.22.1-linux-x64` | Node 24.22.1 | Signed runtime verification, non-root execution, boot-unit PATH resolves to patched binary; saved active/stopped states preserved |
| `clevio-wa-n8n-bridge` | Existing source unchanged | Node 24.22.1 | Health 200; explicit interpreter; unchanged application environment |
| n8n main + worker | n8n 2.8.3, image `sha256:1d44e1b16269e9b16fa1693f47ac88b1a9458cb7b70a5da4428865c87eba74f2` | Node 22.23.4 | Main readiness 200; worker Redis connection; original app layers/config/mounts; SQLite schema fingerprint unchanged |
| Clevio Camp website | `arisfadillahh/webclevio`, branch `codex/agent-2-web-node-security`, source `d21bfb78e1f1f739e82937abee518759813b1607`; image `sha256:f17151dcb8b19bb60c07a0cdbfca6be9b5f1a93757655c52e663b4f1aeaaa33f` | Node 22.23.4; Next 16.4.2; Sharp 0.35.5; Zod 4.6.7 | 15 actual behavioral tests, TypeScript, build, production audit 0; isolated homepage plus 5 assets; public `/camp`, articles/events/login 200; admin 307, admin APIs 401 |

`clevio-wa` itself is a native Go process, not a Node app. Its health remained 200 after controlled PM2 maintenance. No test message, workflow or payment was triggered. LMS persistent WhatsApp state remains `/root/lms/shared/baileys_auth_info`.

The website preserves all 12 deployed feature commits that were absent from its divergent `main`; do not deploy `main` over it. The dirty `/root/web/webclevio` checkout was not edited, pulled or reset. Build came from a clean Git archive under `/root/web/security-releases/<sha>`.

## Backups and rollback

- LMS immediate safe fallback after the documentation-only release is `1bc5baaa91ce2125908ca53a21b45dfafcfc9b58`, with the same patched application dependencies. Before that follow-up, the fallback was `75910f914acd72270e2c17a634f96c59e65a00da`; its dependencies are historical. The deploy script retains at least five releases and uses `/var/lock/lms-production-deploy.lock`. Never automatically reverse a database migration.
- n8n: `/root/node-security-20261028/n8n-backup-wubM4O` contains a consistent 3,353,362,432-byte SQLite snapshot, integrity/count verification, encryption configuration and private container/compose metadata. Binary attachments stay in the unchanged live volume; this is not a full filesystem disaster-recovery backup. Successful cutover evidence: `/root/node-security-20261028/n8n-cutover-ARiwsF/verified.json`. Original image: `sha256:53004142b0e93de1e9e31943e601ed9bd4b24ca82a307864ccadf1820b627e5e`. Original main/worker containers are retained stopped, with restart policy `no`, so reboot cannot start duplicate workers. Gracefully stop the producer, drain the worker, and preserve the current database/queue when reverting an image. The old image contains an unpatched Node and is emergency recovery only.
- Website: private cold data/upload snapshot plus original container metadata at `/root/node-security-20261028/web-cutover-r3tElw`. Current writable data binds are `/root/web/shared-web-cutover-r3tElw/data:/app/data` and `/root/web/shared-web-cutover-r3tElw/uploads:/app/public/uploads`. Rollback image is `sha256:6cfd5921b4f7c80bbf15eb7696e61fc10dd3fc53992c3cfebcde47957d75d946` (source `e80b273f552542fb9912502bd41a81210345f96e`). Recreate the old image with the **same current binds**, environment, network/IP and original launch configuration. Do not merely start the archived original container: it lacks the new binds and would expose a stale writable-layer copy. Never restore the cold snapshot over newer uploads/content automatically.
- Host/PM2: verified backup `/root/node-security-20261028/host-runtime-VG9EBh`, including PM2 state and a read-only backup of the open WhatsApp SQLite store. Earlier failed attempts are retained privately for investigation. A PM2 `update` relaunch timed out and was rolled back; separate `kill`/`resurrect` CLI lifetimes passed isolated testing and succeeded. A subsequent overly strict environment comparison also rolled back safely: only PM2's generated `unique_id` changed. Final comparison excludes only that telemetry UUID, retaining checks on all application environment values, launch fields and stopped states. No database backup was restored during either rollback.

Do not prune these images, volumes, release directories or backups as Docker cache. They are current runtimes/recovery material.

## Restart and future deployment

Ordinary container restart/reboot uses the patched current images and original restart policies. PM2's saved state retains stopped applications; the enabled boot unit resolves `/usr/local/bin/node` to the patched `/opt` runtime.

`/root/docker-compose.yml` is retained unchanged. Future n8n recreation must include the committed runtime override, rather than reverting to its historical image:

```bash
docker --host unix:///var/run/docker.sock compose \
  -f /root/docker-compose.yml \
  -f /root/lms/current/ops/node-security/20261028/compose.override.json \
  config --quiet
```

This command validates configuration only. Before any `up`/recreation, verify local pinned image availability, inspect duplicate historical Compose labels, obtain the maintenance lock, take a fresh private backup and gracefully drain jobs. Do not blindly recreate unrelated Compose services or remove rollback containers. Retained archived containers have historical Compose labels, so reconcile exact container IDs deliberately before a future Compose rollout.

For website deployment, rebuild the verified Git deployment lineage, not the dirty checkout; retain the shared binds and original routing/IP. n8n images and website artifacts are local immutable images, not a claim that they have been published to a registry.

## Remaining limits

- Stopped `webclevio-dev`, `jsf`, `jsb` and separate `clevio-event-manager` were not started or source-edited. Some retained interpreter metadata/binaries are old. They are **not certified for reactivation**; review their own repositories, resolve dirty work with its owner, stage runtime/dependency compatibility, then test before enabling. Host Node replacement alone does not patch explicit `/usr/bin/node` references.
- This n8n change patches its Node runtime only. It does not assert a comprehensive n8n application/plugin dependency audit or upgrade its database/application version.
- Production dependency audits for LMS and website were 0 at verification time. Five high development lint-chain findings remain in LMS; do not use a breaking forced downgrade merely to clear that count.
- Browser/PDF smoke reported browser unavailable in isolated LMS QA. Native Sharp/Baileys/bcrypt checks passed, but an authenticated/synthetic installed-browser PDF check remains unverified. Signed-out probes do not prove every role/device, live payment, report/PDF or workflow.
- No migration, historical invoice/access rewrite, production test account mutation, parent WhatsApp send, database deletion, session reset or database rollback was performed for this security rollout.
