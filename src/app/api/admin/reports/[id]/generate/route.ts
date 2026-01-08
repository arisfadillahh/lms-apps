import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { rubricsDao } from '@/lib/dao';
import { generateRubricPdf } from '@/lib/pdf/generateRubricPdf';
import { assertRole } from '@/lib/roles';

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const submissionId = context.params.id;
  const submission = await rubricsDao.getRubricSubmissionById(submissionId);
  if (!submission) {
    return NextResponse.json({ error: 'Rubric submission tidak ditemukan' }, { status: 404 });
  }

  try {
    const { report, pdfUrl, storagePath } = await generateRubricPdf(submissionId);
    return NextResponse.json({ report, pdfUrl, storagePath });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal membuat PDF rapor';
    console.error('Failed to generate rubric PDF', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
