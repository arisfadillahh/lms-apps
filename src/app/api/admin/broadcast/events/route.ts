import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import {
  findUnknownEventTemplateVariables,
  getEventReminderSchedule,
  type EventReminderType,
} from '@/lib/eventBroadcast';
import { assertRole } from '@/lib/roles';
import {
  createEventBroadcast,
  listEventBroadcastAdminData,
  previewEventRecipients,
} from '@/lib/services/eventBroadcastService';

const classIdsSchema = z.array(z.string().uuid()).min(1).max(50).transform((values) => [...new Set(values)]);

const previewSchema = z.object({
  action: z.literal('preview'),
  classIds: classIdsSchema,
});

const createSchema = z.object({
  action: z.literal('create'),
  name: z.string().trim().min(3).max(120),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  locationName: z.string().trim().max(160).optional().default(''),
  locationAddress: z.string().trim().max(500).optional().default(''),
  locationMapsUrl: z.string().trim().url('Link lokasi tidak valid').max(2048).optional().or(z.literal('')).default(''),
  messageTemplate: z.string().trim().min(10).max(4000),
  classIds: classIdsSchema,
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).default('10:00'),
  reminderTypes: z.array(z.enum(['NOW', 'H7', 'H1'])).min(1).transform((values) => [...new Set(values)]),
}).superRefine((value, ctx) => {
  if (value.endTime && value.endTime <= value.startTime) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endTime'], message: 'Jam selesai harus setelah jam mulai' });
  }
  if (new Date(`${value.eventDate}T23:59:59+07:00`).getTime() < Date.now()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['eventDate'], message: 'Tanggal event tidak boleh sudah lewat' });
  }
  const unknownVariables = findUnknownEventTemplateVariables(value.messageTemplate);
  if (unknownVariables.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['messageTemplate'],
      message: `Variabel tidak dikenal: ${unknownVariables.map((item) => `{${item}}`).join(', ')}`,
    });
  }
});

export async function GET() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');
  try {
    return NextResponse.json(await listEventBroadcastAdminData());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal membaca event' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');
  const body = await request.json().catch(() => null);

  const preview = previewSchema.safeParse(body);
  if (preview.success) {
    try {
      return NextResponse.json(await previewEventRecipients(preview.data.classIds));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal menghitung penerima' }, { status: 400 });
    }
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data event belum valid', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const schedules = getEventReminderSchedule({
    eventDate: parsed.data.eventDate,
    reminderTime: parsed.data.reminderTime,
    reminderTypes: parsed.data.reminderTypes as EventReminderType[],
  });
  if (schedules.length === 0) {
    return NextResponse.json({ error: 'Semua jadwal reminder sudah lewat. Pilih Kirim sekarang.' }, { status: 400 });
  }

  try {
    const created = await createEventBroadcast({
      name: parsed.data.name,
      eventDate: parsed.data.eventDate,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime || null,
      locationName: parsed.data.locationName || null,
      locationAddress: parsed.data.locationAddress || null,
      locationMapsUrl: parsed.data.locationMapsUrl || null,
      messageTemplate: parsed.data.messageTemplate,
      classIds: parsed.data.classIds,
      reminders: schedules,
      createdBy: session.user.id,
    });

    const nowQueued = created.reminders.some((reminder: { reminder_type: string }) => reminder.reminder_type === 'NOW');
    const skippedReminderTypes = parsed.data.reminderTypes.filter(
      (type) => !schedules.some((schedule) => schedule.reminderType === type),
    );

    return NextResponse.json({
      success: true,
      eventId: created.eventId,
      reminders: created.reminders,
      nowQueued,
      skippedReminderTypes,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal membuat event' }, { status: 500 });
  }
}
