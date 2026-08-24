import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { normalizeClassMeetingUrl } from '@/lib/classMeetingUrl';
import { classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateClassLinkSchema = z.object({
  zoomLink: z.string().trim().min(1).max(2048),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const classId = (await context.params).id;
  const parsed = updateClassLinkSchema.safeParse(await request.json().catch(() => null));
  if (!classId || !parsed.success) {
    return NextResponse.json({ error: 'Link kelas tidak valid' }, { status: 400 });
  }

  const zoomLink = normalizeClassMeetingUrl(parsed.data.zoomLink);
  if (!zoomLink) {
    return NextResponse.json(
      { error: 'Gunakan link Google Meet, Zoom, atau ruang kelas online yang valid. Link placeholder Clevio tidak dapat dipakai.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: klass, error: classError } = await supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .maybeSingle();
  if (classError) return NextResponse.json({ error: classError.message }, { status: 500 });
  if (!klass) return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });

  const { error: updateClassError } = await supabase
    .from('classes')
    .update({ zoom_link: zoomLink })
    .eq('id', classId);
  if (updateClassError) return NextResponse.json({ error: updateClassError.message }, { status: 500 });

  const activeWindowStart = new Date(Date.now() - 120 * 60 * 1000).toISOString();
  const { data: updatedSessions, error: updateSessionsError } = await supabase
    .from('sessions')
    .update({ zoom_link_snapshot: zoomLink })
    .eq('class_id', classId)
    .eq('status', 'SCHEDULED')
    .gt('date_time', activeWindowStart)
    .select('id');
  if (updateSessionsError) {
    return NextResponse.json(
      { error: 'Link kelas tersimpan, tetapi sinkronisasi sesi mendatang gagal. Silakan coba simpan lagi.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, zoomLink, updatedFutureSessions: updatedSessions?.length ?? 0 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const params = await context.params;
  const classId = params.id;

  if (!classId) {
    return NextResponse.json({ error: 'Invalid class id' }, { status: 400 });
  }

  try {
    const payload = await request.json().catch(() => null) as { confirmationName?: unknown } | null;
    const confirmationName = typeof payload?.confirmationName === 'string'
      ? payload.confirmationName.trim()
      : '';
    const klass = await classesDao.getClassById(classId);

    if (!klass) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
    }

    if (!confirmationName || confirmationName !== klass.name.trim()) {
      return NextResponse.json(
        { error: 'Nama kelas tidak cocok. Penghapusan dibatalkan.' },
        { status: 400 },
      );
    }

    await classesDao.deleteClass(classId);
  } catch (error) {
    if (error instanceof Error && error.name === 'ClassDeletionBlockedError') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('Failed to delete class', error);
    return NextResponse.json(
      { error: 'Kelas gagal dihapus. Tidak ada data lain yang sengaja dihapus.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
