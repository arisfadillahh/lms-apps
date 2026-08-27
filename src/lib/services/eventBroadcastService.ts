import { createNotification } from '@/lib/dao/notificationsDao';
import { shouldSendParentWhatsappForClass } from '@/lib/classReminderEligibility';
import {
  buildEventPwaMessage,
  buildEventTemplateValues,
  renderEventMessage,
  type EventReminderType,
} from '@/lib/eventBroadcast';
import { sendWhatsAppMessage } from '@/lib/services/whatsappClient';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type EkskulClass = {
  id: string;
  name: string;
  type: 'EKSKUL';
  parent_whatsapp_enabled: boolean;
  parent_whatsapp_event_enabled: boolean;
};

type EventRecord = {
  id: string;
  name: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  location_address: string | null;
  location_maps_url: string | null;
  message_template: string;
};

type Recipient = {
  classId: string;
  coderId: string;
  fullName: string;
  parentPhone: string | null;
  klass: EkskulClass;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function getEkskulClasses(classIds: string[]): Promise<EkskulClass[]> {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, type, parent_whatsapp_enabled, parent_whatsapp_event_enabled')
    .in('id', classIds);
  if (error) throw new Error(`Gagal membaca kelas target: ${error.message}`);
  const classes = (data ?? []) as EkskulClass[];
  if (classes.length !== new Set(classIds).size || classes.some((klass) => klass.type !== 'EKSKUL')) {
    throw new Error('Semua target event harus berupa kelas Ekskul yang valid');
  }
  return classes;
}

async function getRecipients(classes: EkskulClass[]): Promise<Recipient[]> {
  if (classes.length === 0) return [];
  const supabase = getSupabaseAdmin() as any;
  const classById = new Map(classes.map((klass) => [klass.id, klass]));
  const { data, error } = await supabase
    .from('enrollments')
    .select('class_id, coder_id, coder:users!enrollments_coder_id_fkey(id, full_name, parent_contact_phone, is_active)')
    .in('class_id', classes.map((klass) => klass.id))
    .eq('status', 'ACTIVE');
  if (error) throw new Error(`Gagal membaca penerima event: ${error.message}`);

  const byCoder = new Map<string, Recipient>();
  for (const row of data ?? []) {
    const coder = unwrapRelation(row.coder) as { id: string; full_name: string; parent_contact_phone: string | null; is_active: boolean } | null;
    const klass = classById.get(row.class_id);
    if (!coder?.is_active || !klass || byCoder.has(coder.id)) continue;
    byCoder.set(coder.id, {
      classId: row.class_id,
      coderId: coder.id,
      fullName: coder.full_name,
      parentPhone: coder.parent_contact_phone,
      klass,
    });
  }
  return [...byCoder.values()];
}

export async function previewEventRecipients(classIds: string[]) {
  const classes = await getEkskulClasses(classIds);
  const recipients = await getRecipients(classes);
  const counts = recipients.reduce((result, recipient) => {
    if (!shouldSendParentWhatsappForClass(recipient.klass, 'EVENT')) result.blockedByPolicy += 1;
    else if (!recipient.parentPhone?.trim()) result.missingPhone += 1;
    else result.whatsappEligible += 1;
    return result;
  }, { whatsappEligible: 0, blockedByPolicy: 0, missingPhone: 0 });

  return {
    selectedClasses: classes.length,
    pwaRecipients: recipients.length,
    ...counts,
  };
}

export async function listEventBroadcastAdminData() {
  const supabase = getSupabaseAdmin() as any;
  const [{ data: classes, error: classError }, { data: events, error: eventError }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, parent_whatsapp_enabled, parent_whatsapp_event_enabled')
      .eq('type', 'EKSKUL')
      .order('name'),
    supabase
      .from('event_broadcasts')
      .select('id, name, event_date, start_time, status, created_at, event_broadcast_classes(class_id), event_broadcast_reminders(reminder_type, scheduled_at, status, delivery_counts)')
      .order('created_at', { ascending: false })
      .limit(25),
  ]);
  if (classError) throw new Error(`Gagal membaca kelas Ekskul: ${classError.message}`);
  if (eventError) throw new Error(`Gagal membaca event: ${eventError.message}`);
  return { classes: classes ?? [], events: events ?? [] };
}

