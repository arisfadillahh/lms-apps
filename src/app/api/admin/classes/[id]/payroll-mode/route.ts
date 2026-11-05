import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { canAccessMenu } from '@/lib/permissions';
import { PayrollError } from '@/lib/payroll/model';
import { payrollCommandSchema } from '@/lib/payroll/validation';
import { executePayrollCommand } from '@/lib/services/payrollCommands';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user.isActive) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 });
    if (session.user.role !== 'ADMIN' || !canAccessMenu(session.user.username, session.user.adminPermissions ?? null, 'classes')) return NextResponse.json({ error: 'Akses pengelolaan kelas diperlukan.' }, { status: 403 });
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = payrollCommandSchema.safeParse({ action: 'classMode', classId: id, mode: body?.mode });
    if (!parsed.success) return NextResponse.json({ error: 'Kelas atau mode mengajar tidak valid.' }, { status: 400 });
    await executePayrollCommand(parsed.data, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof PayrollError ? error.message : 'Gagal menyimpan mode mengajar.' }, { status: error instanceof PayrollError ? error.status : 500 });
  }
}
