# Node security rollout — 22 October 2026

## Scope and pins

The official October security release fixes Brotli memory corruption and TLS/DNS validation defects. LMS pins Node 24.22.1, Next 16.4.2 and Sharp 0.35.5. The installer verifies the pinned release-key repository/keyring, GPG signer, signed checksum list and archive digest before extraction. It installs only under `/root/lms/runtimes`, not over system Node. Cached binaries are checked before reuse.

Sources: [Node announcement](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases), [Node 24 release](https://nodejs.org/en/blog/release/v24.22.1), [Next image RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), [Next image SSRF](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4), [Sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).

During rollout, refreshed audit data additionally identified SVG optimization and typed-array cache RCE, plus Server Action denial of service, through Next 16.4.0. The first 16.3.8 release is therefore not the final security target. Follow-up uses 16.4.2 and repeats verification. See [SVG advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) and [cache advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr). Record audit time; a prior zero finding count is not a permanent guarantee.

## LMS release

1. Fetch/rebase against production; run behavioral/full tests, TypeScript, diff/shell checks, clean install and build on pinned Node. Never commit environment or credentials.
2. Push task branch, integrate with normal fast-forward under the shared deployment lock. If production changes, rebase/reverify. Deploy exact production SHA using `/root/lms/deploy-production.sh`.
3. The committed script verifies a clean new release, provisions Node, runs `npm ci --include=dev` and builds before attaching runtime symlinks. Never build in current. Persistent WhatsApp/config/uploads paths remain unchanged.
4. Probe candidate and previous application build on patched Node before cutover. Require login 200, protected-page login redirects and API 401. Consume full HTTP responses rather than aborting streams.
5. Switch atomically and start only PM2 `lms` with explicit Node. Verify interpreter/version/cwd/PID, loopback/public health. On failure roll the application back while retaining patched Node. Keep logs and at least five releases.
6. Record production/deployed/previous SHA and `shared/deployed-node-version`. Payment callbacks, checkout flag, invoices, access periods and WhatsApp session must remain intact. No migration or database rollback.

The first fallback application retains historical dependencies. After the security release is healthy, a docs-only release can establish a fully patched immediate fallback. Never claim an old application is patched merely because its Node is patched.

## Other VPS services

Inventory actual processes and containers, not only host `node --version`. Preserve stopped states and dirty worktrees. Do not run `pm2 restart all`, overwrite other source, upgrade n8n application/schema blindly, or replace Alpine Node with a glibc binary.

`scripts/security/node-container-runtime.Dockerfile` is a runtime-only overlay recipe. Pin both source images by verified digest. Set original Node path/user and expected version; test libc/native-module compatibility before cutover. Preserve entrypoint, command, environment, networks, mounts, restart policy and data. It fixes Node only, not application dependencies. Never modify a running container binary.

Before n8n recreation: private root-only config snapshot, consistent DB backup, read-only queue/running-work inspection and graceful worker drain. Preserve image/config/volumes and encryption key; never print secrets. The deployed Clevio web history diverges from main: preserve deployed features and establish its deployment branch before rebuilding, never silently replace it with main.

System default Node and PM2 daemon are separate from application interpreters. Update only after staged compatibility checks, retain old binaries/private PM2 snapshot, preserve stopped states and verify each service. Inactive dirty projects cannot be functionally certified without testing their own baseline.

## Verification limits

Initial local result: 115 files / 613 tests, TypeScript and build passed on Node 24.22.1. Production dependency audit is clean. Five high-severity development lint-chain findings remain; forced downgrade of Next ESLint config is not acceptable. Keep development tools private and recheck upstream patches instead of `npm audit fix --force`.

Automated/signed-out probes do not prove every authenticated user/device or real settlement. Do not create charges, send parent WhatsApp, mutate classes/billing or trigger workflows for QA. Record actual per-service checks, gaps and rollback targets; never promise zero possible bugs.
