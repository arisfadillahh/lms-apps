# Payroll local follow-up — 4 November 2026

Scope: normal local admin navigation, popup details/preview, Clevio slip branding, recurring staff allowances and monthly adjustments. No VPS changes, production migration, deployment or real message delivery.

## Resulting user flow

- **Gaji & Slip Gaji → Coach & staf → Profil & tunjangan:** admin manages staff name, position, WhatsApp number, base salary, recurring position allowance and named recurring allowances. Staff have no linked LMS account. Coach numbers continue to come from the existing coach profile.
- **Rekap & arsip → select month → Rincian:** a popup presents dates/activities, calculation, amounts and actions. The manual component form adds allowances or deductions for this month only; negative values are deductions. Close the popup and calculate again after changes.
- **Pratinjau:** opens a second popup with the Clevio logo, invoice-style navy/green header, itemized table and net pay summary. Admin preview/detail actions do not download a PDF. Archived versions open in the same preview. Focus starts on the close control; Escape returns to details.
- **Transfer then send:** existing finalization, immutable versions, append-only transfer history and individual/bulk WA sending remain in place. WA attendance recaps stay text-only without amounts or attachments. The branded PDF remains the salary-slip attachment sent after transfer.

## Local database repair

The initial isolated payroll fixture did not include the wider application's tables or PostgREST embedded relationships. Normal dashboard invoice queries therefore failed. Local startup now derives table/relationship metadata from the repository schema/types and evaluates real nested joins, filters, counts and pagination in PGlite. Missing schema/query support reports an error rather than inventing successful empty results. The fixture uses synthetic data only and keeps the payroll write restrictions.

Opening a sample class also exposed an existing empty-curriculum loop: automatic lesson assignment created more blocks without adding lessons. The service now rejects an empty template before creating a runtime block. Synthetic templates have real lessons and links. Startup deduplicates only empty UPCOMING blocks of the dedicated demo template, retaining original and lesson-bearing blocks. Existing local payroll documents, versions and transfers are preserved.

## Verification

- Full Vitest suite: **725 tests / 129 files passed**. Includes actual PostgreSQL migration/privilege/rollback tests, nested dashboard queries, repeated startup preservation, empty-template regression, monthly allowance recurrence, one-month additions/deductions and dated historical totals.
- TypeScript, targeted ESLint and whitespace checks passed.
- Default Next production build passed using process-only local placeholder configuration.
- Browser regression script: **6 scenario groups passed** in `scripts/qa-payroll-admin-local.mjs`. Uses normal local admin credentials, checks eight admin routes, popup details/preview, logo loading, staff allowance/WA persistence without an LMS account, mobile layout and absence of downloads/browser errors. Its dedicated synthetic recipient is deactivated afterwards; existing financial periods are not recalculated or reset.
- PDF inspection: branded archived salary slip **1 A4 page**; long staff slip **4 A4 pages**, all 50 named test components and totals present, all text within page bounds. Rendered pages reviewed locally.

Reproduce with `npm run dev:payroll-local`, then run the browser script. The earlier 16 payroll workflow scenario groups and production activation boundaries are documented in `payroll-qa-2026-11-04.md`. Local screenshots/PDFs/results live under the ignored `.codex-payroll-local/qa/` directory.

## Migration and remaining boundary

`20261104160000_payroll_allowances.sql` adds nonnegative recurring allowance fields to existing dated terms and updates the atomic profile RPC. Existing terms default to zero/empty allowances. Omitted fields from an older client inherit the prior dated values. Existing table RLS/audit history and service-role-only RPC grants remain. No new lookup index is needed: allowances reuse the existing profile/effective-date key.

Only the isolated local database has applied this migration. Live WhatsApp delivery and production behavior require a separately authorized activation. n8n remains unchanged.
