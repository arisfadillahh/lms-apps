# Clevio Event Manager Production MVP Plan

## Scope Decision

Clevio Event Manager is a separate app/dashboard from LMS. It must not become an LMS admin module and must not read or write LMS invoice/payment tables directly.

The allowed LMS dependency is LMS Core API only:
- Invoice creation and payment link generation.
- Invoice status lookup and resend.
- WhatsApp automation.
- Payment status webhook back to Event Manager.
- Certificate generation later.

The Event Manager owns program setup, forms, schedules, quota, registrations, pricing rules, add-ons, device orders, pitching day, and local mirrors of invoice/payment status.

For UI, Event Manager should follow the current LMS admin dashboard visual language: sidebar shell, dense admin tables, compact cards, filter bars, status chips, and operational dashboard layout. It should not share the LMS database to achieve that look.

The registration form system is not a rough MVP, temporary page, hardcoded Holiday Class page, or admin-only placeholder. The first implementation must be production-ready: template-based, config-driven, polished, multi-step, responsive, backend-validated, secure by default, and suitable for real customer registration.

Implementation placement:
- Build inside the LMS workspace, but as a different app and different git repository.
- App folder: `event-manager`.
- Separate runtime process from LMS.
- Separate database from LMS.
- Same VPS and same host, with a different path on `lms.clev.io`.
- Default route base path: `/event-manager`.

## Feature Flow

1. Admin creates or edits a program.
   - Program data includes event period, mode, platform, default duration, registration cutoff rule, feature flags, levels, classes, packages, pricing, add-ons, forms, and certificate/pitching-day settings.
   - Holiday Class Clevio 2026 is only the first seeded program, not hardcoded business logic.

2. Admin configures schedules and quota.
   - Classes have batches.
   - Batches have one or more sessions.
   - Session count is flexible: 3 sessions, 7 sessions, or custom.
   - Quota is tracked at batch level for MVP, defaulting to 10 for Holiday Class.

3. Public form or Alpha Omega form loads program config.
   - Public form uses `price_type = normal`.
   - Alpha Omega form uses `price_type = alpha_omega` and must require a valid token/code before form data and pricing can be used.
   - Form steps and fields are driven by `program_forms`, `program_form_steps`, and `program_form_fields`, not hardcoded per page.
   - The frontend renders the form from template/config and handles preview, closed-form states, success states, and recoverable error states.

4. Parent/student data is entered.
   - Student grade maps to a program level.
   - For Holiday Class:
     - Explorer: kelas 1-3 SD.
     - Creator: kelas 4-6 SD.
     - Innovator: kelas 7 SMP-12 SMA.

5. Participant selects package.
   - Single Class: exactly one class/batch.
   - Bundling Journey: exactly three different classes, same level, unique class/software, one class per week, participant may choose order freely.

6. Form syncs available schedules.
   - The frontend fetches availability from Event Manager API after level/package/class choices change.
   - API returns only selectable batches with available slots.
   - Submit performs a final backend quota check inside the same reservation transaction.
   - If quota changed between selection and submit, the backend rejects and returns the latest availability.

7. Backend calculates price.
   - Frontend never submits a trusted total.
   - Backend resolves price from `program_pricings`, selected form `price_type`, detected level, selected package, selected classes, and add-ons.
   - Backend validates the calculated total against generated line items before calling LMS.
   - If admin configured registration notes such as minimum laptop specifications, they are shown in the final review before the customer submits.

8. Registration is created as reserved or pending invoice.
   - Event Manager creates `external_reference`, for example `REG-HC2026-000123`.
   - Selected slots are reserved with an expiration tied to invoice expiry.
   - Registration items and add-ons are persisted before invoice creation.

9. Event Manager calls LMS Core API.
   - Event Manager sends invoice line items to LMS `POST /api/invoices`.
   - LMS returns invoice ID, invoice number, payment link, status, and expiry.
   - Event Manager stores these in `invoice_references` as a mirror only.
   - LMS remains source of truth for payment status.

10. WhatsApp is sent through LMS.
    - Event Manager may request LMS WhatsApp automation via `POST /api/whatsapp/send`.
    - Invoice resend uses `POST /api/invoices/:id/resend`.
    - Event Manager stores local integration status/logs only.
    - If invoice creation succeeds but WhatsApp sending fails, the public success page still shows the invoice/payment link. WhatsApp failure is logged and visible to admin, but it does not block registration.