export async function createEventBroadcast(input: {
  name: string;
  eventDate: string;
  startTime: string;
  endTime?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  locationMapsUrl?: string | null;
  messageTemplate: string;
  classIds: string[];
  reminders: Array<{ reminderType: EventReminderType; scheduledAt: string }>;
  createdBy: string;
}) {
  const supabase = getSupabaseAdmin() as any;
  await getEkskulClasses(input.classIds);

  const { data: event, error: eventError } = await supabase
    .from('event_broadcasts')
    .insert({
      name: input.name,
      event_date: input.eventDate,
      start_time: input.startTime,
      end_time: input.endTime || null,
      location_name: input.locationName || null,
      location_address: input.locationAddress || null,
      location_maps_url: input.locationMapsUrl || null,
      message_template: input.messageTemplate,
      created_by: input.createdBy,
    })
    .select('id')
    .single();
  if (eventError || !event) throw new Error(`Gagal membuat event: ${eventError?.message || 'event kosong'}`);

  try {
    const { error: targetError } = await supabase.from('event_broadcast_classes').insert(
      input.classIds.map((classId) => ({ event_id: event.id, class_id: classId })),
    );
    if (targetError) throw new Error(`Gagal menyimpan target kelas: ${targetError.message}`);

    const { data: reminders, error: reminderError } = await supabase
      .from('event_broadcast_reminders')
      .insert(input.reminders.map((reminder) => ({
        event_id: event.id,
        reminder_type: reminder.reminderType,
        scheduled_at: reminder.scheduledAt,
      })))
      .select('id, reminder_type, scheduled_at, status');
    if (reminderError) throw new Error(`Gagal menyimpan jadwal reminder: ${reminderError.message}`);

    return { eventId: event.id as string, reminders: reminders ?? [] };
  } catch (error) {
    // Cleanup is scoped only to the brand-new incomplete record; existing data is never touched.
    await supabase.from('event_broadcasts').delete().eq('id', event.id);
    throw error;
  }
}

async function insertDeliveryClaim(input: {
  reminderId: string;
  classId: string;
  coderId: string;
  channel: 'WHATSAPP';
}): Promise<string | null> {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from('event_broadcast_deliveries')
    .insert({
      reminder_id: input.reminderId,
      class_id: input.classId,
      coder_id: input.coderId,
      channel: input.channel,
      status: 'QUEUED',
    })
    .select('id')
    .single();
  if (error?.code === '23505') return null;
  if (error || !data) throw new Error(`Gagal membuat delivery claim: ${error?.message || 'claim kosong'}`);
  return data.id;
}

