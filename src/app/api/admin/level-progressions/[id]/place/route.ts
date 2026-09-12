import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { levelProgressionsDao } from '@/lib/dao';
import { createAdminNotifications, createNotification } from '@/lib/dao/notificationsDao';
import { assertRole } from '@/lib/roles';
import { initializeWeeklyEnrollmentJourney } from '@/lib/services/weeklyEnrollmentSetup';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');
  const { id } = await context.params;

  let body: { classId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Data penempatan tidak valid.' }, { status: 400 });
  }
  if (!body.classId) return NextResponse.json({ error: 'Kelas tujuan wajib dipilih.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: progression } = await supabase
    .from('coder_level_progressions').select('*').eq('id', id).maybeSingle();
  if (!progression) return NextResponse.json({ error: 'Data kenaikan level tidak ditemukan.' }, { status: 404 });

  try {
    const result = await levelProgressionsDao.placeCoder({
      progressionId: id, targetClassId: body.classId, adminId: session.user.id,
    });
    {
      const [{ data: klass }, { data: coder }, { data: level }] = await Promise.all([
        supabase.from('classes').select('*').eq('id', body.classId).single(),
        supabase.from('users').select('full_name').eq('id', progression.coder_id).single(),
        supabase.from('levels').select('name').eq('id', progression.target_level_id!).single(),
      ]);
      const { data: enrollment } = await supabase.from('enrollments').select('*').eq('id', result.targetEnrollmentId).single();
      if (klass && enrollment) await initializeWeeklyEnrollmentJourney({ klass, enrollment });

      const className = klass?.name ?? 'kelas baru';
      const levelName = level?.name ?? 'level berikutnya';
      await Promise.all([
        createNotification(progression.coder_id, 'Penempatan kelas baru', `Kamu sudah ditempatkan di ${className} untuk ${levelName}.`, 'LEVEL_PROGRESSION', {
          actionUrl: '/coder/dashboard', category: 'ACADEMIC', priority: 'HIGH',
          dedupeKey: `level-placement:${id}`, push: true,
        }),
        createAdminNotifications({
          title: 'Penempatan Coder selesai', message: `${coder?.full_name ?? 'Coder'} sudah ditempatkan di ${className}.`,
          type: 'LEVEL_PROGRESSION', actionUrl: '/admin/level-progressions', category: 'ACADEMIC',
          dedupeKey: `level-placement:${id}`, push: true,
        }),
      ]);
    }
    return NextResponse.json({ ok: true, placedNow: result.placedNow });
  } catch (error) {
    console.error('[Level Placement]', error);
    const message = error instanceof Error ? error.message.replace(/^Failed to place Coder:\s*/, '') : 'Penempatan gagal.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