11. LMS sends invoice webhook.
    - `paid` makes registration paid/confirmed.
    - `expired` makes registration expired and releases reserved slots.
    - `cancelled` makes registration cancelled and releases reserved slots.
    - Every webhook payload is stored in `webhook_logs` for audit and retry debugging.

## Database Schema

Event Manager should use its own database connection/project. Do not reuse LMS invoice/payment tables.

### programs

Stores program/event instances.

Key fields:
- `id`
- `slug`
- `name`
- `period_start`
- `period_end`
- `mode`
- `platform`
- `default_session_duration_minutes`
- `default_quota_per_batch`
- `registration_cutoff_rule`
- `has_levels`
- `has_bundling`
- `has_addons`
- `has_pitching_day`
- `has_certificates`
- `has_livestream_permission`
- `status`
- `created_at`
- `updated_at`

### program_levels

Stores level definitions per program.

Key fields:
- `id`
- `program_id`
- `code`
- `name`
- `grade_min`
- `grade_max`
- `grade_label`
- `sort_order`

### program_classes

Stores class/software options under a program level.

Key fields:
- `id`
- `program_id`
- `level_id`
- `slug`
- `name`
- `software_key`
- `requires_device`
- `is_active`
- `sort_order`

### program_batches

Stores selectable schedule slots and cached quota counters.

Important:
- `reserved_count` and `confirmed_count` are cached counters only.
- The source of truth for slot occupancy is `registration_items` plus registration/payment status.
- If counters are used, they must be updated transactionally with registration item status changes.
- A reconciliation job must recalculate counters from `registration_items`.

Key fields:
- `id`
- `program_id`
- `class_id`
- `batch_code`
- `week_no`
- `starts_at`
- `ends_at`
- `timezone`
- `quota`
- `reserved_count`
- `confirmed_count`
- `status`

### program_sessions

Stores session details under a batch.

Key fields:
- `id`
- `batch_id`
- `session_no`
- `title`
- `starts_at`
- `ends_at`
- `duration_minutes`
- `meeting_platform`
- `meeting_url`

### program_packages

Stores package rules.

Key fields:
- `id`
- `program_id`
- `code`
- `name`
- `min_classes`
- `max_classes`
- `same_level_only`
- `unique_class_required`
- `unique_software_required`
- `one_class_per_week`
- `selection_order`
- `is_active`

### program_pricings

Stores pricing by form price type, level, and package.

Key fields:
- `id`
- `program_id`
- `price_type`
- `level_id`
- `package_id`
- `price`
- `currency`
- `effective_from`
- `effective_until`
- `is_active`

Holiday Class seed:
- Normal: Explorer single 350000, bundling 900000; Creator single 425000, bundling 1100000; Innovator single 500000, bundling 1300000.
- Alpha Omega: Explorer single 325000, bundling 900000; Creator single 400000, bundling 1100000; Innovator single 450000, bundling 1300000.

### program_addons

Stores add-ons and device options.

Key fields:
- `id`
- `program_id`
- `code`
- `name`
- `price`
- `currency`
- `applies_to_class_id`
- `selection_type`
- `is_required_choice`
- `is_active`
- `admin_notes`

Holiday Class seed:
- Microbit Device: 300000, applies to Microbit, participant chooses own device or buy from Clevio.
- Arduino Device: 350000, applies to Arduino, participant chooses simulator, own device, or buy from Clevio.

### program_forms

Stores form links, access rules, template selection, and lifecycle status.

Key fields:
- `id`
- `program_id`
- `slug`
- `name`
- `description`
- `template_key`
- `price_type`
- `access_type`
- `access_code_hash`
- `token_hash`
- `status`
- `starts_at`
- `ends_at`
- `max_submissions`
- `success_title`
- `success_message`
- `is_active`
- `created_at`
- `updated_at`

Holiday Class seed:
- Public form: `price_type = normal`, public access.
- Alpha Omega form: `price_type = alpha_omega`, code/token protected.

### program_form_steps

Stores reusable step/section definitions for multi-step forms.

Key fields:
- `id`
- `form_id`
- `step_key`
- `title`
- `description`
- `admin_review_notes`
- `sort_order`
- `visibility_json`
- `is_active`

### program_form_fields