export async function processEventReminder(reminderId: string) {
  const supabase = getSupabaseAdmin() as any;
  const { data: claimed, error: claimError } = await supabase
    .from('event_broadcast_reminders')
    .update({ status: 'PROCESSING', processed_at: new Date().toISOString() })
    .eq('id', reminderId)
    .eq('status', 'PENDING')
    .select('id, event_id, reminder_type')
    .maybeSingle();
  if (claimError) throw new Error(`Gagal mengambil reminder: ${claimError.message}`);
  if (!claimed) return { reminderId, status: 'SKIPPED_ALREADY_CLAIMED' };

  try {
    const [{ data: event, error: eventError }, { data: targets, error: targetError }] = await Promise.all([
      supabase.from('event_broadcasts').select('*').eq('id', claimed.event_id).single(),
      supabase.from('event_broadcast_classes').select('class_id').eq('event_id', claimed.event_id),
    ]);
    if (eventError || !event) throw new Error(`Event tidak ditemukan: ${eventError?.message || claimed.event_id}`);
    if (targetError) throw new Error(`Target event gagal dibaca: ${targetError.message}`);

    const classes = await getEkskulClasses((targets ?? []).map((target: { class_id: string }) => target.class_id));
    const recipients = await getRecipients(classes);
    const eventRecord = event as EventRecord;
    const counts = { total: recipients.length, pwaSent: 0, pwaFailed: 0, whatsappSent: 0, whatsappFailed: 0, skippedPolicy: 0, skippedPhone: 0 };

    for (const recipient of recipients) {
      try {
        await createNotification(
          recipient.coderId,
          `Event: ${eventRecord.name}`,
          buildEventPwaMessage({
            eventDate: eventRecord.event_date,
            startTime: eventRecord.start_time,
            endTime: eventRecord.end_time,
            locationName: eventRecord.location_name,
          }),
          'BROADCAST',
          {
            actionUrl: '/coder/dashboard',
            category: 'EVENT',
            priority: 'HIGH',
            dedupeKey: `event-${eventRecord.id}-${claimed.reminder_type}`,
            push: true,
            pushTag: `event-${eventRecord.id}-${claimed.reminder_type}`,
          },
        );
        counts.pwaSent += 1;
        await supabase.from('event_broadcast_deliveries').upsert({
          reminder_id: reminderId,
          class_id: recipient.classId,
          coder_id: recipient.coderId,
          channel: 'PWA',
          status: 'SENT',
          sent_at: new Date().toISOString(),
        }, { onConflict: 'reminder_id,coder_id,channel' });
      } catch (error) {
        counts.pwaFailed += 1;
        console.error('[EventBroadcast] PWA delivery failed', { coderId: recipient.coderId, error });
      }
    }

    for (const recipient of recipients) {
      if (!shouldSendParentWhatsappForClass(recipient.klass, 'EVENT')) {
        counts.skippedPolicy += 1;
        await supabase.from('event_broadcast_deliveries').insert({
          reminder_id: reminderId,
          class_id: recipient.classId,
          coder_id: recipient.coderId,
          channel: 'WHATSAPP',
          status: 'SKIPPED',
          reason: 'PARENT_WHATSAPP_POLICY_DISABLED',
        });
        continue;
      }
      if (!recipient.parentPhone?.trim()) {
        counts.skippedPhone += 1;
        await supabase.from('event_broadcast_deliveries').insert({
          reminder_id: reminderId,
          class_id: recipient.classId,
          coder_id: recipient.coderId,
          channel: 'WHATSAPP',
          status: 'SKIPPED',
          reason: 'PARENT_PHONE_MISSING',
        });
        continue;
      }

      const deliveryId = await insertDeliveryClaim({
        reminderId,
        classId: recipient.classId,
        coderId: recipient.coderId,
        channel: 'WHATSAPP',
      });
      if (!deliveryId) continue;

      const message = renderEventMessage(eventRecord.message_template, buildEventTemplateValues({
        eventName: eventRecord.name,
        studentName: recipient.fullName,
        eventDate: eventRecord.event_date,
        startTime: eventRecord.start_time,
        endTime: eventRecord.end_time,
        locationName: eventRecord.location_name,
        locationAddress: eventRecord.location_address,
        locationMapsUrl: eventRecord.location_maps_url,
      }));
      try {
        const response = await sendWhatsAppMessage(recipient.parentPhone, message);
        if (!response.success) throw new Error(response.error || 'Layanan WhatsApp menolak pengiriman');
        counts.whatsappSent += 1;
        await supabase.from('event_broadcast_deliveries').update({
          status: 'SENT',
          response,
          sent_at: new Date().toISOString(),
        }).eq('id', deliveryId);
      } catch (error) {
        counts.whatsappFailed += 1;
        await supabase.from('event_broadcast_deliveries').update({
          status: 'FAILED',
          reason: error instanceof Error ? error.message : 'Gagal mengirim WhatsApp',
        }).eq('id', deliveryId);
      }
    }

    const hasFailures = counts.pwaFailed > 0 || counts.whatsappFailed > 0;
    const finalStatus = hasFailures ? 'PARTIAL' : 'COMPLETED';
    await supabase.from('event_broadcast_reminders').update({
      status: finalStatus,
      delivery_counts: counts,
      processed_at: new Date().toISOString(),
    }).eq('id', reminderId);
    return { reminderId, status: finalStatus, counts };
  } catch (error) {
    await supabase.from('event_broadcast_reminders').update({
      status: 'FAILED',
      delivery_counts: { error: error instanceof Error ? error.message : String(error) },
      processed_at: new Date().toISOString(),
    }).eq('id', reminderId);
    throw error;
  }
}

export async function processDueEventBroadcasts(now = new Date()) {
  const supabase = getSupabaseAdmin() as any;
  const staleClaimBefore = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const { error: recoveryError } = await supabase
    .from('event_broadcast_reminders')
    .update({ status: 'PENDING', processed_at: null })
    .eq('status', 'PROCESSING')
    .lt('processed_at', staleClaimBefore);
  if (recoveryError) throw new Error(`Gagal memulihkan reminder yang tertunda: ${recoveryError.message}`);
  const { data, error } = await supabase
    .from('event_broadcast_reminders')
    .select('id')
    .eq('status', 'PENDING')
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at')
    .limit(20);
  if (error) throw new Error(`Gagal membaca reminder event: ${error.message}`);

  const results = [];
  for (const reminder of data ?? []) {
    try {
      results.push(await processEventReminder(reminder.id));
    } catch (error) {
      results.push({ reminderId: reminder.id, status: 'FAILED', error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { processed: results.length, results };
}
