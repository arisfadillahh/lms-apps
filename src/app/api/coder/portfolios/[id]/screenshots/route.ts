import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import {
  PORTFOLIO_MAX_SCREENSHOTS,
  PORTFOLIO_MAX_IMAGE_BYTES,
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
    // Portfolio tables are not represented in the generated Supabase database types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getSupabaseAdmin() as any;
    const [{ data: portfolio, error: portfolioError }, { data: existing, error: existingError }] = await Promise.all([
      supabase.from('coder_portfolios').select('id, status').eq('id', id).eq('coder_id', session.user.id).maybeSingle(),
      supabase.from('coder_portfolio_screenshots').select('id, sort_order').eq('portfolio_id', id).order('sort_order'),
    ]);
    if (portfolioError) throw portfolioError;
    if (existingError) throw existingError;
    if (!portfolio) return NextResponse.json({ error: 'Portofolio tidak ditemukan.' }, { status: 404 });

    if ((existing?.length ?? 0) >= PORTFOLIO_MAX_SCREENSHOTS) {
      return NextResponse.json({ error: `Total screenshot maksimal ${PORTFOLIO_MAX_SCREENSHOTS}.` }, { status: 400 });
    }
    const type = request.headers.get('content-type')?.split(';', 1)[0].trim() || '';
    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > PORTFOLIO_MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Setiap screenshot harus lebih kecil dari 1 MB.' }, { status: 413 });
    }
    const buffer = Buffer.from(await request.arrayBuffer());
    try {
      assertPortfolioImage({ type, size: buffer.byteLength, bytes: buffer });
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : 'Screenshot tidak valid.';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const storagePath = `coder-portfolios/${session.user.id}/${id}/${randomUUID()}.${extension}`;
    const publicUrl = await uploadPortfolioScreenshot(storagePath, buffer, type);
    uploadedPaths.push(storagePath);
    const { data, error } = await supabase.from('coder_portfolio_screenshots').insert({
      portfolio_id: id,
      storage_path: storagePath,
      public_url: publicUrl,
      sort_order: existing?.length ?? 0,
      alt_text: 'Screenshot project',
    }).select('*');
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
