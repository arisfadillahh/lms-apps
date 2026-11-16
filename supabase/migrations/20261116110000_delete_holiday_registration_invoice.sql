begin;
set local lock_timeout = '5s';

create function public.delete_holiday_registration_invoice(p_invoice_id uuid, p_delete boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
    v_invoice public.invoices%rowtype;
    v_registration public.holiday_class_registrations%rowtype;
begin
    select * into v_invoice from public.invoices where id = p_invoice_id for update;
    if not found then return 'missing'; end if;
    if v_invoice.invoice_number !~ '^HC-2627-[0-9]{6,}$' then return 'protected'; end if;
    if v_invoice.status not in ('PENDING', 'OVERDUE') or v_invoice.paid_at is not null then
        return 'paid';
    end if;

    select * into v_registration
      from public.holiday_class_registrations where invoice_id = p_invoice_id for update;
    if v_registration.payment_url is not null or v_registration.payment_claimed_at is not null then
        return 'protected';
    end if;
    if not p_delete then return 'ready'; end if;

    delete from public.holiday_class_registrations where invoice_id = p_invoice_id;
    delete from public.invoices where id = p_invoice_id;
    return 'deleted';
end;
$$;

revoke all on function public.delete_holiday_registration_invoice(uuid, boolean) from public, anon, authenticated;
grant execute on function public.delete_holiday_registration_invoice(uuid, boolean) to service_role;

commit;
