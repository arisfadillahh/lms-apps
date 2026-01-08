import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { makeUpTasksDao } from '@/lib/dao';

const uploadSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        type: z.string().optional(),
      }),
    )
    .min(1),
});

type RouteProps = {
  params: { id: string };
};

export async function POST(request: Request, { params }: RouteProps) {
  const session = await getSessionOrThrow();
  if (session.user.role !== 'CODER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const task = await makeUpTasksDao.getMakeUpTaskById(params.id);
  if (!task || task.coder_id !== session.user.id) {
    return NextResponse.json({ error: 'Make-up task not found' }, { status: 404 });
  }

  await makeUpTasksDao.submitMakeUpTask({
    taskId: task.id,
    submissionFiles: parsed.data.files,
    submittedAtIso: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
