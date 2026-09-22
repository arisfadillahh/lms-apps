# LMS Clevio Project Router

Open this file first. Use the smallest relevant route below; do not scan the whole workspace.

## Project Contract

- Product: Clevio LMS for Admin, Coach, Coder, parents, trials, invoices, reports, notifications, and PWA.
- Stack: Next.js App Router, TypeScript, Supabase, Vitest, Tailwind/Radix, Baileys WhatsApp.
- Main flow: `src/app` route or API -> `src/lib/services` -> `src/lib/dao` -> Supabase.
- Reply concisely in Indonesian unless the user uses another language.
- `cek dulu`, `jangan ubah`, or a question means inspect and report without mutation.
- Never modify unrelated dirty files. `event-manager/` is a separate nested repository.
- Never commit credentials, `.env`, private keys, WhatsApp sessions, uploads, backups, logs, or production data.
- Never mutate production data merely to test. Prefer read-only probes, tests, or an explicitly approved test record.
- Keep global templates separate from class/runtime copies. Scope mutations by immutable IDs, never titles or display order.
- Schema changes must be additive/data-safe and include RLS, constraint, index, and existing-row review.
- Preserve responsive behavior, accessibility, authenticated ownership checks, and role boundaries.
- Production deployment and Git publication are separate. Do not claim completion until both are verified when requested.
- LMS WhatsApp auth is persistent production state. Deployment must not reset or replace it.

## Start Here

1. Run `rtk git status` and inspect relevant diffs.
2. Search `docs/error-fixing/index.md`, then the linked monthly log.
3. Open only the feature paths listed below.
4. Inspect adjacent UI, API, service, DAO, tests, and migrations before editing.
5. Fix the root cause with the smallest coherent change.
6. Add a focused regression test for deterministic behavior.
7. Append a new error-log entry for bug/regression work; never rewrite history.

## Root And Runtime

| Need | Open |
| --- | --- |
| Package scripts/dependencies | `package.json`, `package-lock.json` |
| Next.js config | `next.config.ts`, `next-env.d.ts` |
| Request auth/routing guard | `middleware.ts` |
| Global app shell/styles | `src/app/layout.tsx`, `src/app/globals.css` |
| Root, loading, 404 | `src/app/page.tsx`, `src/app/loading.tsx`, `src/app/not-found.tsx` |
| Environment mapping | `src/lib/env.ts`, `src/lib/runtimeUrl.ts` |
| Supabase clients/types | `src/lib/supabaseServer.ts`, `src/lib/supabaseBrowser.ts`, `src/types/supabase.ts` |
| Shared utilities | `src/lib/utils.ts`, `src/lib/routing.ts`, `src/lib/roles.ts`, `src/lib/permissions.ts` |
| Existing architecture overview | `SYSTEM_MAP.md` |
| PWA manifest/service worker | `public/manifest.webmanifest`, `public/sw.js`, `src/components/pwa/` |
| Nginx production config | `nginx/lms.clev.io.conf` |

## UI Route Map

### Admin

- Shell/navigation: `src/app/(admin)/admin/layout.tsx`, `src/app/(admin)/admin/AdminSidebar.tsx`, `src/components/admin/`.
- Dashboard: `src/app/(admin)/admin/dashboard/page.tsx`.
- Classes and participants: `src/app/(admin)/admin/classes/`, especially `[id]/`.
- Curriculum, blocks, lessons: `src/app/(admin)/admin/curriculum/`.
- Ekskul plans and lessons: `src/app/(admin)/admin/ekskul/`.
- Users and migration progress: `src/app/(admin)/admin/users/`.
- Reports and report inbox: `src/app/(admin)/admin/reports/`, `src/app/(admin)/admin/curriculum/reports/`.
- Evaluation templates/questions: `src/app/(admin)/admin/evaluations/`.
- Trial management/assessment: `src/app/(admin)/admin/free-trials/`, `src/app/(admin)/admin/trial-assessments/`.
- Billing: `src/app/(admin)/admin/payments/`, `src/app/(admin)/admin/settings/invoice/`.
- WhatsApp/broadcast: `src/app/(admin)/admin/whatsapp/`, `src/app/(admin)/admin/broadcast/`.
- Issue reports: `src/app/(admin)/admin/issue-reports/`.
- Software catalog: `src/app/(admin)/admin/software/`.
- Admin shared controls: `src/components/admin/`.

### Coach