Stores dynamic form field definitions.

Key fields:
- `id`
- `form_id`
- `step_key`
- `field_key`
- `label`
- `help_text`
- `placeholder`
- `field_type`
- `is_required`
- `default_value_json`
- `options_json`
- `validation_json`
- `visibility_json`
- `ui_json`
- `sort_order`
- `is_active`

### form_access_tokens

Stores hashed one-time or reusable access tokens/codes for protected forms.

Key fields:
- `id`
- `form_id`
- `token_hash`
- `code_hash`
- `label`
- `max_uses`
- `used_count`
- `starts_at`
- `expires_at`
- `is_active`
- `created_at`

### form_submission_events

Stores lightweight analytics events and error telemetry for forms.

Key fields:
- `id`
- `program_id`
- `form_id`
- `registration_id`
- `session_id`
- `event_type`
- `step_key`
- `ip_address`
- `user_agent`
- `metadata_json`
- `occurred_at`

Event types should support:
- `visit`
- `started`
- `step_completed`
- `quote_requested`
- `quote_failed`
- `submitted`
- `invoice_created`
- `paid`
- `abandoned`
- `error`

### registrations

Stores registration lifecycle.

Key fields:
- `id`
- `program_id`
- `form_id`
- `external_reference`
- `parent_name`
- `parent_whatsapp`
- `parent_email`
- `student_name`
- `student_grade_raw`
- `student_grade_normalized`
- `student_school`
- `level_id`
- `package_id`
- `livestream_permission`
- `policy_agreed_at`
- `status`
- `payment_status`
- `reservation_expires_at`
- `subtotal`
- `addon_total`
- `total`
- `currency`
- `invoice_error_message`
- `invoice_retryable`
- `admin_notes`
- `submitted_at`
- `confirmed_at`
- `cancelled_at`
- `expired_at`

Explicit registration statuses:
- `pending_invoice`
- `invoice_failed`
- `waiting_payment`
- `paid`
- `confirmed`
- `expired`
- `cancelled`
- `completed`

Grade handling:
- Store the user-facing grade value in `student_grade_raw`.
- Store the mapped canonical grade value in `student_grade_normalized`.
- Grade-to-level mapping must clearly support SD, SMP, and SMA, for example `sd_1`, `sd_2`, `sd_3`, `sd_4`, `sd_5`, `sd_6`, `smp_7`, `smp_8`, `smp_9`, `sma_10`, `sma_11`, `sma_12`.

### registration_items

Stores selected class/batch line items.

Key fields:
- `id`
- `registration_id`
- `program_class_id`
- `program_batch_id`
- `week_no`
- `item_name`
- `qty`
- `unit_price`
- `line_total`
- `slot_status`
- `reserved_at`
- `confirmed_at`
- `released_at`

Slot statuses:
- `reserved`
- `confirmed`
- `released`
- `expired`
- `cancelled`

Bundling registrations reserve multiple batches, so slot lifecycle is tracked per `registration_items` row, not only at registration level.

### registration_addons

Stores selected add-ons/devices.

Key fields:
- `id`
- `registration_id`
- `program_addon_id`
- `program_class_id`
- `choice`
- `qty`
- `unit_price`
- `line_total`

### invoice_references

Stores local mirror of LMS invoices.

Key fields:
- `id`
- `registration_id`
- `external_reference`
- `lms_invoice_id`
- `invoice_number`
- `payment_link`
- `status`
- `amount`
- `expired_at`
- `paid_at`
- `last_synced_at`
- `admin_notes`
- `raw_response_json`

### webhook_logs

Stores webhook audit data.

Key fields:
- `id`
- `source`
- `event_type`
- `event_id`
- `external_reference`
- `payload_json`
- `signature_valid`
- `processing_status`
- `error_message`
- `received_at`
- `processed_at`

### device_orders

Stores device fulfillment tracking after payment is paid/confirmed.

Before payment, device choices stay only in `registration_addons`. Device orders become active and fulfillment-needed only after the LMS-authoritative payment status reaches paid/confirmed.

Key fields:
- `id`
- `registration_id`
- `registration_addon_id`
- `device_type`
- `status`
- `fulfillment_notes`
- `admin_notes`
- `delivered_at`

### reconciliation_logs

Stores scheduled cleanup/reconciliation results.

