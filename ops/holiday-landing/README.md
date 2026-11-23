# Active Holiday landing source

The production `/holiday-class/` URL is served by Docker container `holiday-class-preview2`, mounted read-only from `/root/holiday-class-preview2`. It is **not** the old Next.js `/holidayclas2026` page. These text sources were captured read-only on 23 November 2026. Existing `assets/` and `projects/` directories remain on the static host; no images, prices or schedule entries were replaced.

This directory is review material. The normal LMS release script does not publish it.

## Reviewed changes

- `registration-v6.js`: attribution, canonical event ID from the API, Pixel flush before navigation, and a choice to reopen the existing invoice or edit class selections for an identical order.
- `meta-tracking-v3.js`: UTM/fbclid/cookie capture, runtime-ready event delivery and deduplication of simultaneous callbacks. Existing analytics preferences remain respected.
- `index.html`: new versioned script references, clearer device requirements and removal of the unsupported generic 3D marketing claim. A tablet requires compatibility confirmation; no email field is added.
- Other JS/CSS files are unchanged dependencies captured with the source. Assets resolve from the existing static mount.

## Future publication gate

No publication was executed for this branch. When approved: apply the two LMS database migrations, deploy the reviewed LMS SHA, then publish these static files. Back up the existing static index and keep old script versions for rollback. Upload the new versioned scripts before atomically replacing `index.html`. Do not replace unrelated assets or the LMS reverse proxy configuration.

Check that the live files still match the captured base before overwriting them. If these hashes differ, review the intervening changes first:

| Original file | SHA-256 |
| --- | --- |
| index.html | d936521cd7a1281668b79a84f1bf57be01b0a0d960504ec3a498332d6ca8f7d9 |
| registration-v5.js | be5b8297f1cb7ddace16bf4d60480630ca5b391f64c3f063b6b5da53dc7cffe7 |
| meta-tracking-v2.js | 71571231ac04b305708a9cbd8917499d55d54333849f4f3d23e906f8c1e416ee |

Run `node scripts/qa-holiday-landing.mjs` with the project Node runtime to test the real form against local API and Pixel stubs. No messages, registrations or payments are created in production.
