import { describe, expect, it, vi } from 'vitest';
import { savePortfolioDraft, type PortfolioSaveProgress } from '@/lib/savePortfolioDraft';
import { uniquePortfolioTags } from '@/lib/portfolioTags';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const state = (): PortfolioSaveProgress => ({ images: [], uploadComplete: false, needsReload: false });
const file = new File(['image'], 'project.png', { type: 'image/png' });
const image = { id: 'image-1', public_url: 'https://example.com/project.png', sort_order: 0 };

describe('portfolio save recovery', () => {
  it('saves text then media then submits; preserves returned identity', async () => {
    const progress = state();
    const request = vi.fn().mockResolvedValueOnce(response({ id: 'draft-1' })).mockResolvedValueOnce(response({ screenshots: [image] })).mockResolvedValueOnce(response({ status: 'SUBMITTED' }));
    await savePortfolioDraft(progress, { title: 'Test project' }, [file], true, request);
    expect(request.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['/api/coder/portfolios', 'POST'], ['/api/coder/portfolios/draft-1/screenshots', 'POST'], ['/api/coder/portfolios/draft-1/submit', 'POST'],
    ]);
    expect(progress).toEqual({ id: 'draft-1', images: [image], uploadComplete: true, needsReload: false });
  });
  it('retries a rejected upload against the same saved draft, not a new record', async () => {
    const progress = state();
    const request = vi.fn().mockResolvedValueOnce(response({ id: 'draft-1' })).mockResolvedValueOnce(response({ error: 'Upload rejected' }, 400));
    await expect(savePortfolioDraft(progress, {}, [file], true, request)).rejects.toThrow('Draft teks sudah tersimpan');
    expect(request).toHaveBeenCalledTimes(2);
    request.mockResolvedValueOnce(response({ id: 'draft-1' })).mockResolvedValueOnce(response({ screenshots: [image] })).mockResolvedValueOnce(response({}));
    await savePortfolioDraft(progress, {}, [file], true, request);
    expect(request.mock.calls[2][0]).toBe('/api/coder/portfolios/draft-1');
    expect(request.mock.calls[2][1].method).toBe('PATCH');
  });
  it('does not upload twice after a rejected review', async () => {
    const progress = state();
    const request = vi.fn().mockResolvedValueOnce(response({ id: 'draft-1' })).mockResolvedValueOnce(response({ screenshots: [image] })).mockResolvedValueOnce(response({ error: 'Review rejected' }, 400));
    await expect(savePortfolioDraft(progress, {}, [file], true, request)).rejects.toThrow('Review rejected');
    request.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({}));
    await savePortfolioDraft(progress, {}, [file], true, request);
    expect(request.mock.calls.filter(([url]) => url.endsWith('/screenshots'))).toHaveLength(1);
    expect(progress.images).toEqual([image]);
  });
  it.each(['create', 'upload', 'review'])('requires reconciliation after ambiguous %s, never blindly retries', async (stage) => {
    const progress = state();
    const request = vi.fn();
    if (stage !== 'create') request.mockResolvedValueOnce(response({ id: 'draft-1' }));
    if (stage === 'review') request.mockResolvedValueOnce(response({ screenshots: [image] }));
    request.mockRejectedValueOnce(new TypeError('Network disconnected'));
    await expect(savePortfolioDraft(progress, {}, [file], true, request)).rejects.toThrow('hasil proses belum bisa dipastikan');
    const count = request.mock.calls.length;
    await expect(savePortfolioDraft(progress, {}, [file], true, request)).rejects.toThrow('Periksa draft');
    expect(request).toHaveBeenCalledTimes(count);
  });
  it('allows retrying an idempotent text update after network failure', async () => {
    const progress = { ...state(), id: 'existing' };
    const request = vi.fn().mockRejectedValueOnce(new TypeError('offline'));
    await expect(savePortfolioDraft(progress, {}, [], false, request)).rejects.toThrow('coba simpan lagi');
    expect(progress.needsReload).toBe(false);
  });
  it('never uploads or submits when text validation fails', async () => {
    const request = vi.fn().mockResolvedValueOnce(response({ error: 'Judul wajib' }, 400));
    await expect(savePortfolioDraft(state(), {}, [file], true, request)).rejects.toThrow('Judul wajib');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('treats a create 500 as ambiguous because the row may already exist', async () => {
    const progress = state();
    const request = vi.fn().mockResolvedValueOnce(response({ error: 'Internal failure' }, 500));
    await expect(savePortfolioDraft(progress, {}, [], false, request)).rejects.toThrow('hasil proses belum bisa dipastikan');
    expect(progress.needsReload).toBe(true);
  });
  it('deduplicates spelling without merging distinct skills', () => {
    expect(uniquePortfolioTags([' Game  Design ', 'game design', 'Game Development', '', 'Logic', 'logic'])).toEqual(['Game Design', 'Game Development', 'Logic']);
  });
});
