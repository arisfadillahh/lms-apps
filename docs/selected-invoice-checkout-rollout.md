# Selected invoice checkout: guarded rollout

## Contract

- A checkout link is a capability for explicit immutable MONTHLY invoice IDs belonging to one CCR/family. It is not a merged/replacement invoice.
- All unpaid members are selected initially. Parents may deselect months before creating QR/VA instructions. Paid invoices are never selectable.
- Creating a link never sends WhatsApp or grants access. Admin previews the current message and explicitly sends it. The preview hash must still match.
- One provider charge covers the selected invoices, with one existing configured admin fee. The backend re-reads status/amount; the browser cannot set the charge amount.
- Selected invoices are reserved transactionally before contacting the gateway. Timeout, 404, missing/unknown provider state do not release claims.
- Live legacy instructions block overlapping new charges. Read authoritative status, including all historical orders, not only the latest snapshot. Never auto-cancel them or assume a newer QR/VA invalidates an older order.
- Cancellation is an explicit parent action followed by a provider status check. If settlement wins the cancel race, settle rather than release.
- Signed callbacks/status checks validate exact order/amount. Paid status and billed-period grants commit together, once. Conflicts enter REVIEW without partial invoice/access changes.
- Manual monthly confirmation uses the same transaction when enabled. Registration/trial/seasonal behavior is unchanged.
- Reconciliation remains active when new creation is feature-disabled. Never roll back below callback-compatible code while an `LMSB-` order can settle.

## Independent billing and cuti

`LMS_SELECTED_INVOICE_CHECKOUT_ENABLED=true` enables both the new generator and selected checkout; default is false.

The generator uses the latest plan/price reference and active coder + enrollment + Weekly class. Both ACTIVE/EXPIRED references can establish obligations; prior settlement is not a prerequisite. A stopped latest record must not fall back to an older ACTIVE one.

- One-month plans may generate subsequent eligible months while earlier bills remain unpaid. Three-/six-/other-month plans retain cadence, duration, price and discount.
- Generation never creates/extends paid access. Keep the existing 26th–25th convention. Re-generation skips issued invoices rather than changing amounts or duplicating items.
- Cuti uses existing active/inactive controls. No freeze, carry-over, refund or prorata is introduced. Unused meetings are not shifted into the resumed period.
- No new obligations while inactive. Reactivation is a lower bound: no chasing inactive months. Additive audit triggers record future status transitions.
- Unknown old status intervals use conservative account/enrollment `updated_at` boundaries. Affected cycles and class pause histories require Admin review; never infer debt from unexplained calendar gaps.
- Mid-cycle reactivation after billing start is not silently charged for the old entire cycle; Admin reviews that cycle. Attendance/progression/class behavior is unchanged.
- Old unpaid invoices remain historical obligations. Ambiguous references/dates are not deleted, cancelled, marked paid or corrected automatically.

## Approval and preflight

Payment logic and migration require approval after backup and existing-row review, not only green tests/build.

