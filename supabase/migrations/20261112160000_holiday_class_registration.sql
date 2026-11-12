begin;
set local lock_timeout = '5s';

create sequence public.holiday_class_invoice_sequence;

create table public.holiday_class_registrations (
    id uuid primary key,
    invoice_id uuid not null unique references public.invoices(id) on delete restrict,
    request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
    email text not null,
    school_grade smallint not null check (school_grade between 1 and 12),
    selections jsonb not null check (jsonb_typeof(selections) = 'array'),
    platform text not null check (platform in ('none', 'own', 'clevio')),
    payment_url text,
    payment_claimed_at timestamptz,
    created_at timestamptz not null default now()
);

create table public.holiday_class_whatsapp_outbox (
    id bigint generated always as identity primary key,
    registration_id uuid not null references public.holiday_class_registrations(id) on delete cascade,
    kind text not null check (kind in ('registration_group', 'invoice_parent', 'paid_group', 'paid_parent')),
    attempts integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    claimed_at timestamptz,
    sent_at timestamptz,
    failed_at timestamptz,
    unique (registration_id, kind)
);

create index holiday_class_outbox_due_idx on public.holiday_class_whatsapp_outbox(next_attempt_at, id)
    where sent_at is null and failed_at is null;

alter table public.holiday_class_registrations enable row level security;
alter table public.holiday_class_whatsapp_outbox enable row level security;
revoke all on public.holiday_class_registrations, public.holiday_class_whatsapp_outbox from public, anon, authenticated, service_role;
revoke all on sequence public.holiday_class_invoice_sequence from public, anon, authenticated, service_role;
grant select, update on public.holiday_class_registrations, public.holiday_class_whatsapp_outbox to service_role;

create function public.create_holiday_class_registration(p_id uuid, p_hash text, p_details jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
    v_invoice_id uuid;
    v_hash text;
    v_number text;
begin
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
    select invoice_id, request_hash into v_invoice_id, v_hash
      from public.holiday_class_registrations where id = p_id;
    if found then
        if v_hash <> p_hash then raise exception 'HOLIDAY_REQUEST_CHANGED' using errcode = 'P0001'; end if;
        return v_invoice_id;
    end if;

    v_number := 'HC-2627-' || pg_catalog.to_char(pg_catalog.nextval('public.holiday_class_invoice_sequence'), 'FM000000');
    insert into public.invoices (
        invoice_number, parent_name, parent_phone, seasonal_student_name, seasonal_student_phone,
        period_month, period_year, period_start_date, period_end_date, total_amount, due_date, status, invoice_type
    ) values (
        v_number, p_details->>'parentName', p_details->>'phone', p_details->>'studentName', p_details->>'phone',
        extract(month from (p_details->>'startDate')::date), extract(year from (p_details->>'startDate')::date),
        (p_details->>'startDate')::date, (p_details->>'endDate')::date, (p_details->>'total')::integer,
        least((now() at time zone 'Asia/Jakarta')::date + 1, (p_details->>'startDate')::date), 'PENDING', 'SEASONAL'
    ) returning id into v_invoice_id;

    insert into public.invoice_items (
        invoice_id, coder_name, class_name, level_name, description, base_price, discount_amount, final_price
    )
    select v_invoice_id, p_details->>'studentName', item->>'name', p_details->>'level',
        item->>'description', (item->>'basePrice')::integer, (item->>'discount')::integer, (item->>'total')::integer
    from pg_catalog.jsonb_array_elements(p_details->'items') item;

    insert into public.holiday_class_registrations (id, invoice_id, request_hash, email, school_grade, selections, platform)
    values (p_id, v_invoice_id, p_hash, p_details->>'email', (p_details->>'schoolGrade')::smallint,
        p_details->'selections', p_details->>'platform');

    insert into public.holiday_class_whatsapp_outbox (registration_id, kind)
    values (p_id, 'registration_group'), (p_id, 'invoice_parent');
    return v_invoice_id;
end;
$$;

create function public.settle_holiday_class_invoice(p_order text, p_amount integer, p_paid_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
    v_invoice public.invoices%rowtype;
    v_registration uuid;
begin
    select i.* into v_invoice
      from public.invoices i
      join public.holiday_class_registrations r on r.invoice_id = i.id
      where i.invoice_number = p_order
      for update of i;
    if not found or v_invoice.total_amount <> p_amount then
        raise exception 'HOLIDAY_PAYMENT_MISMATCH' using errcode = 'P0001';
    end if;
    if v_invoice.status <> 'PAID' then
        update public.invoices
          set status = 'PAID', paid_at = p_paid_at, updated_at = now(),
              paid_notes = 'Dibayar via Midtrans ' || p_order
          where id = v_invoice.id;
    end if;
    select id into strict v_registration from public.holiday_class_registrations where invoice_id = v_invoice.id;
    insert into public.holiday_class_whatsapp_outbox (registration_id, kind)
    values (v_registration, 'paid_group'), (v_registration, 'paid_parent')
    on conflict (registration_id, kind) do nothing;
    return v_registration;
end;
$$;

create function public.claim_holiday_class_whatsapp(p_registration uuid default null)
returns setof public.holiday_class_whatsapp_outbox
language sql security definer set search_path = '' as $$
    with due as (
        select n.id
        from public.holiday_class_whatsapp_outbox n
        where (p_registration is null or n.registration_id = p_registration)
          and n.sent_at is null and n.failed_at is null and n.next_attempt_at <= now()
          and (n.claimed_at is null or n.claimed_at < now() - interval '10 minutes')
          and (
            n.kind in ('registration_group', 'invoice_parent')
            or exists (
                select 1 from public.holiday_class_whatsapp_outbox previous
                where previous.registration_id = n.registration_id
                  and previous.kind = case n.kind when 'paid_group' then 'registration_group' else 'invoice_parent' end
                  and (previous.sent_at is not null or previous.failed_at is not null)
            )
          )
        order by n.id limit 12 for update skip locked
    )
    update public.holiday_class_whatsapp_outbox n
       set claimed_at = now(), attempts = n.attempts + 1
      from due where n.id = due.id
    returning n.*;
$$;

revoke all on function public.create_holiday_class_registration(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.settle_holiday_class_invoice(text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_holiday_class_whatsapp(uuid) from public, anon, authenticated;
grant execute on function public.create_holiday_class_registration(uuid, text, jsonb) to service_role;
grant execute on function public.settle_holiday_class_invoice(text, integer, timestamptz) to service_role;
grant execute on function public.claim_holiday_class_whatsapp(uuid) to service_role;
commit;
