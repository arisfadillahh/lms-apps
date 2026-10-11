alter table public.classes
  add column if not exists parent_whatsapp_class_reminder_enabled boolean not null default false,
  add column if not exists parent_whatsapp_absence_enabled boolean not null default false,
  add column if not exists parent_whatsapp_makeup_enabled boolean not null default false;

update public.classes
set
  parent_whatsapp_class_reminder_enabled = true,
  parent_whatsapp_absence_enabled = true,
  parent_whatsapp_makeup_enabled = true
where type = 'EKSKUL'
  and parent_whatsapp_enabled = true;

comment on column public.classes.parent_whatsapp_class_reminder_enabled is
  'Per-class EKSKUL opt-in for automatic schedule reminders sent to parents via WhatsApp.';
comment on column public.classes.parent_whatsapp_absence_enabled is
  'Per-class EKSKUL opt-in for automatic absence messages sent to parents via WhatsApp.';
comment on column public.classes.parent_whatsapp_makeup_enabled is
  'Per-class EKSKUL opt-in for automatic makeup reminders sent to parents via WhatsApp.';
