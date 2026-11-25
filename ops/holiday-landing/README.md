# Active Holiday landing source

The production `/holiday-class/` URL is served by Docker container `holiday-class-preview2`, mounted read-only from `/root/holiday-class-preview2`. It is **not** the old Next.js `/holidayclas2026` page. These text sources were captured read-only on 23 November 2026. Existing `assets/` and `projects/` directories remain on the static host; no images, prices or schedule entries were replaced.

This directory is review material. The normal LMS release script does not publish it.

## Reviewed changes

- `registration-v7.js`: keeps the v6 registration flow and adds direct opening from `?daftar=1` or `#daftar`. `registration-v6.js` is retained for rollback.
- `meta-tracking-v3.js`: UTM/fbclid/cookie capture, runtime-ready event delivery and deduplication of simultaneous callbacks. Existing analytics preferences remain respected.
- `index.html`: new versioned script references, clearer device requirements and removal of the unsupported generic 3D marketing claim. A tablet requires compatibility confirmation; no email field is added.
- Other JS/CSS files are unchanged dependencies captured with the source. Assets resolve from the existing static mount.

## Registration deep links

Use `https://lms.clev.io/holiday-class/?daftar=1` or `https://lms.clev.io/holiday-class/#daftar` to open the registration dialog on load. Keep campaign query parameters on the same URL; UTM parameters and `fbclid` remain available to the existing attribution capture.

Optional query parameters are `kelas` (school grade `1`–`12`), `program` (zero-based program index within that grade's catalogue level), and `batch` (zero-based batch index in the catalogue). For example, `?daftar=1&kelas=1&program=0&batch=0` selects the first Explorer program and first batch when available. A program requires a valid `kelas`; a batch requires a valid program. Missing, invalid, disabled, or already-started choices are silently ignored. Catalogue values and availability are checked when the form loads.

To roll back this landing change, restore `index.html` to reference `registration-v6.js`. Keep both versioned scripts in the static mount.

## Future publication gate

No publication was executed for this branch. When approved: apply the three LMS database migrations, deploy the reviewed LMS SHA, then publish these static files. Back up the existing static index and keep old script versions for rollback. Upload the new versioned scripts before atomically replacing `index.html`. Do not replace unrelated assets or the LMS reverse proxy configuration.

Check that the live files still match the captured base before overwriting them. If these hashes differ, review the intervening changes first:

| Original file | SHA-256 |
| --- | --- |
| index.html | d936521cd7a1281668b79a84f1bf57be01b0a0d960504ec3a498332d6ca8f7d9 |
| registration-v5.js | be5b8297f1cb7ddace16bf4d60480630ca5b391f64c3f063b6b5da53dc7cffe7 |
| meta-tracking-v2.js | 71571231ac04b305708a9cbd8917499d55d54333849f4f3d23e906f8c1e416ee |

Run `node scripts/qa-holiday-landing.mjs` with the project Node runtime to test the real form against local API and Pixel stubs. No messages, registrations or payments are created in production.

## Publication runbook (operator only, after separate approval)

These are instructions, not commands executed by this branch. LMS deployment must finish first. No container rebuild/restart is necessary for this directory bind mount.

1. Confirm the reviewed branch/SHA and run all local checks. Apply the **three** new Holiday migrations in order, then deploy the LMS application SHA using its existing release workflow. Leave reminders disabled until release checks pass. See `docs/holiday-funnel-release-checklist.md`.
2. Inspect the current live source read-only:
   - `node scripts/verify-holiday-landing-hashes.mjs https://lms.clev.io/holiday-class/ --baseline`
   - Compare `docker inspect holiday-class-preview2` mount source with `/root/holiday-class-preview2`.
   - Inspect the live `index.html` script references. Expected captured baseline: `preview2-v4.js`, `registration-v5.js`, `meta-tracking-v2.js`. The current candidate references `registration-v7.js` and `meta-tracking-v3.js`.
   - If any baseline hash differs, stop, capture the changed source and review it. Do not overwrite newer work.
3. On the VPS, create a unique rollback directory outside the served mount, e.g. `/root/holiday-class-rollbacks/<approved-SHA>-<timestamp>/`. Copy the current `index.html`, JS and CSS into it, preserving filenames. Save their SHA-256 manifest. Do not touch `assets/`, `projects/`, LMS releases, `.env` or WhatsApp authentication.
4. Upload only candidate text files into a **staging directory** outside the served mount. Compare uploaded SHA-256 hashes with the local candidate. No `rsync --delete` and no directory replacement.
5. Install `registration-v7.js` and `meta-tracking-v3.js` into the served mount first. Keep v5/v2/v6 files for rollback. Unchanged CSS/preview scripts should not be overwritten unless their staged hashes exactly match the live originals. Do not remove assets or older versions.
6. Copy the staged candidate index to a temporary file **in the served directory**, verify its hash, then atomically rename it to `index.html`. This avoids exposing an index that references scripts not uploaded yet. Preserve normal readable file permissions.
7. Run `node scripts/verify-holiday-landing-hashes.mjs https://lms.clev.io/holiday-class/` without `--baseline`. All candidate index/script hashes must match. A mismatch exits 2; request failures exit 1. The script performs only GETs and local reads, never deployment.
8. Check mobile/desktop and browser console, register only in the approved Sandbox/staging flow, and verify event IDs in Meta Test Events. Confirm ordinary LMS paths are still served by LMS, not the static container. Record the final SHA, timestamp and hash report.

### Rollback

1. Do not run migration rollbacks or modify invoice data to revert landing code.
2. Verify the saved baseline index and its referenced scripts still match the rollback manifest. If an old script was accidentally replaced, restore that exact backed-up file **before** the index.
3. Copy the backup `index.html` to a temporary file beside the served index and atomically rename it. This restores the old script references. Leave new versioned files in place; they are unreferenced and harmless.
4. Run the read-only checker with `--baseline` and verify the original three hashes. If rolling back to a newer approved snapshot rather than this captured baseline, compare against that snapshot's manifest instead.
5. Recheck `/holiday-class/`, a public invoice and `/login`. Do not restart unrelated containers or change proxy routes. LMS code rollback, if needed, uses its own release workflow separately.
