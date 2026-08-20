import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import {
  PORTFOLIO_MAX_SCREENSHOTS,
  assertPortfolioImage,
  getPortfolioApiErrorStatus,
  nextStatusAfterCoderEdit,
  type PortfolioRecord,
} from '@/lib/coderPortfolio';
import { deletePortfolioScreenshots, uploadPortfolioScreenshot } from '@/lib/storage';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const uploadedPaths: string[] = [];
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'CODER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const supabase = getSupabaseAdmin() as any;
    const [{ data: portfolio, error: portfolioError }, { data: existing, error: existingError }] = await Promise.all([
      supabase.from('coder_portfolios').select('id, status').eq('id', id).eq('coder_id', session.user.id).maybeSingle(),
      supabase.from('coder_portfolio_screenshots').select('id, sort_order').eq('portfolio_id', id).order('sort_order'),
    ]);
    if (portfolioError) throw portfolioError;
    if (existingError) throw existingError;
    if (!portfolio) return NextResponse.json({ error: 'Portofolio tidak ditemukan.' }, { status: 404 });

    const formData = await request.formData();
    const files = formData.getAll('images').filter((value): value is File => value instanceof File);
    if (files.length < 1 || (existing?.length ?? 0) + files.length > PORTFOLIO_MAX_SCREENSHOTS) {
      return NextResponse.json({ error: `Total screenshot harus 1-${PORTFOLIO_MAX_SCREENSHOTS}.` }, { status: 400 });
    }
    const validatedFiles = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        assertPortfolioImage({ type: file.type, size: file.size, bytes: buffer });
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : 'Screenshot tidak valid.';
        return NextResponse.json({ error: message }, { status: 400 });
      }
      validatedFiles.push({ file, buffer });
    }

    const startOrder = existing?.length ?? 0;
    const rows = [];
    for (const [index, item] of validatedFiles.entries()) {
      const { file, buffer } = item;
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const storagePath = `coder-portfolios/${session.user.id}/${id}/${randomUUID()}.${extension}`;
      const publicUrl = await uploadPortfolioScreenshot(storagePath, buffer, file.type);
      uploadedPaths.push(storagePath);
      rows.push({
        portfolio_id: id,
        storage_path: storagePath,
        public_url: publicUrl,
        sort_order: startOrder + index,
        alt_text: `${file.name} - screenshot project`,
      });
    }
    const { data, error } = await supabase.from('coder_portfolio_screenshots').insert(rows).select('*');
    if (error) throw error;

    const status = nextStatusAfterCoderEdit(portfolio.status as PortfolioRecord['status']);
    if (status !== portfolio.status) {
      await supabase.from('coder_portfolios').update({ status }).eq('id', id).eq('coder_id', session.user.id);
    }
    return NextResponse.json({ screenshots: data ?? [], status });
  } catch (error) {
    if (uploadedPaths.length > 0) {
      try { await deletePortfolioScreenshots(uploadedPaths); } catch (cleanupError) {
        console.error('[CoderPortfolio upload cleanup]', cleanupError);
      }
    }
    console.error('[CoderPortfolio screenshots POST]', error);
    const status = getPortfolioApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Gagal mengunggah screenshot.' }, { status });
  }
}
