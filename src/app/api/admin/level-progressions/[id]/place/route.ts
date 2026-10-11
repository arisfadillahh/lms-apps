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

  const [{ data: sourceEnrollment }, { data: sourceClass }, { data: requiredBlocks }, { data: verifiedProgress }] = await Promise.all([
    supabase.from('enrollments').select('status, exit_reason').eq('id', progression.source_enrollment_id).maybeSingle(),
    supabase.from('classes').select('end_date, lifecycle_status').eq('id', progression.source_class_id).maybeSingle(),
    supabase.from('blocks').select('id').eq('level_id', progression.source_level_id),
    supabase.from('coder_block_progress').select('block_id, status, completion_source')
      .eq('coder_id', progression.coder_id).eq('level_id', progression.source_level_id),
  ]);
  const verifiedIds = new Set((verifiedProgress ?? [])
    .filter((item) => item.status === 'COMPLETED'
      && (item.completion_source === 'MANUAL' || item.completion_source === 'ASSESSMENT'))
    .map((item) => item.block_id));
  const classEnded = sourceClass?.lifecycle_status === 'ENDED'
    || Boolean(sourceClass?.end_date && sourceClass.end_date <= new Date().toISOString().slice(0, 10));
  if (sourceEnrollment?.status !== 'INACTIVE' || sourceEnrollment.exit_reason !== 'COMPLETED'
    || !classEnded || !requiredBlocks?.length
    || requiredBlocks.some((block) => !verifiedIds.has(block.id))) {
    return NextResponse.json({ error: 'Progres dan enrollment sumber harus diverifikasi sebelum penempatan.' }, { status: 409 });
  }

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
          pushUrl: '/coder/dashboard', pushTag: `level-placement:${id}`,
        }),
        createAdminNotifications({
          title: 'Penempatan Coder selesai', message: `${coder?.full_name ?? 'Coder'} sudah ditempatkan di ${className}.`,
          type: 'LEVEL_PROGRESSION', pushUrl: '/admin/level-progressions', pushTag: `level-placement:${id}`,
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
