'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Check, ArchiveRestore, Bot, Loader2 } from 'lucide-react';

export type ReportDescriptionItem = {
  criteriaId: string;
  criteriaName: string;
  score: number;
  description: string;
};

const getGrade = (score: number) => {
  if (score >= 8.5) return 'A';
  if (score >= 7.0) return 'B';
  if (score >= 5.5) return 'C';
  return 'D';
};

export default function ReportReviewClient({ reportId, initialDescriptions }: { reportId: string, initialDescriptions: ReportDescriptionItem[] }) {
  const router = useRouter();
  const [descriptions, setDescriptions] = useState(initialDescriptions);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleRegenerateCriteria = async (criteriaId: string, criteriaName: string, score: number) => {
    try {
      setGeneratingId(criteriaId);
      setErrorMsg('');
      const res = await fetch(`/api/coach/reports/${reportId}/regenerate-criteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteriaId, criteriaName, score })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal me-regenerate deskripsi.');
      }

      const { description } = await res.json();
      setDescriptions(prev => prev.map(p => p.criteriaId === criteriaId ? { ...p, description } : p));
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setGeneratingId(null);
    }
  };

  const handlePublish = () => {
    const hasEmpty = descriptions.some(d => !d.description.trim());
    if (hasEmpty) {
      setErrorMsg('Semua kolom deskripsi kriteria tidak boleh kosong.');
      return;
    }

    startTransition(async () => {
      try {
        setErrorMsg('');
        const res = await fetch(`/api/coach/reports/${reportId}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descriptions })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal mem-publish rapor.');
        }

        router.push('/coach/reports');
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err.message);
      }
    });
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = () => {
    if (!confirm('Apakah Anda yakin ingin menghapus draf rapor ini? Seluruh nilai (lesson evaluations) yang berkaitan dengan draf ini akan dihapus, dan antrean nilainya akan muncul kembali di Dashboard.')) {
      return;
    }

    startTransition(async () => {
      setIsDeleting(true);
      try {
        setErrorMsg('');
        const res = await fetch(`/api/coach/reports/${reportId}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal menghapus draf rapor.');
        }

        router.push('/coach/rubrics');
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err.message);
        setIsDeleting(false);
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {errorMsg && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 500 }}>
          {errorMsg}
        </div>
      )}

      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
          <Sparkles size={18} color="#8b5cf6" /> Narasi Rapor (Draft AI)
        </label>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
          Teks awal ini ditulis oleh AI berdasarkan nilai rubrik yang Anda berikan. Bebas diedit sesuai gaya bahasa Anda untuk tiap kriteria.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {descriptions.map((desc, index) => (
            <div key={desc.criteriaId} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155', display: 'flex', justifyItems: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {desc.criteriaName}
                  <button
                    type="button"
                    onClick={() => handleRegenerateCriteria(desc.criteriaId, desc.criteriaName, desc.score)}
                    disabled={generatingId !== null || isPending || isDeleting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '0.15rem 0.5rem', 
                      borderRadius: '99px', background: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe', 
                      cursor: generatingId !== null ? 'wait' : 'pointer', fontWeight: 600
                    }}
                  >
                    {generatingId === desc.criteriaId ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                    Isi dengan AI
                  </button>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#64748b', background: '#f1f5f9', padding: '0.1rem 0.5rem', borderRadius: '0.5rem', fontWeight: 700, marginLeft: 'auto' }}>
                  Nilai: <span style={{ color: '#10b981', fontSize: '0.95rem' }}>{getGrade(desc.score)}</span> <span style={{ fontWeight: 500 }}>({desc.score}/10)</span>
                </span>
              </label>
              <textarea 
                value={desc.description}
                onChange={(e) => {
                  const newText = e.target.value;
                  setDescriptions(prev => prev.map((p, i) => i === index ? { ...p, description: newText } : p));
                }}
                rows={4}
                disabled={isPending || isDeleting}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  border: '2px solid #cbd5e1',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  color: '#334155',
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
        
        <button 
          type="button"
          onClick={handleDelete}
          disabled={isPending || isDeleting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.5rem',
            background: '#fee2e2',
            color: '#dc2626',
            border: 'none',
            fontWeight: 700,
            cursor: (isPending || isDeleting) ? 'not-allowed' : 'pointer',
          }}
        >
          {isDeleting ? 'Menghapus...' : <><ArchiveRestore size={18} /> Hapus & Ulang Nilai</>}
        </button>

        <button 
          type="button"
          onClick={handlePublish}
          disabled={isPending || isDeleting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.75rem',
            borderRadius: '0.5rem',
            background: '#16a34a',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            cursor: (isPending || isDeleting) ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)'
          }}
        >
          {isPending && !isDeleting ? 'Memproses...' : <><Check size={18} /> Publish Rapor</>}
        </button>
      </div>
    </div>
  );
}
