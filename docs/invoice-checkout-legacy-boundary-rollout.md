# Legacy Invoice Checkout Boundary Rollout

Status: reviewed and approved for guarded rollout on 25 October 2026. Determine live application status from `/root/lms/shared/deployed-sha`, and database status from migration history plus the active validator hash; this runbook is not a live-status marker.

## Scope

- Keep issued invoice amounts, dates and statuses unchanged.
- Fix only a fully unsnapshotted legacy renewal whose invoice start equals its referenced period's end and whose invoice end exactly matches that plan's legacy duration.
- Resolve actual renewed access from the day after the referenced period ends. Preserve all normal overlap/ownership checks and atomic settlement.
- Never infer missing coder/class/plan references or dates. The three incomplete historical invoices remain held for a separate reviewed correction.
- Changing the function does not create payments, reserve invoices, grant access, send messages or rewrite historical data.

## Preflight Gates

1. Refresh production refs and confirm the running SHA; the investigation baseline is `b91206f0ae50c9885c1b559642bc31135f20cef0`.
2. Sign in to the existing Supabase project through the supported SQL editor. Do not expose keys or create extra credentials.
3. Capture `pg_get_functiondef('public.validate_invoice_checkout_periods(uuid[])'::regprocedure)` and its execution privileges for rollback outside Git. Compare the actual body with the baseline before proceeding.
4. Follow the scoped consistent encrypted billing backup and restore-verification procedure in `docs/selected-invoice-checkout-rollout.md`. Preserve a fresh read-only fingerprint of the seven existing billing tables and the checkout ledger. Do not overwrite newer settlements using an old snapshot.
5. Review read-only eligibility for the affected invoice and the remaining historical review cases. Obtain explicit production approval after the backup/review results are available.

Verified preflight: pinned Node 24.22.1 passed all 148 invoice/billing tests, typecheck and build. The private, encrypted 12-table snapshot and active validator rollback definition passed decryption and disposable typed-row restore. The copied affected invoice fails with the old validator and passes with the proposed one, without modifying invoice/prior-access rows. User approval follows the explained compatibility scope. Do not publish backup files, personal rows, or recovery keys.

## Application

1. Integrate only the reviewed task changes onto current production, repeat QA on the pinned runtime, and publish the exact production SHA.
2. Use the existing locked release script and preserve the callback-compatible previous release and persistent WhatsApp auth.
3. Apply only `supabase/migrations/20261025090000_legacy_invoice_checkout_boundary.sql` under bounded lock/statement timeouts. Record migration history using the normal project workflow. No data backfill or paid mutation is part of this migration.
4. In the same guarded change window, compare existing-table fingerprints and function privileges before and after. Stop and roll back the function if data or privileges changed unexpectedly.
5. Verify public login/invoice access and the invoice's resolved boundary with read-only checks. Do not issue a real QR/VA or simulate a paid callback for QA. Observe the next authorized parent payment rather than creating a test charge.

## Recovery

- Restore the backed-up validator body if necessary, without deleting orders, claims, allocations or grants and without resetting paid invoices.
- Keep the callback-compatible release. Never roll back to pre-ledger callbacks while existing checkout orders may settle.
- Do not reset WhatsApp auth or mutate unrelated application runtime state.
