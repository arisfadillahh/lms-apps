'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, Save, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { savePortfolioDraft, type PortfolioSaveProgress } from '@/lib/savePortfolioDraft';
import PortfolioTagInput from './PortfolioTagInput';

type PortfolioClass = {
  id: string;
  name: string;
  type: 'WEEKLY' | 'EKSKUL';
  blocks: Array<{ id: string; name: string }>;
};

type ExistingImage = { id: string; public_url: string; sort_order: number };

type InitialPortfolio = {
  id: string;
  class_id: string;
  block_id: string | null;
  evaluation_session_id: string | null;
  title: string;
  project_type: string;
  summary: string;
  description: string;
  role_contribution: string;
  tools: string[];
  how_to_play: string;
  playable_url: string;
  repository_url: string | null;
  video_url: string | null;
  learning_reflection: string;
  next_steps: string;
  skills: string[];
  status: string;
  review_note: string | null;
  screenshots: ExistingImage[];
};

export default function PortfolioForm({
  classes,
  initial,
  defaults,
}: {
  classes: PortfolioClass[];
  initial?: InitialPortfolio;
  defaults?: { classId?: string; blockId?: string; evaluationSessionId?: string };
}) {
  const router = useRouter();
  const [selectedClassId, setSelectedClassId] = useState(initial?.class_id || defaults?.classId || classes[0]?.id || '');
  const [images, setImages] = useState<ExistingImage[]>(initial?.screenshots || []);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const progress = useRef<PortfolioSaveProgress>({ id: initial?.id, images: initial?.screenshots || [], uploadedFileIndexes: [], uploadComplete: false, needsReload: false });
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const onLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.('a[href]');
      if (!dirtyRef.current || !link || link.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('Ada isian yang belum tersimpan. Tetap tinggalkan halaman?')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onLink, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', onLink, true); };
  }, []);
  const markDirty = () => { dirtyRef.current = true; setDirty(true); };
  const selectedClass = useMemo(() => classes.find((item) => item.id === selectedClassId), [classes, selectedClassId]);
  const uploadedCount = progress.current.uploadedFileIndexes.length;
  const pendingFiles = files.filter((_, index) => !progress.current.uploadedFileIndexes.includes(index));
  const totalImages = images.length + files.length - uploadedCount;

  async function removeImage(image: ExistingImage) {
    if (savingRef.current || !progress.current.id || !window.confirm('Hapus screenshot ini? Versi publik lama tetap aman sampai project disetujui ulang.')) return;
    savingRef.current = true; setLoading(true); setError('');
    try {
      const response = await fetch(`/api/coder/portfolios/${progress.current.id}/screenshots/${image.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Screenshot belum berhasil dihapus. Silakan coba lagi.');
      progress.current.images = progress.current.images.filter((item) => item.id !== image.id);
      setImages(progress.current.images);
    } catch (error) { setError(error instanceof Error ? error.message : 'Koneksi terputus. Periksa draft sebelum mencoba lagi.'); }
    finally { savingRef.current = false; setLoading(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || progress.current.needsReload) return;
    savingRef.current = true;
    setLoading(true);
    setError('');
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value || 'draft';
    const data = new FormData(form);
    const payload = {
      classId: selectedClassId,
      blockId: String(data.get('blockId') || '') || null,
      evaluationSessionId: initial?.evaluation_session_id || (selectedClassId === defaults?.classId && String(data.get('blockId') || '') === defaults?.blockId ? defaults?.evaluationSessionId : null) || null,
      title: String(data.get('title') || ''),
      projectType: String(data.get('projectType') || ''),
      summary: String(data.get('summary') || ''),
      description: String(data.get('description') || ''),
      roleContribution: String(data.get('roleContribution') || ''),
      tools: String(data.get('tools') || '').split(',').map((item) => item.trim()).filter(Boolean),
      howToPlay: String(data.get('howToPlay') || ''),
      playableUrl: String(data.get('playableUrl') || ''),
      repositoryUrl: String(data.get('repositoryUrl') || ''),
      videoUrl: String(data.get('videoUrl') || ''),
      learningReflection: String(data.get('learningReflection') || ''),
      nextSteps: String(data.get('nextSteps') || ''),
      skills: String(data.get('skills') || '').split(',').map((item) => item.trim()).filter(Boolean),
      saveAsDraft: intent === 'draft',
    };
    try {
      await savePortfolioDraft(progress.current, payload, files, intent === 'submit');
      dirtyRef.current = false; setDirty(false);
      router.push('/coder/reports/portfolio'); router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal menyimpan. Isian tetap ada.');
    } finally {
      setImages(progress.current.images);
      if (progress.current.uploadComplete) setFiles([]);
      savingRef.current = false;
      setLoading(false);
    }
  }

  const fieldClass = 'mt-2 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 outline-none transition focus:border-sky';
  const labelClass = 'block text-sm font-black text-slate-700';

  return (
    <form onSubmit={submit} onChange={markDirty} className="space-y-6">
      <Link href="/coder/reports/portfolio" className="inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-clevio-navy"><ArrowLeft size={18} /> Kembali ke Portofolio</Link>
      <p role="status" className="text-sm font-semibold text-slate-500">{dirty ? 'Ada isian belum tersimpan. Simpan Draft sebelum meninggalkan halaman.' : 'Isi bertahap. Draft tidak tampil di halaman publik sebelum disetujui Coach.'}</p>
      <nav aria-label="Langkah isi portofolio" className="flex flex-wrap gap-2 text-sm font-bold">
        <a href="#portfolio-about" className="rounded-xl bg-white px-4 py-3">1. Tentang karya</a>
        <a href="#portfolio-media" className="rounded-xl bg-white px-4 py-3">2. Foto & link</a>
        <a href="#portfolio-story" className="rounded-xl bg-white px-4 py-3">3. Cerita belajarku</a>
      </nav>
      {initial?.review_note && <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4"><p className="font-black text-amber-800">Catatan revisi Coach</p><p className="mt-1 text-sm font-semibold text-amber-700">{initial.review_note}</p></div>}
      <fieldset disabled={loading || progress.current.needsReload} className="space-y-6 disabled:opacity-70">
      <section id="portfolio-about" className="scroll-mt-24 rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-pastel-blue font-black text-sky">1</span><div><h2 className="text-xl font-black text-clevio-navy">Tentang karya</h2><p className="text-sm font-semibold text-slate-400">Pilih asal karya dan beri nama yang mudah dikenali.</p></div></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>Kelas asal
            <select value={selectedClassId} disabled={Boolean(progress.current.id) || loading} onChange={(event) => setSelectedClassId(event.target.value)} className={fieldClass} required>
              {classes.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.type === 'WEEKLY' ? 'Weekly' : 'Ekskul'}</option>)}
            </select>
          </label>
          <label className={labelClass}>Block <span className="font-semibold text-slate-400">(opsional)</span>
            <select key={selectedClassId} name="blockId" defaultValue={initial?.block_id || defaults?.blockId || ''} className={fieldClass}>
              <option value="">Project umum / tidak terkait block</option>
              {selectedClass?.blocks.map((block) => <option value={block.id} key={block.id}>{block.name}</option>)}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>Judul project<input name="title" defaultValue={initial?.title} minLength={3} maxLength={120} required className={fieldClass} placeholder="Contoh: Space Runner Adventure" /></label>
          <label className={labelClass}>Jenis project<input name="projectType" defaultValue={initial?.project_type} required className={fieldClass} placeholder="Game, animasi, website…" /></label>
          <label className={labelClass}>Ringkasan singkat<input name="summary" defaultValue={initial?.summary} minLength={10} maxLength={240} required className={fieldClass} placeholder="Satu kalimat yang bikin orang ingin mencoba" /></label>
        </div>
      </section>

      <section id="portfolio-media" className="scroll-mt-24 rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-pastel-yellow font-black text-amber-600">2</span><div><h2 className="text-xl font-black text-clevio-navy">Foto & link</h2><p className="text-sm font-semibold text-slate-400">Tambahkan tampilan karya. Semua link boleh dikosongkan.</p></div></div>
        <label className={labelClass}>Screenshot project <span className="font-semibold text-slate-400">(1–5 gambar, masing-masing &lt; 1 MB)</span>
          <span className="mt-2 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-4 border-dashed border-pastel-blue bg-pastel-blue/20 px-5 py-8 text-sky hover:bg-pastel-blue/40">
            <ImagePlus size={26} /><span className="font-black">Pilih screenshot PNG, JPEG, atau WebP</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(event) => {
              const next = Array.from(event.target.files || []);
              const sameSelection = next.length === files.length && next.every((file, index) => {
                const previous = files[index];
                return previous && file.name === previous.name && file.size === previous.size && file.lastModified === previous.lastModified && file.type === previous.type;
              });
              if (next.some((file) => file.size >= 1024 * 1024)) setError('Setiap screenshot harus lebih kecil dari 1 MB.');
              else if (images.length + next.length - (sameSelection ? progress.current.uploadedFileIndexes.length : 0) <= 5) {
                setFiles(next);
                if (!sameSelection) progress.current.uploadedFileIndexes = [];
                progress.current.uploadComplete = false;
                setError('');
              }
              else setError('Total screenshot maksimal 5 gambar.');
            }} />
          </span>
        </label>
        <p className="mt-2 text-xs font-bold text-slate-400">Gambar pertama menjadi cover. Saat ini: {totalImages}/5.</p>
        {(images.length > 0 || files.length > 0) && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {images.map((image, index) => <div key={image.id} className="relative overflow-hidden rounded-xl border-2 border-slate-100"><img src={image.public_url} alt={`Screenshot ${index + 1}`} className="aspect-video h-full w-full object-cover" /><button type="button" onClick={() => removeImage(image)} aria-label="Hapus screenshot" className="absolute right-1 top-1 rounded-lg bg-white/90 p-1.5 text-red-600 shadow"><Trash2 size={15} /></button></div>)}
          {pendingFiles.map((file, index) => <div key={`${file.name}-${index}`} className="relative flex aspect-video items-center justify-center rounded-xl bg-slate-100 p-2 text-center text-xs font-bold text-slate-500">{file.name}</div>)}
        </div>}
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>Link playable / demo <span className="font-semibold text-slate-400">(opsional)</span><input name="playableUrl" defaultValue={initial?.playable_url} type="url" className={fieldClass} placeholder="https://..." /></label>
            <label className={labelClass}>Link source code <span className="font-semibold text-slate-400">(opsional)</span><input name="repositoryUrl" defaultValue={initial?.repository_url || ''} type="url" className={fieldClass} placeholder="https://github.com/..." /></label>
            <label className={`${labelClass} sm:col-span-2`}>Link video demo <span className="font-semibold text-slate-400">(opsional)</span><input name="videoUrl" defaultValue={initial?.video_url || ''} type="url" className={fieldClass} placeholder="https://youtube.com/..." /></label>
          </div>
      </section>
      <section id="portfolio-story" className="scroll-mt-24 rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-pastel-green font-black text-clevio-green">3</span><div><h2 className="text-xl font-black text-clevio-navy">Cerita belajarku</h2><p className="text-sm font-semibold text-slate-400">Jawab dengan bahasamu sendiri. Kamu boleh simpan draft dan melanjutkan nanti.</p></div></div>
        <div className="space-y-5">
          <label className={labelClass}>Deskripsi dan tujuan<textarea name="description" defaultValue={initial?.description} minLength={20} required rows={5} className={fieldClass} placeholder="Masalah apa yang ingin diselesaikan dan seperti apa projectnya?" /></label>
          <label className={labelClass}>Peran dan kontribusiku<textarea name="roleContribution" defaultValue={initial?.role_contribution} minLength={10} required rows={3} className={fieldClass} placeholder="Bagian apa yang kamu buat sendiri?" /></label>
          <PortfolioTagInput name="tools" label="Tools / teknologi" initial={initial?.tools || []} suggestions={['Scratch', 'Roblox Studio', 'JavaScript', 'Python', 'HTML', 'CSS']} onChange={markDirty} />
          <label className={labelClass}>Cara bermain / menggunakan<textarea name="howToPlay" defaultValue={initial?.how_to_play} minLength={10} required rows={3} className={fieldClass} placeholder="Berikan instruksi singkat dan jelas." /></label>

        </div>
        <div className="mt-6 space-y-5">
          <label className={labelClass}>Hal paling penting yang kupelajari<textarea name="learningReflection" defaultValue={initial?.learning_reflection} minLength={10} required rows={4} className={fieldClass} placeholder="Tantangan apa yang kamu lewati dan apa yang sekarang kamu pahami?" /></label>
          <label className={labelClass}>Yang ingin kukembangkan berikutnya<textarea name="nextSteps" defaultValue={initial?.next_steps} minLength={10} required rows={3} className={fieldClass} placeholder="Fitur, desain, atau kemampuan apa yang ingin kamu tingkatkan?" /></label>
          <PortfolioTagInput name="skills" label="Skill yang dipraktikkan" initial={initial?.skills || []} suggestions={['Game Design', 'Game Development', 'Debugging', 'Storytelling', 'Logic', 'Problem Solving']} onChange={markDirty} />
        </div>

      </section>


      </fieldset>
      {progress.current.needsReload && <Link href={progress.current.id ? `/coder/reports/portfolio/${progress.current.id}/edit` : '/coder/reports/portfolio'} className="block rounded-xl bg-pastel-blue p-4 font-bold text-clevio-navy">Periksa draft tersimpan sebelum melanjutkan</Link>}
      {error && <div role="alert" className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>}
      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur sm:flex-row sm:justify-end">
        <button type="submit" name="intent" value="draft" formNoValidate disabled={loading || progress.current.needsReload} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-clevio-navy px-5 py-3 font-black text-clevio-navy disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={19} /> : <Save size={19} />} Simpan Draft
        </button>
        <button type="submit" name="intent" value="submit" disabled={loading || progress.current.needsReload || totalImages < 1} className="inline-flex items-center justify-center gap-2 rounded-xl bg-clevio-green px-5 py-3 font-black text-clevio-navy shadow-lg disabled:cursor-not-allowed disabled:opacity-40">
          {loading ? <Loader2 className="animate-spin" size={19} /> : initial?.status === 'REVISION' ? <CheckCircle2 size={19} /> : <Send size={19} />} {initial?.status === 'REVISION' ? 'Kirim Ulang ke Coach' : 'Simpan & Kirim ke Coach'}
        </button>
      </div>
    </form>
  );
}
