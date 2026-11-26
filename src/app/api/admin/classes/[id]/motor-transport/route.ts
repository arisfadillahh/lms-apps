import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerAuthSession } from '@/lib/auth';
import { getClassById } from '@/lib/dao/classesDao';
import { saveClassMotorTransportRule } from '@/lib/dao/payrollDao';
import { canAccessMenu } from '@/lib/permissions';

const command = z.object({ classId: z.string().uuid(), coachId: z.string().uuid(), enabled: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user.isActive) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
  if (session.user.role !== 'ADMIN' || !canAccessMenu(session.user.username, session.user.adminPermissions ?? null, 'classes')) {
    return NextResponse.json({ error: 'Akses pengelolaan kelas diperlukan.' }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = command.safeParse({ classId: id, coachId: body?.coachId, enabled: body?.enabled });
  if (!parsed.success) return NextResponse.json({ error: 'Pengaturan transport motor tidak valid.' }, { status: 400 });

  try {
    const klass = await getClassById(parsed.data.classId);
    if (!klass) return NextResponse.json({ error: 'Kelas tidak ditemukan.' }, { status: 404 });
    if (klass.delivery_mode !== 'OFFLINE' || klass.coach_id !== parsed.data.coachId) {
      return NextResponse.json({ error: 'Data kelas berubah. Muat ulang sebelum mengubah transport motor.' }, { status: 409 });
    }
    await saveClassMotorTransportRule(klass.id, parsed.data.enabled ? klass.coach_id : null, session.user.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan transport motor.' }, { status: 500 });
  }
}
