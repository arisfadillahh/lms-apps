create table if not exists public.trial_assessments (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references public.trial_class_submissions(id) on delete cascade,
  coach_id uuid not null references public.users(id) on delete restrict,
  status text not null default 'DRAFT',
  rubric jsonb not null default '{}'::jsonb,
  quick_observations text[] not null default '{}'::text[],
  personalized_observation text not null default '',
  internal_notes text,
  recommended_level_id uuid references public.levels(id) on delete set null,
  recommended_class_id uuid references public.classes(id) on delete set null,
  recommendation_tags text[] not null default '{}'::text[],
  parent_report_content jsonb,
  estimated_start_date date,
  discount_label text,
  discount_amount numeric not null default 0,
  base_price numeric,
  final_price numeric,
  pricing_id uuid references public.pricing(id) on delete set null,
  payment_plan_id uuid references public.payment_plans(id) on delete set null,
  public_token text not null default encode(gen_random_bytes(18), 'hex'),
  submitted_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  report_sent_at timestamptz,
  coder_id uuid references public.users(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  payment_period_id uuid references public.coder_payment_periods(id) on delete set null,
  registration_started_at timestamptz,
  payment_confirmed_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint trial_assessments_trial_id_key unique (trial_id),
  constraint trial_assessments_public_token_key unique (public_token),
  constraint trial_assessments_status_check check (
    status in (
      'DRAFT',
      'PENDING_ADMIN_REVIEW',
      'APPROVED',
      'PUBLISHED',
      'REGISTRATION_STARTED',
      'INVOICE_CREATED',
      'PAYMENT_PENDING',
      'PAID',
      'CONVERTED'
    )
  ),
  constraint trial_assessments_discount_amount_check check (discount_amount >= 0),
  constraint trial_assessments_base_price_check check (base_price is null or base_price >= 0),
  constraint trial_assessments_final_price_check check (final_price is null or final_price >= 0)
);

create index if not exists trial_assessments_status_idx on public.trial_assessments(status);
create index if not exists trial_assessments_coach_id_idx on public.trial_assessments(coach_id);
create index if not exists trial_assessments_invoice_id_idx on public.trial_assessments(invoice_id);
create index if not exists trial_assessments_public_token_idx on public.trial_assessments(public_token);

create or replace function public.set_trial_assessments_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_trial_assessments_timestamp on public.trial_assessments;
create trigger trigger_update_trial_assessments_timestamp
before update on public.trial_assessments
for each row
execute function public.set_trial_assessments_updated_at();

alter table public.trial_assessments enable row level security;

drop policy if exists "Admins can manage trial assessments" on public.trial_assessments;
create policy "Admins can manage trial assessments"
on public.trial_assessments for all
using (auth.jwt() ->> 'role' = 'ADMIN')
with check (auth.jwt() ->> 'role' = 'ADMIN');

drop policy if exists "Coaches can manage own trial assessments" on public.trial_assessments;
create policy "Coaches can manage own trial assessments"
on public.trial_assessments for all
using (auth.jwt() ->> 'role' = 'COACH' and auth.uid() = coach_id)
with check (auth.jwt() ->> 'role' = 'COACH' and auth.uid() = coach_id);
