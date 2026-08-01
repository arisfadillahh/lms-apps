import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
