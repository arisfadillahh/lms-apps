# Compact payroll header — 4 November 2026

Status: local only. This follow-up replaces the large step banner and summary cards from the earlier payroll redesign. No production/VPS change, migration or live message.

## Result

- Title and one refresh icon; remove the repeated introduction.
- One period row holds month/year, status, calculation/finalization and expandable **Info periode**. Month/year also opens archives, so the second archive picker is removed.
- Search and filters sit beside the review/payment/history tabs. Remove the repeated panel title and descriptions.
- Recipient count and money totals are a compact line above the table. Payment-only totals remain available in payment.
- Remove the large step indicator and the payment button that repeated the payment tab.
- Remove repeated **Kirim WA** buttons from recipient rows. Check one or several recipients to reveal the same contextual send/transfer action. Transfer marking and sending remain separate; marking preserves selection.
- Keep warnings visible, deadline/finalization requirements under Info periode, review/payment/history separation, full details, compact slip preview and staff allowance dialogs.

At 1440×900, all five existing demo recipients fit without scrolling: the first row starts around y=456 and the last ends around y=784. Main content height decreased from 1,288px in the previous version to 740px. At 390×844, the first recipient starts around y=639 with no document-wide horizontal overflow; the wide table scrolls within its container.

## Verification

| Check | Result |
| --- | --- |
| Full Vitest suite | 728 tests / 129 files passed |
| TypeScript | `tsc --noEmit` and final Next build type checking passed |
| Scoped ESLint and whitespace | Passed |
| Default Next production build | Passed; 113 static pages generated with local placeholder environment values |
| `node scripts/qa-payroll-compact-local.mjs` | 8 scenario groups passed |
| `node scripts/qa-payroll-admin-local.mjs` | 8 scenario groups passed |
| Final browser errors and accidental downloads | Zero in both scripts |

Regression assertions cover first-screen table visibility, no duplicated payment/send buttons, preserved archive access through month/year, collapsed period information, draft payment gating, category filters/reset, normal admin login, eight other admin routes, staff allowance persistence, popup bounds, keyboard navigation, compact slips, retained selection after transfer and explicit sending. Financial POSTs in compact QA are intercepted in memory. Staff QA creates its own local recipient and deactivates it in cleanup; existing financial records are preserved.

Initial browser attempts timed out while the full suite and build were running concurrently. Both browser scripts subsequently passed at their existing timeout settings when run sequentially. The final build retains the pre-existing React 18 deprecation and WhatsApp filesystem-tracing notices.

The original integration QA script was adjusted to the single month/year archive control; its destructive fresh-fixture sequence was not rerun against the persisted demo database. Calculation, permissions, APIs and delivery services are unchanged.

Visual evidence was inspected on desktop and mobile. Local screenshots, ignored by Git: `.codex-payroll-local/screenshots/05-rekap-ringkas-desktop.png`, `06-rekap-ringkas-mobile.png`, `07-rekap-ringkas.png`, `08-pembayaran-ringkas.png`. Build output is `.codex-payroll-local/qa/dense-build.log`.

See [the current user guide](./payroll-user-guide.md) for using this layout.