Key fields:
- `id`
- `job_name`
- `status`
- `started_at`
- `finished_at`
- `summary_json`
- `error_message`

### audit_logs

Stores important admin and system actions.

Key fields:
- `id`
- `actor_type`
- `admin_id`
- `action`
- `entity_type`
- `entity_id`
- `old_value_json`
- `new_value_json`
- `reason`
- `ip_address`
- `user_agent`
- `created_at`

Required audited actions:
- Program create/update.
- Pricing update.
- Batch quota/status update.
- Form access update.
- Invoice resend.
- Payment manual override.
- Device status update.
- Certificate generation later.

### pitching_day_entries

Stores phase-2 pitching day state.

Key fields:
- `id`
- `program_id`
- `registration_id`
- `student_name`
- `project_title`
- `entry_status`
- `schedule_at`
- `notes`

### certificates

Phase 2 mirror/status table for LMS certificate generation.

Key fields:
- `id`
- `program_id`
- `registration_id`
- `template_key`
- `lms_certificate_id`
- `status`
- `generated_at`
- `download_url`
- `raw_response_json`

## Production Form System

The Event Manager form system must ship production-grade in version 1. It should be reusable for future programs with different fields, prices, schedules, package rules, add-ons, certificates, and policies.

### Form architecture

Required architecture:
- `program_forms` controls slug, name, template, access type, price type, active/closed status, success copy, and availability window.
- `program_form_steps` controls visible sections and ordering.
- `program_form_fields` controls labels, help text, required state, validation, field options, UI hints, and conditional visibility.
- Field visibility rules are evaluated from current form state, detected level, selected package, selected classes, add-ons, access state, and program feature flags.
- Backend endpoints re-evaluate all visibility and validation rules. Frontend visibility is for UX only, never security.
- Form preview uses the same renderer and config source as the public form, with admin preview mode.
- Success page is part of the template and displays registration summary, invoice number, payment status, payment link, and WhatsApp resend state when available.
- Error states must be intentional screens or inline messages, not generic crashes.

### Public form visual standard

The public registration UI should be polished and parent-friendly:
- Bright Clevio-style interface with blue, teal, and green accents.
- Mobile-first responsive layout.
- Readable typography and clear hierarchy.
- Stepper/progress bar.
- Card-based package selection.
- Schedule selection cards.
- Remaining slot indicator.
- Full or closed schedules disabled with clear status.
- Conditional device/add-on section.
- Policy agreement section.
- Final summary before submit.
- Price breakdown with line items and total.
- Loading states for config load, access validation, quote, submit, and invoice creation.
- Inline validation messages.
- Success page with invoice/payment link.
- Primary CTA text: `Daftar & Buat Invoice`.

### Holiday Class production flow

Holiday Class Clevio 2026 should be implemented as a high-quality template configuration, not a hardcoded page.

Step 1: Data Orang Tua
- `parent_name`
- `parent_whatsapp`
- `parent_email`

Step 2: Data Anak
- `student_name`
- `student_grade`
- `student_school`
- Auto-detect level from grade.
- Show detected level to user.

Step 3: Pilih Paket
- Single Class.
- Bundling Journey.
- Show package explanation and price based on detected level and validated form `price_type`.

Step 4: Pilih Jadwal
- Single: show available schedules matching detected level and allow one selected batch.
- Bundling: show Week 1, Week 2, and Week 3 selectors.
- Bundling selectors only show schedules matching detected level.
- Bundling disables already-selected class/software in other weeks.
- Show remaining slots, batch dates, and times.
- Validate unique class/software and one class per week.

Step 5: Device/Add-on
- Show only if selected classes include Microbit or Arduino.
- Microbit choices:
  - `Saya sudah punya device Microbit sendiri`
  - `Saya ingin membeli device Microbit dari Clevio (+Rp300.000)`
- Arduino choices:
  - `Tanpa device, menggunakan simulator`
  - `Saya sudah punya device Arduino sendiri`
  - `Saya ingin membeli device Arduino dari Clevio (+Rp350.000)`

Step 6: Izin & Persetujuan
- Livestream permission yes/no.
- Policy agreement checkboxes:
  - Kelas online via Zoom.
  - Durasi 90 menit per sesi.
  - Tidak ada extra class / penyusulan / pengganti sesi.
  - Pembatalan setelah pembayaran tidak dapat direfund.
  - Setuju dengan kebijakan program.