1. Record fetched/running production SHA and deployment lock.
2. Create and verify a consistent encrypted backup. REST table-by-table export is not transactional; Supabase Free has no scheduled project backup.
3. A scoped billing snapshot covers invoices/items/periods/settings/CCR/plans/pricing, column metadata, constraints, timestamp and digest. Exclude credentials, password hashes and WhatsApp sessions. Keep encrypted files/keys outside Git; directory 700, recovery key 600. This is not a full-project disaster-recovery backup.
4. Verify decryption/digest/counts and local restore rehearsal without printing personal data. Never test restore in production.
5. Read-only audit unpaid monthly CCR/family scope, duplicate months, item amounts, dates, period/coder/class references, durations/overlaps and old provider orders. Ambiguous corrections require separate approval.
6. Initial audit at source/running SHA `3886d1dc8529a6fb600da91c3d318aa51bcc9b81`: 238 invoices, 23 unpaid monthly; zero duplicate unpaid family/month groups, zero item/amount mismatches, four incomplete item-to-period references, one invoice missing period dates. These counts are not approved corrections.
7. Scoped backup verified on 22 October 2026 at 09:38:38 WIB: invoices 239, invoice_items 250, coder_payment_periods 203, invoice_settings 1, ccr_numbers 52, payment_plans 5, pricing 18. Capture used one read-only SELECT and server-side PGP encryption. Local in-memory decryption, SHA256 verification and disposable typed-table restore comparison passed for every row of all seven tables. The encrypted artifact and recovery material remain outside Git in a private local backup directory. This is billing-data restore verification, not full-schema/project disaster recovery. The invoice count changed through normal live activity between the audit and snapshot; never overwrite later transactions with a snapshot.
8. Read-only review of the verified snapshot: 22 unpaid monthly invoices; three pending invoices contain four items without a resolvable payment-period reference, including one invoice without dates. These are historical records, not migration output. Do not infer coder/class/date mappings or charge them through the new ledger until reviewed. Activation remains held; no automatic repair or exclusion policy is approved.

## Rollout

1. Test the actual migration in disposable PostgreSQL/PGlite, behavioral services/routes and browser views. Full tests, typecheck, diff check and build after final fetch/rebase.
2. Push reviewed task branch. No production integration/migration until approved and ambiguous historical rows are handled or excluded by reviewed policy.
3. Deploy callback-compatible code with feature disabled using exact-production-SHA script. Verify old routes/instructions, PM2/auth/logs. Keep a callback-compatible rollback release before activation, not only the pre-feature release.
4. Apply `20261021100000_selected_invoice_checkout.sql` in a reviewed migration session: one transaction, bounded lock/statement timeouts; nullable snapshots, new tables/functions/RLS/triggers. No backfill, deletion, paid-status reset, charge, message or existing-period date update.
5. Compare old-table counts/status/amount/digests against snapshot; verify privileges and empty new ledgers. Abort on any mismatch/error.
6. Enable only after review; observe first explicitly approved live usage. Never create a real charge, fake callback or paid mutation just for QA.

## Recovery

- Disable new creation/generation first, keep compatible callbacks/reconciliation running. Preserve order IDs, claims and REVIEW records.
- After activation, rollback only to callback-compatible code. Keep five releases and standard deployment lock. No scp/source editing or shared WhatsApp auth changes.
- Never auto-roll back schema, delete ledger history, release reservations on timers or overwrite newer settlements with older backup rows. Data recovery requires explicit reviewed reconciliation.
- SENDING/UNCERTAIN WhatsApp delivery is not automatically retried. One grouped message per family/WIB day is claimed atomically. Verify delivery before authorizing a retry.
- No recovery key, ciphertext export, production row, `.env`, runtime file or QA screenshot belongs in Git.

## Approved deployment checkpoint — 22 October 2026

The user approved deployment for actual use after the verified backup and held-gate report. The implementation was first integrated and deployed as `ed5622f5184a817f2c204cd50518caf9b3200c30`, feature OFF, from previous production `3886d1dc8529a6fb600da91c3d318aa51bcc9b81`.

Migration `20261021100000` then committed successfully under the deployment lock. The exact committed migration was enclosed in a repeatable-read transaction with before/after fingerprints over all seven existing billing tables and abort-on-mismatch. Fingerprints matched. History registration, seven RLS tables, anon/authenticated denial and service-role reserve privileges were verified; new links/intents/grants were empty. Read-only application-side checks confirmed PostgREST could see all new tables/nullable fields.

The activation release differs only in documentation, ensuring that the immediate previous release is callback-compatible before the runtime flag is enabled. Three incomplete historical pending invoices remain unchanged and fail closed before a new charge; they require Admin review, not invented dates or automatic correction. Existing live legacy instructions still block overlapping charges. Final activation SHA and production smoke/log results belong in the task handoff. Do not describe this as a real bank settlement test or a full-project disaster-recovery test.
