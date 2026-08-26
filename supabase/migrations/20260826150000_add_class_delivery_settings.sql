alter table public.classes
  add column if not exists delivery_mode text not null default 'ONLINE',
  add column if not exists location_name text,
  add column if not exists location_address text,
  add column if not exists location_maps_url text,
  add column if not exists parent_whatsapp_enabled boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_delivery_mode_check'
      and conrelid = 'public.classes'::regclass
  ) then
    alter table public.classes
      add constraint classes_delivery_mode_check
      check (delivery_mode in ('ONLINE', 'OFFLINE'));
  end if;
end
$$;

comment on column public.classes.delivery_mode is
  'ONLINE uses zoom_link; OFFLINE uses the per-class location fields.';
comment on column public.classes.parent_whatsapp_enabled is
  'Opt-in for automatic parent WhatsApp messages on EKSKUL classes. WEEKLY remains enabled by program policy.';