Step 7: Ringkasan
- Parent data.
- Student data.
- Detected level.
- Selected package.
- Selected classes/schedules.
- Device choices.
- Livestream permission.
- Price breakdown.
- Total.
- Submit button with `Daftar & Buat Invoice`.

### Alpha Omega form security

Alpha Omega security rules:
- Token/code validation is required before showing Alpha Omega pricing.
- Alpha Omega price data must not be returned by config or quote endpoints until access is valid.
- Alpha Omega form config must not expose protected pricing, package prices, or discount-specific labels before access validation.
- Backend enforces `price_type` from the resolved `program_forms` record.
- Public forms cannot switch to `alpha_omega` by sending a frontend value.
- Access token/code is stored hashed and checked server-side.
- Quote and submit endpoints require the same validated access context for protected forms.
- Failed access attempts are logged as form analytics/security events.
- Failed token/code attempts are rate-limited by form, IP address, and submitted code/token fingerprint.
- Admin can see failed access attempts without seeing plaintext submitted token/code values.

### Quote endpoint

`POST /api/forms/:slug/quote` must:
- Validate form status and access context.
- Validate grade-level mapping.
- Validate package rules.
- Validate selected schedules against current availability.
- Validate add-on/device rules.
- Calculate backend price from `program_pricings` and `program_addons`.
- Return line items, add-on items, total, availability status, and warnings.
- Never trust client-sent total or client-sent `price_type`.

### Submit endpoint

`POST /api/forms/:slug/submit` must:
- Validate access.
- Validate all required and conditionally required fields.
- Validate grade-level mapping.
- Validate package rules.
- Validate schedule availability.
- Validate device/add-on rules.
- Recalculate quote server-side.
- Reserve slot transactionally.
- Create registration.
- Call LMS create invoice API.
- Store invoice reference.
- Return success page data with payment link.
- Trigger LMS WhatsApp/send or invoice notification after invoice creation.

If LMS invoice creation fails:
- Set registration status to `invoice_failed`.
- Release the reserved slot or mark it retryable with a short reservation expiry.
- Store failure metadata for admin.
- Show a friendly customer message.
- Surface the failure in admin dashboard and form analytics.

If LMS invoice creation succeeds but LMS WhatsApp sending fails:
- Keep registration/invoice success.
- Show invoice number and payment link on the success page.
- Log the WhatsApp failure in integration logs and admin dashboard.
- Allow admin to resend invoice/WhatsApp later.

### Production error handling

The form must handle:
- Schedule became full before submit.
- Invoice creation failed.
- Invalid Alpha Omega code.
- Expired, inactive, or closed form.
- Missing required fields.
- Invalid grade-level mapping.
- Invalid package or duplicate bundling class/software.
- Invalid add-on choice.
- Network/server errors.

Error handling should return structured error codes so the frontend can show specific messages and refresh availability or quote data when needed.

### Admin form settings

Admin should be able to:
- Create/manage multiple forms per program.
- Set form name and slug.
- Set access type: public, code, or token.
- Set `price_type`: normal or alpha_omega.
- Activate/deactivate form.
- Edit visible labels and help text.
- Set required fields.
- Configure field visibility rules from supported rule presets.
- Preview the form.
- Copy public form link.
- Copy Alpha Omega form link.
- View form submissions.
- View form error events.

### Form analytics

Basic analytics should be captured from the first version:
- Total visits.
- Started.
- Submitted.
- Invoice created.
- Paid.
- Abandoned.
- Error count.

This can start as event rows plus aggregated dashboard queries. The schema should allow later funnel charts and per-step drop-off reporting.

## Payment Authority and Manual Override

LMS remains the source of truth for payment status.

Event Manager stores payment status as a local mirror and updates it from:
- LMS invoice create response.
- LMS webhook.
- Scheduled LMS invoice sync.
- Admin manual override only when explicitly allowed.

If manual override is implemented, it must:
- Create an `audit_logs` entry.
- Store admin ID.
- Store reason.
- Store old status.
- Store new status.
- Store timestamp, IP address, and user agent.
- Never mutate LMS payment records directly.

## Cleanup and Reconciliation Jobs

Required scheduled jobs:
- Release reservations where `reservation_expires_at < now`.
- Sync still-waiting invoices from LMS.
- Reconcile batch counters from `registration_items`.
- Log reconciliation results in `reconciliation_logs`.

