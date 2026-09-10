import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, notificationsDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { initializeWeeklyEnrollmentJourney } from '@/lib/services/weeklyEnrollmentSetup';
import { transferCoderSchema } from '@/lib/validation/admin';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');
    const { id: fromClassId } = await context.params;
    const parsed = transferCoderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data perpindahan belum lengkap', details: parsed.error.flatten() }, { status: 400 });
    }

    const [coder, fromClass, toClass] = await Promise.all([
      usersDao.getUserById(parsed.data.coderId),
      classesDao.getClassById(fromClassId),
      classesDao.getClassById(parsed.data.targetClassId),
    ]);
    if (!coder || coder.role !== 'CODER') return NextResponse.json({ error: 'Coder tidak ditemukan' }, { status: 404 });
    if (!fromClass || !toClass) return NextResponse.json({ error: 'Kelas asal atau tujuan tidak ditemukan' }, { status: 404 });
    if (fromClass.type !== toClass.type) {
      return NextResponse.json({ error: 'Pindah kelas hanya tersedia dalam program yang sama' }, { status: 400 });
    }

    const enrollment = await classesDao.transferCoderEnrollment({
      coderId: coder.id,
      fromClassId,
      toClassId: toClass.id,
      effectiveAt: parsed.data.effectiveAt,
      reason: parsed.data.reason,
      adminId: session.user.id,
    });

    let setupWarning: string | null = null;
    try {
      await initializeWeeklyEnrollmentJourney({ klass: toClass, enrollment });
    } catch (error) {
      console.error('[EnrollmentTransfer] Target journey setup failed after transfer', error);
      setupWarning = 'Perpindahan tersimpan, tetapi sinkronisasi journey perlu diperiksa.';
    }

    const notificationTargets = [
      { id: fromClass.coach_id, message: `${coder.full_name} dipindahkan dari ${fromClass.name} ke ${toClass.name}.` },
      { id: toClass.coach_id, message: `${coder.full_name} kini terdaftar di ${toClass.name} setelah pindah dari ${fromClass.name}.` },
      { id: coder.id, message: `Kelas aktif Anda berubah dari ${fromClass.name} ke ${toClass.name}.` },
    ].filter((target, index, all) => target.id && all.findIndex((entry) => entry.id === target.id) === index);

    await Promise.allSettled(notificationTargets.map((target) => notificationsDao.createNotification(
      target.id,
      'Perpindahan kelas',
      target.message,
      'CLASS_TRANSFER',
      {
        actionUrl: target.id === coder.id ? '/coder/dashboard' : '/coach/dashboard',
        category: 'SCHEDULE',
        priority: 'HIGH',
        dedupeKey: `class-transfer-${fromClassId}-${toClass.id}-${coder.id}`,
        push: true,
        pushTag: `class-transfer-${coder.id}`,
      },
    )));

    return NextResponse.json({ success: true, enrollment, warning: setupWarning });
  } catch (error) {
    console.error('[EnrollmentTransfer] Failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal memindahkan coder' }, { status: 400 });
  }
}
