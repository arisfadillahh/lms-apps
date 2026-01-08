import { addMinutes, subMinutes } from 'date-fns';
import { NextResponse } from 'next/server';

import { makeUpTasksDao, reportsDao, sessionsDao, usersDao, classesDao } from '@/lib/dao';
import { getAppBaseUrl } from '@/lib/env';
import { sendParentAbsent } from '@/lib/whatsapp/client';
import { verifyCronRequest } from '@/lib/cron';

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const reminderWindows = [
    { label: 'H-3', hoursAhead: 72 },
    { label: 'H-1', hoursAhead: 24 },
  ] as const;

  const results: Array<{ taskId: string; reminderType: (typeof reminderWindows)[number]['label']; status: string }> = [];

  for (const window of reminderWindows) {
    const target = new Date(now.getTime() + window.hoursAhead * 60 * 60 * 1000);
    const windowStart = subMinutes(target, 15);
    const windowEnd = addMinutes(target, 15);

    const tasks = await makeUpTasksDao.findPendingMakeUpTasksInWindow(
      windowStart.toISOString(),
      windowEnd.toISOString(),
    );

    for (const task of tasks) {
      const coder = await usersDao.getUserById(task.coder_id);
      const session = await sessionsDao.getSessionById(task.session_id);
      const classRecord = session ? await classesDao.getClassById(session.class_id) : null;

      if (!coder || !session || !classRecord || !coder.parent_contact_phone) {
        results.push({ taskId: task.id, reminderType: window.label, status: 'SKIPPED' });
        continue;
      }

      const logEntry = await reportsDao.logWhatsappEvent({
        category: 'REMINDER',
        payload: {
          makeUpTaskId: task.id,
          coderId: task.coder_id,
          dueDate: task.due_date,
          reminderType: window.label,
          instructions: task.instructions,
        },
      });

      try {
        const response = await sendParentAbsent({
          coderFullName: coder.full_name,
          className: classRecord.name,
          sessionDateTime: session.date_time,
          makeUpUrl: `${getAppBaseUrl()}/coder/makeup`,
          parentPhone: coder.parent_contact_phone,
          status: 'ABSENT',
          instructions: task.instructions ?? undefined,
          dueDate: task.due_date,
          reminderType: window.label,
        });
        await reportsDao.updateWhatsappLogStatus(logEntry.id, 'SENT', response as any);
        results.push({ taskId: task.id, reminderType: window.label, status: 'SENT' });
      } catch (error: any) {
        await reportsDao.updateWhatsappLogStatus(logEntry.id, 'FAILED', { message: error.message ?? 'Failed' });
        results.push({ taskId: task.id, reminderType: window.label, status: 'FAILED' });
      }
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
