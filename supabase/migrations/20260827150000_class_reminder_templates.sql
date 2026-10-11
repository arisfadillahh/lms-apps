begin;

-- Keep the template catalog extensible without touching existing message rows.
-- The two class-reminder rows are additive and can be edited independently by
-- Admin from the WhatsApp template page.
alter table public.whatsapp_templates
  drop constraint if exists valid_whatsapp_template_category;

alter table public.whatsapp_templates
  add constraint valid_whatsapp_template_category check (
    category in (
      'PARENT_ABSENT',
      'REPORT_SEND',
      'TRIAL_REPORT_SEND',
      'REMINDER',
      'CLASS_REMINDER_ONLINE',
      'CLASS_REMINDER_OFFLINE'
    )
  ) not valid;

alter table public.whatsapp_templates
  validate constraint valid_whatsapp_template_category;

insert into public.whatsapp_templates (category, template_content, variables)
values
  (
    'CLASS_REMINDER_ONLINE',
    'Halo Ayah/Bunda {parent_name} 👋

Mengingatkan jadwal kelas coding:
💻 Coder: {student_name}
📚 Kelas: {class_name}
🕒 Waktu: {time} WIB
🔗 Link kelas: {zoom_link}

Mohon hadir tepat waktu ya. Terima kasih! 🙏',
    '["parent_name", "student_name", "class_name", "time", "zoom_link", "delivery_mode", "location_name", "location_address", "maps_url"]'::jsonb
  ),
  (
    'CLASS_REMINDER_OFFLINE',
    'Halo Ayah/Bunda {parent_name} 👋

Mengingatkan jadwal kelas coding:
💻 Coder: {student_name}
📚 Kelas: {class_name}
🕒 Waktu: {time} WIB
📍 Lokasi: {location_name}
🏠 Alamat: {location_address}
🗺️ Google Maps: {maps_url}

Mohon hadir tepat waktu dan siapkan perjalanan ya. Terima kasih! 🙏',
    '["parent_name", "student_name", "class_name", "time", "location_name", "location_address", "maps_url", "delivery_mode"]'::jsonb
  )
on conflict (category) do nothing;

commit;
