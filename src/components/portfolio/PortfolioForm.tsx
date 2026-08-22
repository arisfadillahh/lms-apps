'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, Save, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';

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
  const selectedClass = useMemo(() => classes.find((item) => item.id === selectedClassId), [classes, selectedClassId]);
  const totalImages = images.length + files.length;

  async function removeImage(image: ExistingImage) {
    if (!initial || !window.confirm('Hapus screenshot ini? Versi publik lama tetap aman sampai project disetujui ulang.')) return;
    const response = await fetch(`/api/coder/portfolios/${initial.id}/screenshots/${image.id}`, { method: 'DELETE' });
    if (response.ok) setImages((current) => current.filter((item) => item.id !== image.id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value || 'draft';
    const data = new FormData(form);
    const payload = {
      classId: selectedClassId,
      blockId: String(data.get('blockId') || '') || null,
      evaluationSessionId: initial?.evaluation_session_id || defaults?.evaluationSessionId || null,
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
    const response = await fetch(initial ? `/api/coder/portfolios/${initial.id}` : '/api/coder/portfolios', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Portofolio gagal disimpan.');
      setLoading(false);
      return;
    }
    const portfolioId = initial?.id || body.id;
    if (files.length > 0) {
      const uploadData = new FormData();
      files.forEach((file) => uploadData.append('images', file));
      const upload = await fetch(`/api/coder/portfolios/${portfolioId}/screenshots`, { method: 'POST', body: uploadData });
      const uploadBody = await upload.json().catch(() => ({}));
      if (!upload.ok) {
        setError(`${uploadBody.error || 'Screenshot gagal diunggah.'} Draft teks tetap sudah tersimpan.`);
        setLoading(false);
        return;
      }
    }
    if (intent === 'submit') {
      const review = await fetch(`/api/coder/portfolios/${portfolioId}/submit`, { method: 'POST' });
      const reviewBody = await review.json().catch(() => ({}));
      if (!review.ok) {
        setError(reviewBody.error || 'Draft tersimpan, tetapi belum berhasil dikirim ke Coach.');
        setLoading(false);
        return;
      }
    }
    router.push('/coder/reports/portfolio');
    router.refresh();
  }

  const fieldClass = 'mt-2 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 outline-none transition focus:border-sky';
  const labelClass = 'block text-sm font-black text-slate-700';

  return (
    <form onSubmit={submit} className="space-y-6">
      <Link href="/coder/reports/portfolio" className="inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-clevio-navy"><ArrowLeft size={18} /> Kembali ke Portofolio</Link>
      {initial?.review_note && <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4"><p className="font-black text-amber-800">Catatan revisi Coach</p><p className="mt-1 text-sm font-semibold text-amber-700">{initial.review_note}</p></div>}
      <section className="rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-pastel-blue font-black text-sky">1</span><div><h2 className="text-xl font-black text-clevio-navy">Identitas karya</h2><p className="text-sm font-semibold text-slate-400">Pilih asal karya dan beri nama yang mudah dikenali.</p></div></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>Kelas asal
            <select value={selectedClassId} disabled={Boolean(initial)} onChange={(event) => setSelectedClassId(event.target.value)} className={fieldClass} required>
              {classes.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.type === 'WEEKLY' ? 'Weekly' : 'Ekskul'}</option>)}
            </select>
          </label>
          <label className={labelClass}>Block <span className="font-semibold text-slate-400">(opsional)</span>
            <select name="blockId" defaultValue={initial?.block_id || defaults?.blockId || ''} className={fieldClass}>
              <option value="">Project umum / tidak terkait block</option>
              {selectedClass?.blocks.map((block) => <option value={block.id} key={block.id}>{block.name}</option>)}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>Judul project<input name="title" defaultValue={initial?.title} minLength={3} maxLength={120} required className={fieldClass} placeholder="Contoh: Space Runner Adventure" /></label>
          <label className={labelClass}>Jenis project<input name="projectType" defaultValue={initial?.project_type} required className={fieldClass} placeholder="Game, animasi, website…" /></label>
          <label className={labelClass}>Ringkasan singkat<input name="summary" defaultValue={initial?.summary} minLength={10} maxLength={240} required className={fieldClass} placeholder="Satu kalimat yang bikin orang ingin mencoba" /></label>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-pastel-green font-black text-clevio-green">2</span><div><h2 className="text-xl font-black text-clevio-navy">Cerita project</h2><p className="text-sm font-semibold text-slate-400">Ceritakan tujuan, kontribusi, dan cara mencoba karyamu.</p></div></div>
        <div className="space-y-5">
          <label className={labelClass}>Deskripsi dan tujuan<textarea name="description" defaultValue={initial?.description} minLength={20} required rows={5} className={fieldClass} placeholder="Masalah apa yang ingin diselesaikan dan seperti apa projectnya?" /></label>
          <label className={labelClass}>Peran dan kontribusiku<textarea name="roleContribution" defaultValue={initial?.role_contribution} minLength={10} required rows={3} className={fieldClass} placeholder="Bagian apa yang kamu buat sendiri?" /></label>
          <label className={labelClass}>Tools / teknologi<input name="tools" defaultValue={initial?.tools.join(', ')} required className={fieldClass} placeholder="Scratch, Roblox Studio, JavaScript (pisahkan dengan koma)" /></label>
          <label className={labelClass}>Cara bermain / menggunakan<textarea name="howToPlay" defaultValue={initial?.how_to_play} minLength={10} required rows={3} className={fieldClass} placeholder="Berikan instruksi singkat dan jelas." /></label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>Link playable / demo <span className="font-semibold text-slate-400">(opsional)</span><input name="playableUrl" defaultValue={initial?.playable_url} type="url" className={fieldClass} placeholder="https://..." /></label>
            <label className={labelClass}>Link source code <span className="font-semibold text-slate-400">(opsional)</span><input name="repositoryUrl" defaultValue={initial?.repository_url || ''} type="url" className={fieldClass} placeholder="https://github.com/..." /></label>
            <label className={`${labelClass} sm:col-span-2`}>Link video demo <span className="font-semibold text-slate-400">(opsional)</span><input name="videoUrl" defaultValue={initial?.video_url || ''} type="url" className={fieldClass} placeholder="https://youtube.com/..." /></label>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-pastel-yellow font-black text-amber-600">3</span><div><h2 className="text-xl font-black text-clevio-navy">Bukti dan refleksi</h2><p className="text-sm font-semibold text-slate-400">Tambahkan screenshot dan pelajaran penting dari prosesmu.</p></div></div>
        <label className={labelClass}>Screenshot project <span className="font-semibold text-slate-400">(1–5 gambar, masing-masing &lt; 1 MB)</span>
          <span className="mt-2 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-4 border-dashed border-pastel-blue bg-pastel-blue/20 px-5 py-8 text-sky hover:bg-pastel-blue/40">
            <ImagePlus size={26} /><span className="font-black">Pilih screenshot PNG, JPEG, atau WebP</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(event) => {
              const next = Array.from(event.target.files || []);
              if (images.length + next.length <= 5) setFiles(next);
              else setError('Total screenshot maksimal 5 gambar.');
            }} />
          </span>
        </label>
        <p className="mt-2 text-xs font-bold text-slate-400">Gambar pertama menjadi cover. Saat ini: {totalImages}/5.</p>
        {(images.length > 0 || files.length > 0) && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {images.map((image, index) => <div key={image.id} className="relative overflow-hidden rounded-xl border-2 border-slate-100"><img src={image.public_url} alt={`Screenshot ${index + 1}`} className="aspect-video h-full w-full object-cover" /><button type="button" onClick={() => removeImage(image)} aria-label="Hapus screenshot" className="absolute right-1 top-1 rounded-lg bg-white/90 p-1.5 text-red-600 shadow"><Trash2 size={15} /></button></div>)}
          {files.map((file, index) => <div key={`${file.name}-${index}`} className="relative flex aspect-video items-center justify-center rounded-xl bg-slate-100 p-2 text-center text-xs font-bold text-slate-500">{file.name}</div>)}
        </div>}
        <div className="mt-6 space-y-5">
          <label className={labelClass}>Hal paling penting yang kupelajari<textarea name="learningReflection" defaultValue={initial?.learning_reflection} minLength={10} required rows={4} className={fieldClass} placeholder="Tantangan apa yang kamu lewati dan apa yang sekarang kamu pahami?" /></label>
          <label className={labelClass}>Yang ingin kukembangkan berikutnya<textarea name="nextSteps" defaultValue={initial?.next_steps} minLength={10} required rows={3} className={fieldClass} placeholder="Fitur, desain, atau kemampuan apa yang ingin kamu tingkatkan?" /></label>
          <label className={labelClass}>Skill yang ditunjukkan<input name="skills" defaultValue={initial?.skills.join(', ')} required className={fieldClass} placeholder="Game design, debugging, storytelling (pisahkan dengan koma)" /></label>
        </div>
      </section>

      {error && <div role="alert" className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>}
      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur sm:flex-row sm:justify-end">
        <button type="submit" name="intent" value="draft" formNoValidate disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-clevio-navy px-5 py-3 font-black text-clevio-navy disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={19} /> : <Save size={19} />} Simpan Draft
        </button>
        <button type="submit" name="intent" value="submit" disabled={loading || totalImages < 1} className="inline-flex items-center justify-center gap-2 rounded-xl bg-clevio-green px-5 py-3 font-black text-clevio-navy shadow-lg disabled:cursor-not-allowed disabled:opacity-40">
          {loading ? <Loader2 className="animate-spin" size={19} /> : initial?.status === 'REVISION' ? <CheckCircle2 size={19} /> : <Send size={19} />} {initial?.status === 'REVISION' ? 'Kirim Ulang ke Coach' : 'Simpan & Kirim ke Coach'}
        </button>
      </div>
    </form>
  );
}
