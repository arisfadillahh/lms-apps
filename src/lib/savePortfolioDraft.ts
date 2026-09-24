export type SavedPortfolioImage = { id: string; public_url: string; sort_order: number };
export type PortfolioSaveProgress = {
  id?: string;
  images: SavedPortfolioImage[];
  uploadedFileIndexes: number[];
  uploadComplete: boolean;
  needsReload: boolean;
};

/** Retain confirmed progress between retries; never repeat an ambiguous create/upload. */
export async function savePortfolioDraft(
  progress: PortfolioSaveProgress,
  payload: Record<string, unknown>,
  files: File[],
  submit: boolean,
  request: typeof fetch = fetch,
) {
  if (progress.needsReload) throw new Error('Periksa draft tersimpan sebelum mencoba lagi.');
  let stage: 'save' | 'upload' | 'review' = 'save';
  let confirmedResponse = false;
  const creating = !progress.id;
  try {
    const response = await request(progress.id ? `/api/coder/portfolios/${progress.id}` : '/api/coder/portfolios', {
      method: progress.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await response.json();
    confirmedResponse = response.status < 500 || !creating;
    if (!response.ok) throw new Error(body.error || 'Portofolio gagal disimpan.');
    progress.id = progress.id || body.id;
    if (!progress.id) { progress.needsReload = true; throw new Error('Respons penyimpanan tidak lengkap. Periksa daftar draft.'); }

    if (files.length && !progress.uploadComplete) {
      stage = 'upload';
      for (const [index, file] of files.entries()) {
        if (progress.uploadedFileIndexes.includes(index)) continue;
        confirmedResponse = false;
        const upload = await request(`/api/coder/portfolios/${progress.id}/screenshots`, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        const result = await upload.json();
        confirmedResponse = upload.status < 500;
        if (!upload.ok) throw new Error(`${result.error || 'Screenshot gagal diunggah.'} Draft teks sudah tersimpan; coba lagi.`);
        if (!Array.isArray(result.screenshots) || result.screenshots.length !== 1) {
          confirmedResponse = false;
          throw new Error('Respons upload tidak lengkap.');
        }
        progress.images = [...progress.images, result.screenshots[0]];
        progress.uploadedFileIndexes = [...progress.uploadedFileIndexes, index];
      }
      progress.uploadComplete = true;
    }
    if (submit) {
      stage = 'review'; confirmedResponse = false;
      const review = await request(`/api/coder/portfolios/${progress.id}/submit`, { method: 'POST' });
      const result = await review.json();
      confirmedResponse = review.status < 500;
      if (!review.ok) throw new Error(result.error || 'Draft tersimpan, tetapi belum terkirim ke Coach.');
    }
  } catch (error) {
    if (!confirmedResponse) {
      // The server may have committed before the connection was lost. Reconcile in
      // the saved workspace, rather than create duplicates or resubmit a review.
      progress.needsReload = stage !== 'save' || creating;
      throw new Error(progress.needsReload
        ? 'Koneksi terputus; hasil proses belum bisa dipastikan. Buka draft tersimpan untuk memeriksa sebelum melanjutkan. Isian di halaman ini tetap ada.'
        : 'Koneksi terputus. Isian tetap ada; silakan coba simpan lagi.');
    }
    throw error;
  }
}
