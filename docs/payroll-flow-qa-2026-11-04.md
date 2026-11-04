# Payroll flow and UI QA — 4 November 2026

Status: implemented and verified locally. No deployment, production migration, VPS changes, bank transfer or live WhatsApp message.

## Result and usage

The default period screen now separates **Rekap penerima**, **Pembayaran & slip**, and **Riwayat periode**. A four-step indicator explains the next action: prepare, check/finalize, record completed transfer, then send the slip. Draft periods open at review; final periods open at payment. The admin dashboard colors, typography, buttons and Clevio slip design are preserved.

Select recipients to reveal the bulk action. Review sends attendance text without money or attachments. Payment records completed bank transfers, retains the selection, then offers slip sending as a separate action. History holds audit, revision and delivery recovery controls.

Details show the attendance table first; **Tambahan / potongan** and **Aktivitas manual** reveal one form at a time. Profile/allowance forms open in a popup only when adding or editing. Settings have separate activity-rate, class-mode and automation tabs. The activity-review page has its own period picker. Search remains visible; extra filters and archive/deadline information are expandable.

See [the updated user guide](./payroll-user-guide.md) for monthly payroll, recurring staff allowances, monthly adjustments, archives, correction deadlines and delivery procedures.

## Verification

| Check | Result |
| --- | --- |
| Full Vitest regression suite | 728 tests across 129 files passed |
| TypeScript | `tsc --noEmit` and Next build type checking passed |
| Scoped ESLint | Changed payroll components and three QA scripts passed |
| Default Next production build | Passed; 113 static pages generated using local placeholder environment values |
| Compact/workflow browser QA | 8 scenario groups passed |
| Normal-login/admin browser QA | 7 scenario groups passed |
| Whitespace | `git diff --check` passed |
| Browser errors/downloads | Zero console errors, browser exceptions or accidental downloads in both final QA runs |

The build retains an existing WhatsApp dynamic-filesystem tracing warning and React 18 deprecation notice. Neither originates in this UI change.

Browser commands, while the isolated local preview is running:

```sh
node scripts/qa-payroll-compact-local.mjs
node scripts/qa-payroll-admin-local.mjs
```

The compact/workflow script intercepts financial POST requests in browser memory. It checks collapsed filters and reset, draft payment gating, review/payment/history navigation, on-demand adjustment forms, one-row class summaries with full attendance preserved, mixed paid/unpaid selection, retained selection after transfer, explicit sending, final-period default navigation and mobile width. It also generates the existing compact slip PDF and fetches an archived PDF without changing stored finance data.

The admin script uses normal local login, visits eight existing admin routes, checks both payroll popups, creates and reloads one synthetic staff profile with recurring allowances/WA, then deactivates that QA profile in cleanup. It verifies mobile profile/detail/preview bounds, settings isolation, keyboard tab navigation and the activity period picker. Current and archived financial documents are preserved.

Additional read-only browser checks opened the real August archive (final v2), verified payment as its default and admin revision under history, then returned to November draft/review. Desktop and 390px mobile screenshots were inspected. At 1440px, the default main content decreased from 1,854px to 1,288px with the same five recipients; audit and unused tools no longer occupy the initial view. Mobile tables retain contained horizontal scrolling.

QA found and fixed a resize issue: the dialog's inherited transition briefly animated its height beyond the viewport. Payroll popups now restrict that transition to opacity. The mobile resize assertion passed afterward. Review filters were also limited to recipient categories, with transfer/delivery filters confined to payment and explicit accessible names added.

Local artifacts are ignored by Git under `.codex-payroll-local/qa/`: `flow-review-desktop.png`, `flow-mobile.png`, `flow-payment-mobile.png`, `profile-mobile-resized.png`, `staff-allowances-mobile.png`, both browser JSON reports and `flow-build.log`.

The original 16-group integration QA script was updated for the new settings/archive navigation but not rerun against the existing demo database because it expects fresh fixtures and changes payroll records. Its prior result is recorded in [the integration QA report](./payroll-qa-2026-11-04.md). Payroll business rules, APIs, permissions, data migrations, calculation and delivery services are unchanged in this follow-up. Live WhatsApp delivery remains for a separately authorized production activation.
