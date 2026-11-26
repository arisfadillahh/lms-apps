import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerAuthSession } from '@/lib/auth';
import { getClassById } from '@/lib/dao/classesDao';
import { saveClassMotorTransportRule } from '@/lib/dao/payrollDao';
import { canAccessMenu } from '@/lib/permissions';
import { CLASS_TRANSPORT_TYPES } from '@/lib/payroll/transport';

const command = z.object({
  classId: z.string().uuid(),
  coachId: z.string().uuid(),
  transportType: z.enum(CLASS_TRANSPORT_TYPES).optional(),
  enabled: z.boolean().optional(),
}).refine(value => value.transportType !== undefined || value.enabled !== undefined);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user.isActive) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
  if (session.user.role !== 'ADMIN' || !canAccessMenu(session.user.username, session.user.adminPermissions ?? null, 'classes')) {
    return NextResponse.json({ error: 'Akses pengelolaan kelas diperlukan.' }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = command.safeParse({ classId: id, coachId: body?.coachId, transportType: body?.transportType, enabled: body?.enabled });
  if (!parsed.success) return NextResponse.json({ error: 'Pilih jenis transport yang valid.' }, { status: 400 });

  try {
    const klass = await getClassById(parsed.data.classId);
    if (!klass) return NextResponse.json({ error: 'Kelas tidak ditemukan.' }, { status: 404 });
    if (klass.delivery_mode !== 'OFFLINE' || klass.coach_id !== parsed.data.coachId) {
      return NextResponse.json({ error: 'Data kelas berubah. Muat ulang sebelum mengubah transport.' }, { status: 409 });
    }
    const transportType = parsed.data.transportType ?? (parsed.data.enabled ? 'MOTOR' : null);
    await saveClassMotorTransportRule(klass.id, klass.coach_id, transportType, session.user.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan transport.' }, { status: 500 });
  }
}