Reservation cleanup:
- Find registrations still waiting for payment with expired reservation windows.
- Mark registration/items expired when appropriate.
- Set affected `registration_items.slot_status = expired` or `released`.
- Update cached batch counters transactionally.

Invoice sync:
- Find invoice references with waiting/pending status.
- Call LMS `GET /api/invoices/:id`.
- Apply LMS-authoritative payment state.
- Trigger slot confirmation or release based on status.

Batch counter reconciliation:
- Recalculate `reserved_count` from active `registration_items.slot_status = reserved`.
- Recalculate `confirmed_count` from `registration_items.slot_status = confirmed`.
- Store before/after counts in `reconciliation_logs`.

## LMS API Integration Contract

All calls should use server-side credentials only. Recommended environment variables:
- `LMS_API_BASE_URL`
- `LMS_API_TOKEN`
- `LMS_WEBHOOK_SECRET`
- `EVENT_MANAGER_PUBLIC_URL`

### Create invoice

`POST /api/invoices`

Event Manager sends:
- `external_reference`
- `customer`
- `student`
- `items`
- `total`
- `expired_at`
- `callback_url`

Rules:
- `external_reference` should be idempotent.
- LMS should reject duplicate references unless returning the existing invoice safely.
- Event Manager stores the response in `invoice_references`.

### Get invoice status

`GET /api/invoices/:id`

Used by admin manual refresh and scheduled reconciliation. LMS status remains authoritative.

### Resend invoice

`POST /api/invoices/:id/resend`

Used by admin action to resend invoice payment link through LMS WhatsApp automation.

### Send WhatsApp message

`POST /api/whatsapp/send`

Used for registration or operational messages that must go through existing LMS WhatsApp automation.

### LMS invoice webhook

`POST /webhooks/lms/invoice`

Payload:

```json
{
  "invoice_id": "INV-2026-000123",
  "external_reference": "REG-HC2026-000123",
  "status": "paid",
  "paid_at": "2026-06-10T13:20:00+07:00",
  "amount": 1400000
}
```

Recommended headers:
- `X-LMS-Event-Id`
- `X-LMS-Signature`
- `X-LMS-Timestamp`

Processing rules:
- Verify signature before mutating registration state.
- Insert `webhook_logs` first.
- Process idempotently by `event_id` or payload hash.
- Lock registration row while applying status transition.
- `paid`: set registration `paid/confirmed`, increment confirmed count, keep slot.
- `expired`: set registration expired, release reserved slot.
- `cancelled`: set registration cancelled, release reserved slot.

## Event Manager API Surface

Public/form APIs:
- `GET /api/forms/:slug/config`
- `POST /api/forms/:slug/validate-access`
- `GET /api/forms/:slug/preview`
- `POST /api/forms/:slug/events`
- `GET /api/programs/:programId/availability`
- `POST /api/forms/:slug/quote`
- `POST /api/forms/:slug/submit`

