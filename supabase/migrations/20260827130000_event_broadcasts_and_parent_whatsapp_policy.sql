begin;

alter table public.classes
  add column if not exists parent_whatsapp_report_enabled boolean not null default false,
  add column if not exists parent_whatsapp_event_enabled boolean not null default false;

comment on column public.classes.parent_whatsapp_enabled is
  'Master school-policy gate for every parent WhatsApp message on EKSKUL classes. Per-message toggles only apply when this is enabled. WEEKLY follows its existing program policy.';
comment on column public.classes.parent_whatsapp_report_enabled is
  'Per-class EKSKUL opt-in for published report messages sent to parents via WhatsApp.';
comment on column public.classes.parent_whatsapp_event_enabled is
  'Per-class EKSKUL opt-in for event and festival reminders sent to parents via WhatsApp.';

create table if not exists public.event_broadcasts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 120),
  event_date date not null,
  start_time time not null,
  end_time time,
  location_name text,
  location_address text,
  location_maps_url text,
  message_template text not null check (char_length(message_template) between 10 and 4000),
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_broadcasts_time_order_check check (end_time is null or end_time > start_time),
  constraint event_broadcasts_maps_url_check check (
    location_maps_url is null or location_maps_url ~* '^https?://'
  )
);

create table if not exists public.event_broadcast_classes (
  event_id uuid not null references public.event_broadcasts(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (event_id, class_id)
);

create table if not exists public.event_broadcast_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_broadcasts(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('NOW', 'H7', 'H1')),
  scheduled_at timestamptz not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED')),
  delivery_counts jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, reminder_type)
);

create table if not exists public.event_broadcast_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.event_broadcast_reminders(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  coder_id uuid not null references public.users(id) on delete restrict,
  channel text not null check (channel in ('PWA', 'WHATSAPP')),
  status text not null check (status in ('QUEUED', 'SENT', 'SKIPPED', 'FAILED')),
  reason text,
  response jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reminder_id, coder_id, channel)
);

create index if not exists event_broadcast_classes_class_idx
  on public.event_broadcast_classes (class_id, event_id);
create index if not exists event_broadcast_reminders_due_idx
  on public.event_broadcast_reminders (status, scheduled_at)
  where status = 'PENDING';
create index if not exists event_broadcast_deliveries_reminder_idx
  on public.event_broadcast_deliveries (reminder_id, status, channel);

create or replace function public.set_event_broadcast_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_broadcasts_set_updated_at on public.event_broadcasts;
create trigger event_broadcasts_set_updated_at
before update on public.event_broadcasts
for each row execute function public.set_event_broadcast_updated_at();

alter table public.event_broadcasts enable row level security;
alter table public.event_broadcast_classes enable row level security;
alter table public.event_broadcast_reminders enable row level security;
alter table public.event_broadcast_deliveries enable row level security;

revoke all on public.event_broadcasts from anon, authenticated;
revoke all on public.event_broadcast_classes from anon, authenticated;
revoke all on public.event_broadcast_reminders from anon, authenticated;
revoke all on public.event_broadcast_deliveries from anon, authenticated;
grant all on public.event_broadcasts to service_role;
grant all on public.event_broadcast_classes to service_role;
grant all on public.event_broadcast_reminders to service_role;
grant all on public.event_broadcast_deliveries to service_role;

comment on table public.event_broadcasts is
  'Admin-managed Ekskul events. There is no registration or RSVP state; delivery is performed by server jobs.';
comment on table public.event_broadcast_deliveries is
  'Per-recipient audit and idempotency log for in-app/PWA and WhatsApp event delivery.';

commit;
