'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, Check, CheckCircle2, History, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Journey = {
  classId: string;
  className: string;
  levelId: string;
  levelName: string;
  initialized: boolean;
  blocks: Array<{
    id: string;
    name: string;
    orderIndex: number;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  }>;
};

export default function ProgressOverrideButton({ coderId, coderName }: { coderId: string; coderName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [classId, setClassId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const activeJourney = useMemo(() => journeys.find((journey) => journey.classId === classId) ?? null, [journeys, classId]);
  const alreadyCompleted = useMemo(
    () => new Set(activeJourney?.blocks.filter((block) => block.status === 'COMPLETED').map((block) => block.id) ?? []),
    [activeJourney],
  );
  const newSelectionCount = [...selected].filter((id) => !alreadyCompleted.has(id)).length;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFeedback(null);
    fetch(`/api/admin/coders/${coderId}/progress`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Gagal memuat progress');
        const nextJourneys = payload.journeys ?? [];
        setJourneys(nextJourneys);
        const firstClassId = nextJourneys[0]?.classId ?? '';
        setClassId(firstClassId);
        const first = nextJourneys[0];
        setSelected(new Set(first?.blocks.filter((block: Journey['blocks'][number]) => block.status === 'COMPLETED').map((block: Journey['blocks'][number]) => block.id) ?? []));
      })
      .catch((error) => setFeedback({ ok: false, text: error.message }))
      .finally(() => setLoading(false));
  }, [open, coderId]);

  const switchClass = (nextClassId: string) => {
    setClassId(nextClassId);
    const journey = journeys.find((item) => item.classId === nextClassId);
    setSelected(new Set(journey?.blocks.filter((block) => block.status === 'COMPLETED').map((block) => block.id) ?? []));
    setFeedback(null);
  };

  const toggleBlock = (blockId: string) => {
    if (alreadyCompleted.has(blockId)) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  const save = async () => {
    if (!activeJourney || newSelectionCount === 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/coders/${coderId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: activeJourney.classId, completedBlockIds: [...selected] }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Gagal menyimpan progress');
      setFeedback({ ok: true, text: payload.message });
      setJourneys((current) => current.map((journey) => journey.classId !== activeJourney.classId ? journey : ({
        ...journey,
        initialized: true,
        blocks: journey.blocks.map((block) => selected.has(block.id) ? { ...block, status: 'COMPLETED' as const } : block),
      })));
      router.refresh();
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : 'Gagal menyimpan progress' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="admin-action-menu-item" title="Migrasi progress Coder">
          <History size={16} />
          <span>Migrasi progress</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/55 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[81] flex max-h-[min(88dvh,720px)] w-[calc(100%-24px)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl focus:outline-none">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-bold text-slate-900">Migrasi progress Coder</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                Tandai block yang sudah diselesaikan {coderName} sebelum memakai LMS.
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Tutup">
              <X size={18} />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="animate-spin" size={18} /> Memuat journey...</div>
            ) : journeys.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Coder belum memiliki enrollment Weekly aktif. Progress migrasi belum dapat diatur dari halaman ini.
              </div>
            ) : (
              <>
                {journeys.length > 1 && (
                  <label className="mb-4 block text-sm font-semibold text-slate-700">
                    Kelas aktif
                    <select className="input mt-2 w-full" value={classId} onChange={(event) => switchClass(event.target.value)}>
                      {journeys.map((journey) => <option key={journey.classId} value={journey.classId}>{journey.className} · {journey.levelName}</option>)}
                    </select>
                  </label>
                )}

                {activeJourney && (
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{activeJourney.levelName}</p>
                        <p className="text-xs text-slate-500">{activeJourney.className}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{alreadyCompleted.size}/{activeJourney.blocks.length} selesai</span>
                    </div>
                    <div className="space-y-2">
                      {activeJourney.blocks.map((block) => {
                        const locked = alreadyCompleted.has(block.id);
                        const checked = selected.has(block.id);
                        return (
                          <button
                            type="button"
                            key={block.id}
                            onClick={() => toggleBlock(block.id)}
                            disabled={locked}
                            className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-blue-300'} ${locked ? 'cursor-default' : ''}`}
                          >
                            <span className={`grid size-6 shrink-0 place-items-center rounded border ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'}`}><Check size={15} strokeWidth={3} /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-slate-400">Block {block.orderIndex}</span>
                              <span className="block text-sm font-semibold text-slate-800">{block.name}</span>
                            </span>
                            {locked && <span className="text-xs font-semibold text-emerald-700">Sudah selesai</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {feedback && (
              <div className={`mt-4 flex items-start gap-2 rounded-md border p-3 text-sm ${feedback.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {feedback.ok ? <CheckCircle2 className="mt-0.5 shrink-0" size={17} /> : <AlertCircle className="mt-0.5 shrink-0" size={17} />}
                <span>{feedback.text}</span>
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <p className="max-w-xs text-xs leading-relaxed text-slate-500">Progress yang sudah selesai tidak dapat dibatalkan dari fitur migrasi. Materi seluruh block terpilih langsung terbuka untuk Coder.</p>
            <div className="ml-auto flex gap-2">
              <Dialog.Close className="btn btn-ghost">Tutup</Dialog.Close>
              <button className="btn btn-primary" disabled={saving || loading || newSelectionCount === 0} onClick={save}>
                {saving ? <><Loader2 className="animate-spin" size={16} /> Menyimpan</> : `Simpan${newSelectionCount ? ` (${newSelectionCount})` : ''}`}
              </button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