Admin APIs:
- `GET /api/admin/programs`
- `POST /api/admin/programs`
- `PATCH /api/admin/programs/:id`
- `GET /api/admin/programs/:id/setup`
- `PUT /api/admin/programs/:id/setup`
- `GET /api/admin/programs/:id/levels`
- `POST /api/admin/programs/:id/levels`
- `PATCH /api/admin/levels/:id`
- `GET /api/admin/programs/:id/classes`
- `POST /api/admin/programs/:id/classes`
- `PATCH /api/admin/classes/:id`
- `GET /api/admin/programs/:id/packages`
- `POST /api/admin/programs/:id/packages`
- `PATCH /api/admin/packages/:id`
- `GET /api/admin/programs/:id/pricings`
- `POST /api/admin/programs/:id/pricings`
- `PATCH /api/admin/pricings/:id`
- `GET /api/admin/programs/:id/addons`
- `POST /api/admin/programs/:id/addons`
- `PATCH /api/admin/addons/:id`
- `GET /api/admin/programs/:id/batches`
- `POST /api/admin/programs/:id/batches`
- `PATCH /api/admin/batches/:id`
- `GET /api/admin/batches/:id/sessions`
- `POST /api/admin/batches/:id/sessions`
- `PATCH /api/admin/sessions/:id`
- `GET /api/admin/programs/:id/forms`
- `POST /api/admin/programs/:id/forms`
- `PATCH /api/admin/forms/:id`
- `GET /api/admin/forms/:id/steps`
- `POST /api/admin/forms/:id/steps`
- `PATCH /api/admin/form-steps/:id`
- `GET /api/admin/forms/:id/fields`
- `POST /api/admin/forms/:id/fields`
- `PATCH /api/admin/form-fields/:id`
- `POST /api/admin/forms/:id/access-tokens`
- `PATCH /api/admin/form-access-tokens/:id`
- `GET /api/admin/forms/:id/submissions`
- `GET /api/admin/forms/:id/analytics`
- `GET /api/admin/registrations`
- `GET /api/admin/registrations/:id`
- `PATCH /api/admin/registrations/:id/notes`
- `POST /api/admin/registrations/:id/payment-override`
- `POST /api/admin/invoices/:id/resend`
- `POST /api/admin/invoices/:id/refresh`
- `PATCH /api/admin/invoices/:id/notes`
- `GET /api/admin/device-orders`
- `PATCH /api/admin/device-orders/:id`
- `PATCH /api/admin/device-orders/:id/notes`
- `GET /api/admin/integration-logs`
- `GET /api/admin/webhook-logs`
- `GET /api/admin/reconciliation-logs`
- `POST /api/admin/jobs/release-expired-reservations`
- `POST /api/admin/jobs/sync-invoices`
- `POST /api/admin/jobs/reconcile-batch-counters`
- `GET /api/admin/audit-logs`

Webhook:
- `POST /webhooks/lms/invoice`

## Quota Sync Rules

Quota correctness is critical for the form.

Required behavior:
- Availability API computes `available_slots` from the source-of-truth registration item rows, with cached counters used only as a fast read optimization when reconciled.
- Active reservations are `registration_items.slot_status = reserved` where the parent registration has unpaid invoice status and `reservation_expires_at > now`.
- Confirmed occupancy is `registration_items.slot_status = confirmed`.
- Expired reservations are ignored or cleaned up before availability is returned.
- Submit runs backend validation again and reserves slots transactionally.
- A batch cannot be over-reserved even with simultaneous submissions.
- Webhook `paid` confirms the reservation.
- Webhook `expired` or `cancelled` releases the reservation.
- Admin schedule changes recalculate availability immediately.
- Cached `program_batches.reserved_count` and `program_batches.confirmed_count` must be updated transactionally and reconciled by scheduled job.

Implementation note:
- Use database transaction/row lock for selected batches during registration submit.
- Add constraints/indexes around active reservation lookup by `program_batch_id`, `slot_status`, registration status, payment status, and `reservation_expires_at`.

## Holiday Class Clevio 2026 Seed

Program:
- Name: Holiday Class Clevio 2026.
- Period: 15 Juni 2026 - 5 Juli 2026.
- Mode: online.
- Platform: Zoom.
- Default session duration: 90 minutes.
- Quota per batch: 10.
- No minimum participant.
- Registration until H-1 before class starts if slot available.
- Has levels, bundling, add-ons, pitching day, certificates, livestream permission.

Levels/classes:
- Explorer: Kodu, Scratch Jr., Minecraft Builder.
- Creator: Minecraft Coding, Microbit, App Inventor.
- Innovator: Blender 3D, Vibe Coding, n8n Automation, Arduino.

Packages:
- Single Class: choose one batch/schedule.
- Bundling Journey: choose three different classes, one class per week, same level, unique class/software required, free order selection.

Forms:
- Public form: normal price.
- Alpha Omega form: Alpha Omega price, token/code protected.

## MVP Implementation Steps

0. Scaffold separate Event Manager app.
   - Preferred shape: separate Next.js app/service with its own env and database connection.
   - It may live in the same repository for deployment convenience, but the runtime app and DB must remain separate from LMS.
   - App folder is `event-manager` with its own git repository.
   - Use a separate port, for example `3007`, behind Nginx on the same VPS.
   - Serve from `https://lms.clev.io/event-manager`.

1. Database migrations.
   - Add all MVP tables except certificate generation internals can be phase 2.
   - Include production form tables: `program_forms`, `program_form_steps`, `program_form_fields`, `form_access_tokens`, and `form_submission_events`.
   - Include slot lifecycle fields on `registration_items`.
   - Include `audit_logs` and `reconciliation_logs`.
   - Add indexes for `external_reference`, form slug, invoice ID, registration status, active reservations, webhook idempotency, access token lookup, and form analytics.

