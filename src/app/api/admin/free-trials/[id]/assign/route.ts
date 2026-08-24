import { after, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assignTrialClass, getTrialClassSubmission } from '@/lib/dao/trialClassDao';
import { getUserById } from '@/lib/dao/usersDao';
import { assertRole } from '@/lib/roles';
import { deleteTrialCalendarEvent, upsertTrialCalendarEvent } from '@/lib/services/googleTrialCalendar';
import {
  createTrialCoachAssignmentWebsiteNotification,
  sendTrialCoachAssignmentWhatsAppNotification,
  type TrialCoachAssignmentNotificationInput,
} from '@/lib/services/trialClassNotifications';

export const runtime = 'nodejs';

const assignTrialSchema = z.object({
  coachId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(30).max(180).default(60),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { id } = await context.params;
    const parsed = assignTrialSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data coach atau jadwal tidak valid.' }, { status: 400 });
    }

    const scheduledAt = new Date(parsed.data.scheduledAt);
    if (scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Jadwal trial harus berada di waktu mendatang.' }, { status: 400 });
    }

    const [trial, coach] = await Promise.all([
      getTrialClassSubmission(id),
      getUserById(parsed.data.coachId),
    ]);
    if (!trial) {
      return NextResponse.json({ error: 'Data trial tidak ditemukan.' }, { status: 404 });
    }
    if (trial.status === 'CANCELLED' || trial.status === 'FAILED') {
      return NextResponse.json({ error: 'Trial yang sudah dibatalkan atau gagal tidak dapat dijadwalkan.' }, { status: 409 });
    }
    if (!coach || coach.role !== 'COACH' || !coach.is_active) {
      return NextResponse.json({ error: 'Coach tidak ditemukan atau sudah tidak aktif.' }, { status: 400 });
    }

    let calendarEventId = trial.google_calendar_event_id;
    let meetUrl = trial.google_meet_url;
    let createdNewCalendarEvent = false;

    if (trial.trial_mode === 'ONLINE') {
      const calendarEvent = await upsertTrialCalendarEvent(trial.google_calendar_event_id, {
        studentName: trial.student_name,
        studentGrade: trial.student_grade,
        parentName: trial.parent_name,
        phone: trial.phone,
        coachName: coach.full_name,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: parsed.data.durationMinutes,
      });
      calendarEventId = calendarEvent.eventId;
      meetUrl = calendarEvent.meetUrl;
      createdNewCalendarEvent = !trial.google_calendar_event_id;
    }

    try {
      const updated = await assignTrialClass(id, {
        coachId: coach.id,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: parsed.data.durationMinutes,
        assignedBy: session.user.id,
        googleCalendarEventId: calendarEventId,
        googleMeetUrl: meetUrl,
      });

      const notificationInput: TrialCoachAssignmentNotificationInput = {
        trialId: updated.id,
        coachId: coach.id,
        coachName: coach.full_name,
        coachPhone: coach.parent_contact_phone,
        studentName: trial.student_name,
        studentGrade: trial.student_grade,
        schoolName: trial.school_name,
        trialMode: trial.trial_mode,
        notes: trial.notes,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: parsed.data.durationMinutes,
        meetUrl,
      };
      const websiteNotification = await createTrialCoachAssignmentWebsiteNotification(notificationInput);

      after(async () => {
        const whatsappNotification = await sendTrialCoachAssignmentWhatsAppNotification(notificationInput);
        console.log('[FreeTrial] Assigned coach notification result', {
          trialId: updated.id,
          coachId: coach.id,
          website: websiteNotification.success,
          whatsapp: whatsappNotification.success,
          whatsappSkipped: whatsappNotification.skipped ?? false,
        });
      });

      return NextResponse.json({
        ok: true,
        trial: updated,
        notifications: {
          website: websiteNotification.success,
          whatsappQueued: Boolean(coach.parent_contact_phone?.trim()),
        },
      });
    } catch (error) {
      if (createdNewCalendarEvent && calendarEventId) {
        await deleteTrialCalendarEvent(calendarEventId).catch((cleanupError) => {
          console.error('[FreeTrial] Failed to rollback Google Calendar event', cleanupError);
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('[FreeTrial] Failed to assign trial', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menjadwalkan trial.' },
      { status: 500 },
    );
  }
}