- Shell/dashboard: `src/app/(coach)/coach/layout.tsx`, `src/app/(coach)/coach/dashboard/`, `src/components/coach/`.
- Classes and lessons: `src/app/(coach)/coach/classes/`, `src/app/(coach)/coach/lesson/[id]/`.
- Attendance: `src/app/(coach)/coach/sessions/[sessionId]/attendance/`.
- Rubrics/evaluations: `src/app/(coach)/coach/rubrics/`.
- Reports/review: `src/app/(coach)/coach/reports/`.
- Trial workflow: `src/app/(coach)/coach/trials/[id]/`.
- Make-up, leave, profile: `src/app/(coach)/coach/makeup/`, `leave/`, `profile/`.

### Coder

- Shell/dashboard: `src/app/(coder)/coder/layout.tsx`, `src/app/(coder)/coder/dashboard/`, `src/components/coder/`.
- Materials: `src/app/(coder)/coder/materials/`, including `[lessonId]/`.
- Reports/portfolio entry: `src/app/(coder)/coder/reports/`.
- Make-up/profile/settings: `src/app/(coder)/coder/makeup/`, `profile/`.

### Public And Reports

- Login/public routes: `src/app/(public)/`.
- Portfolio-related entry in this checkout starts from `src/app/(coder)/coder/reports/`; search `portfolio` across `src` before assuming a dedicated public route exists.
- Interactive reports: `src/app/report/`, `src/app/report-preview/`.
- Trial report: `src/app/trial-report/`.
- Certificate: `src/app/certificate/`.
- Evaluation forms: `src/app/(evaluations)/`.
- Short/public links: `src/app/i/`, `src/lib/services/shortLinks.ts`.

## API Router

All handlers live under `src/app/api/**/route.ts`. Start from the relevant group:

| Feature | API path |
| --- | --- |
| Admin classes/enrollment/schedule/progress | `src/app/api/admin/classes/` |
| Curriculum/blocks/lessons/software | `src/app/api/admin/curriculum/` |
| Ekskul plans/lessons | `src/app/api/admin/ekskul/` |
| Admin users/coders | `src/app/api/admin/users/`, `src/app/api/admin/coders/` |
| Evaluations/templates | `src/app/api/admin/evaluations/`, `src/app/api/admin/evaluation-templates/` |
| Reports | `src/app/api/admin/reports/`, `src/app/api/coach/reports/`, `src/app/api/coach/lesson-reports/` |
| Coach attendance/classes/evaluation | `src/app/api/coach/` |
| Coder dashboard/material/reflection | `src/app/api/coder/` |
| Trials | `src/app/api/free-trial/`, `src/app/api/admin/free-trials/`, `src/app/api/coach/trials/`, `src/app/api/trial-reports/` |
| Billing/invoices/payment callbacks | `src/app/api/admin/invoices/`, `src/app/api/admin/payments/`, `src/app/api/invoices/`, `src/app/api/midtrans/` |
| Notifications and push | `src/app/api/notifications/`, `src/app/api/push/` |
| WhatsApp | `src/app/api/admin/whatsapp/`, `src/app/api/whatsapp/` |
| Scheduled jobs | `src/app/api/cron/` |
| Issue reports | `src/app/api/issue-reports/`, `src/app/api/admin/issue-reports/` |

Search the exact endpoint name within `src/app/api` before opening unrelated route groups.

## Business Logic Router

| Domain | Service files |
| --- | --- |
| Class planning and cycles | `src/lib/services/classAutoPlanner.ts`, `classCycleProgress.ts`, `blockRuntime.ts` |
| Lesson scheduling/assignment/reflow | `lessonScheduler.ts`, `lessonAutoAssign.ts`, `lessonRebalancer.ts`, `lessonExtension.ts` |
| Lesson archive/publication | `lessonArchive.ts`, `lessonArchivePolicy.ts` |
| Ekskul synchronization | `ekskulLessonPlanSync.ts` |
| Coder data/dashboard/progress | `coder.ts`, `enrollmentEligibility.ts`, `dashboardPitchingDay.ts` |
| Coach tasks/dashboard | `coach.ts`, `coachClassSummary.ts` |
| Reports/AI generation | `aiReports.ts`, `aiReportGuards.ts`, `reportWindows.ts` |
| Trial lifecycle | `trialAvailability.ts`, `trialAssessmentContent.ts`, `trialClassNotifications.ts`, `trialConversion.ts`, `trialPricing.ts` |
| Invoice generation/payment | `invoiceGenerator.ts`, `invoicePaymentConfirmation.ts`, `invoicePublicAccess.ts` |
| Reminders | `classReminderScheduler.ts`, `paymentReminderScheduler.ts`, `reminderIdempotency.ts`, `whatsappReminder.ts` |
| WhatsApp runtime | `whatsappClient.ts`, `src/lib/whatsapp/` |
| Push notifications | `src/lib/pushNotifications.ts`, `src/lib/dao/notificationsDao.ts` |
| Google Calendar | `googleTrialCalendar.ts` |
| Certificates | `certificates.ts` |
| Portfolio/media storage | `avatarStorage.ts`, `avatarUploadSecurity.ts`, `src/lib/storage.ts` |
| Event Manager integration | `eventManagerWebhook.ts` |