2. Seed Holiday Class config.
   - Seed program, levels, classes, packages, pricing, add-ons, and two form links.
   - Keep seed data configurable and editable in admin.

3. Admin shell and program dashboard.
   - Match LMS admin dashboard style.
   - Add Program list, Program setup, Forms, Classes, Packages & Pricing, Schedule & Quota, Registrations, Invoice/Payment Status, Device Orders, Pitching Day placeholder, Certificate placeholder, WhatsApp/Integration status.

4. Production form renderer.
   - Template-based, config-driven, multi-step, responsive, and polished.
   - Render `program_form_steps` and `program_form_fields`.
   - Support conditional visibility, preview mode, loading states, validation messages, closed-form states, success page, and structured error states.
   - Use bright Clevio-style public UI with blue/teal/green accents.
   - Include Holiday Class Data Orang Tua, Data Anak, Pilih Paket, Pilih Jadwal, Device/Add-on, Izin & Persetujuan, and Ringkasan steps.
   - Show admin notes such as minimum laptop specifications in Ringkasan before submit.

5. Quote and submit flow.
   - Quote validates form access, level, package, schedule availability, and device/add-on rules.
   - Quote returns line items, add-ons, total, and current availability.
   - Submit validates access and all required/conditional fields, recalculates quote, creates registration, and returns success data.

6. Quota reservation transaction.
   - Admin can create custom session counts per batch.
   - Admin can set quota and status per batch.
   - Prevent overbooking under concurrent submit.
   - Track slot lifecycle on `registration_items`.
   - Treat batch counters as transactional cache only.

7. LMS invoice client.
   - Implement create invoice, get invoice, resend invoice, and WhatsApp send.
   - Include timeout, retry policy where safe, idempotency key, and structured error logging.
   - Validate token/code before exposing Alpha Omega pricing.
   - Do not allow frontend-only bypass.
   - Enforce `price_type` on quote and submit endpoints from the backend form record.

8. LMS webhook receiver.
   - Process paid/expired/cancelled webhook idempotently.
   - Confirm or release registration item slots based on LMS-authoritative status.

9. Dashboard registration/payment/device views.
    - Manage multiple forms per program.
    - Edit slug, access type, price type, status, labels/help text, required fields, and supported visibility presets.
    - Preview form, copy links, and view submissions/errors.
    - Track Microbit and Arduino buy-from-Clevio choices.
    - Create device orders only after paid/confirmed.
    - Admin can update fulfillment status.
    - Capture visits, started, submitted, invoice created, paid, abandoned, and errors.
    - Show basic form analytics counts in admin.

10. Cleanup/reconciliation jobs.
    - Release expired reservations.
    - Sync still-waiting invoices from LMS.
    - Reconcile batch counters from `registration_items`.
    - Log reconciliation results.

11. Verify locally.
    - Run lint/build/tests.
    - Mock LMS API responses.
    - Test production public form renderer, preview, Alpha Omega protected form, quote endpoint, submit endpoint, quota sync, overbooking rejection, invoice creation failure, invoice creation success, and webhook paid/expired/cancelled.

12. Deploy to VPS.
    - Build Event Manager app.
    - Run with PM2 as a separate process from `lms`.
    - Add Nginx path proxy for `/event-manager` on `lms.clev.io`.
    - Verify the app is reachable on the same VPS and host as LMS.
    - Verify LMS API calls work from the VPS.
    - Verify LMS webhook reaches Event Manager public URL.

## Phase 2

Phase 2 can include:
- Pitching day full workflow.
- Certificate template management.
- LMS certificate generation integration.
- Scheduled invoice reconciliation.
- Rich WhatsApp templates and delivery status dashboard.
- Advanced form builder UI.
- Multi-program analytics.

## Review Checks Before Coding

Decisions to confirm before implementation:
- Event Manager app path/name in repo.
- Event Manager database provider/connection.
- Public URL/domain for callback URL.
- Exact VPS target whose address starts with `7`.
- Whether `3007` is acceptable as Event Manager process port.
- LMS API auth method and webhook signature format.
- Whether admin auth should be separate Event Manager auth or API/SSO-based integration with LMS.
