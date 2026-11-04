# Payroll detail forms and scheduled recap QA — 2026-11-04

Local implementation only. No deployment, VPS changes, real WhatsApp delivery, or activation of scheduled payroll automation.

## User flow

1. Open **Rincian** from a recipient. **Tambahan / potongan**, **Aktivitas manual**, and slip preview stay above the scrollable content.
2. Choosing an edit action displays its form in the same popup. **Kembali ke rincian** or Escape returns to the overview. Successful saves return automatically; errors keep the entered fields and focus the error message. Recalculate after saving to refresh payroll totals.
3. **Review absensi** is for checking attendance. Recaps are scheduled for the 25th at 09:00 WIB, with a 16:00 reminder and a firm coach correction deadline at 17:00. These messages contain attendance details only. The local configuration explicitly shows automation as disabled.
4. After the period ends and is finalized, open **Pembayaran & slip**, select recipients, and mark completed bank transfers. This button records payment; it does not transfer money. Send final slips with the separate send action after payment is recorded.
5. Exceptional manual recap resend is available under **Rincian → Pengiriman ulang & riwayat penerima**. An early manual send does not consume the scheduled recap.

## Automated verification

| Check | Result |
| --- | --- |
| Full Vitest suite | 733 tests / 129 files passed |
| TypeScript | `tsc --noEmit` passed |
| Scoped ESLint | Payroll UI, delivery service/tests and local QA scripts passed |
| Production build | Passed; 113 static pages generated |
| Whitespace | `git diff --check` passed |
| Signed-out access | API returns 401; page streams a login redirect without recipient data |
| Compact/detail browser QA | 8 scenario groups passed |
| Admin browser QA | 8 scenario groups passed |

Delivery regressions cover independent manual and scheduled recap deduplication, legacy early RECAP/REMINDER records, distinct LMS notification identities, and concurrent manual/automatic pending-send protection. Existing tests retain slip payment gating, retries, missing-contact fallback, access control and payroll calculations.

The browser fixture includes 113 lines, including 100 class sessions. Scrolling both the table and dialog body leaves action buttons visible. Forms replace the table without stacking dialogs, focus the first field, retain values after an intentional HTTP 400, and return to details after saving. Mobile form bounds and Escape/back behavior pass. Attendance detail remains complete while salary-slip class rows stay summarized.

Payment QA uses intercepted, in-memory commands. Mixed paid/unpaid selection marks only unpaid recipients and preserves selection for the subsequent slip send. Review has neither payment checkboxes nor a manual recap button. Finalized periods, archives, normal admin navigation, staff WhatsApp contacts, recurring allowances, preview dialogs and mobile settings all pass. Staff QA creates and deactivates its own demo staff record; it does not mutate existing finance documents.

## Runtime and limitations

After building, the existing development server briefly returned malformed-cache/navigation errors. Restarting the local runner without resetting its database restored normal responses. Both browser scripts were then rerun sequentially and passed. The existing period document was compared before and after and remained identical at revision 27. Local automation remains disabled, and outbound WhatsApp remains simulated.

The browser form-error test intentionally generates one HTTP 400 and records it separately. There are no unexpected browser exceptions, console errors or PDF downloads. The build retains existing React 18 deprecation and WhatsApp filesystem-tracing warnings. No real bank transfer, real WhatsApp recipient, live scheduler or production device was exercised.

## Local evidence (ignored runtime artifacts)

- `.codex-payroll-local/qa/compact-results.json`
- `.codex-payroll-local/qa/admin-followup-results.json`
- `.codex-payroll-local/qa/detail-flow-build.log`
- `.codex-payroll-local/qa/detail-toolbar-long-list.png`
- `.codex-payroll-local/qa/detail-activity-mobile.png`
- `.codex-payroll-local/screenshots/09-form-tambahan.png`
- `.codex-payroll-local/screenshots/10-rincian-toolbar.png`
- `.codex-payroll-local/screenshots/11-form-aktivitas.png`

Usage: [Payroll user guide](./payroll-user-guide.md).
