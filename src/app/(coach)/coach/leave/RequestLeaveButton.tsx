'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type RequestLeaveButtonProps = {
  sessionId: string;
  className?: string; // Add className prop for flexibility
  disabled?: boolean;
};

export default function RequestLeaveButton({ sessionId, disabled }: RequestLeaveButtonProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/coach/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, note }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setError(payload.error ?? 'Gagal mengirim pengajuan');
          return;
        }

        setOpen(false);
        setNote('');
        router.refresh();
      } catch (err) {
        console.error('Leave request failed', err);
        setError('Terjadi kesalahan sistem');
      }
    });
  };

  if (disabled) {
    return (
      <Button variant="secondary" size="sm" disabled className="w-full sm:w-auto opacity-50 cursor-not-allowed">
        Sudah Diajukan
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:w-auto border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 focus:ring-orange-500">
          Ajukan Izin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ajukan Izin Berhalangan</DialogTitle>
          <DialogDescription>
            Admin akan mencarikan coach pengganti untuk sesi ini. Mohon berikan alasan yang jelas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="note">Alasan / Catatan</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Sakit, Urusan Keluarga Mendadak, dll."
              className="resize-none"
              rows={3}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Mengirim...' : 'Kirim Pengajuan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