All service paths in this table are relative to `src/lib/services/` unless otherwise stated.

## Database Router

DAO files live in `src/lib/dao/`:

- Users/classes/sessions/attendance: `usersDao.ts`, `classesDao.ts`, `sessionsDao.ts`, `attendanceDao.ts`.
- Curriculum/lessons/materials/software: `levelsDao.ts`, `blocksDao.ts`, `lessonTemplatesDao.ts`, `classLessonsDao.ts`, `materialsDao.ts`, `softwareDao.ts`, `blockSoftwareDao.ts`.
- Progress/access: `coderProgressDao.ts`, `coderSessionAccessDao.ts`.
- Reports/rubrics: `reportsDao.ts`, `rubricsDao.ts`.
- Invoices: `invoicesDao.ts`.
- Notifications/broadcast: `notificationsDao.ts`, `broadcastDao.ts`.
- Trials: `trialClassDao.ts`, `trialAssessmentsDao.ts`.
- Ekskul: `ekskulPlansDao.ts`, `exkulCompetenciesDao.ts`.
- Coach leave/make-up: `coachLeaveDao.ts`, `makeUpTasksDao.ts`.
- DAO export surface: `src/lib/dao/index.ts`.

Schema and migrations:

- Current generated types: `src/types/supabase.ts`.
- Baseline schema: `supabase/migrations/20260327041503_remote_schema.sql`.
- Versioned changes: `supabase/migrations/*.sql` and legacy `migrations/`.
- Never edit a historical production migration; add a new timestamped migration.

## Shared Components

- Design primitives: `src/components/ui/`.
- Layout/navigation/notifications: `src/components/layout/`.
- Admin controls: `src/components/admin/`.
- Coach controls: `src/components/coach/`.
- Coder controls/chatbot/banner: `src/components/coder/`.
- Profiles/settings: `src/components/profile/`.
- PWA install/notifications/splash: `src/components/pwa/`.
- Issue-report trigger: `src/components/issue-reports/`.
- Session provider: `src/components/providers/SessionProvider.tsx`.

## Authentication And Security

- Session helpers: `src/lib/auth.ts`, `src/lib/authOptions.ts`.
- Route protection: `middleware.ts`.
- Roles/permissions: `src/lib/roles.ts`, `src/lib/permissions.ts`.
- Passwords: `src/lib/passwords.ts`.
- Input validation is normally colocated with API routes using Zod.
- Validate ownership and role server-side; UI visibility is not authorization.

## Tests And Diagnosis

- Tests: `src/lib/__tests__/`.
- Vitest config: `vitest.config.ts`.
- Bug index: `docs/error-fixing/index.md`.
- Monthly root-cause logs: `docs/error-fixing/YYYY-MM.md`.
- Load test: `scripts/load-test-lms.mjs`, `locust/`.
- Operational scripts: `scripts/`.

For bug work, document: date/reference, symptom, evidence-based root cause, files/routes/tables changed, invariants, regression risks, exact verification, deployment, and remaining device/auth checks.

## Verification Route

Run in this order, scaled to risk:

1. Focused Vitest files.
2. `npx tsc --noEmit`.
3. `git diff --check`.
4. `npm run build` for route/API/shared/config changes.
5. Signed-out route/API smoke checks (`307`/`401`, no data leak).
6. Desktop and mobile browser QA for UI work.
7. After deployment: exact SHA, PM2 status/restarts, recent logs, public/protected smoke checks, and persistent WhatsApp auth path.

Use RTK-prefixed commands for compact output where supported, for example `rtk git status`, `rtk vitest`, `rtk tsc`, and `rtk next build`.

## Git And Deployment

- Canonical remote is configured as `origin`; never hardcode tokens.
- Fetch and check divergence before pushing.
- Stage files explicitly; never stage nested `event-manager/` accidentally.
- Do not commit build output, logs, screenshots, archives, sessions, uploads, backups, or `.env` files.
- Do not force-push or rewrite shared history unless explicitly requested.
- Production deployment uses the server release workflow; verify the active release matches the pushed commit.
- Keep rollback target available and do not touch `/root/lms/shared/baileys_auth_info`.

## Completion Gate

Before reporting completion, confirm the newest request is addressed, unrelated work is untouched, tests/build are reported accurately, no secrets/runtime data are staged, bug docs are current where applicable, deployed source matches committed source when deployment was requested, and remaining verification is stated explicitly.
