'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Session = {
    id: string;
    date_time: string;
    class_name?: string | null;
};

type CreateLeaveRequestDialogProps = {
    availableSessions: Session[];
};

export default function CreateLeaveRequestDialog({ availableSessions }: CreateLeaveRequestDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState<string>('');
    const [note, setNote] = useState('');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSessionId) {
            setError('Silakan pilih jadwal terlebih dahulu.');
            return;
        }
        setError(null);

        startTransition(async () => {
            try {
                const response = await fetch('/api/coach/leave', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: selectedSessionId, note }),
                });

                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    setError(payload.error ?? 'Gagal mengirim pengajuan');
                    return;
                }

                setOpen(false);
                setSelectedSessionId('');
                setNote('');
                router.refresh();
            } catch (err) {
                console.error('Leave request failed', err);
                setError('Terjadi kesalahan sistem');
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md w-full sm:w-auto">
                    <Plus className="w-5 h-5 mr-2" />
                    Ajukan Izin Baru
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Ajukan Izin Ketidakhadiran</DialogTitle>
                    <DialogDescription>
                        Pilih sesi kelas yang ingin Anda ajukan izinnya. Admin akan mencarikan pengganti.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="session">Pilih Jadwal Sesi</Label>
                        <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                            <SelectTrigger id="session" className="w-full">
                                <SelectValue placeholder="Pilih jadwal..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableSessions.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-slate-500">
                                        Tidak ada jadwal tersedia untuk diajukan.
                                    </div>
                                ) : (
                                    availableSessions.map((session) => (
                                        <SelectItem key={session.id} value={session.id}>
                                            <span className="font-medium">
                                                {format(new Date(session.date_time), 'EEE, d MMM HH:mm', { locale: id })}
                                            </span>
                                            <span className="text-slate-400 mx-2">—</span>
                                            <span className="text-slate-600 truncate max-w-[200px] inline-block align-bottom">
                                                {session.class_name || 'Unnamed Class'}
                                            </span>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="note">Alasan / Catatan</Label>
                        <Textarea
                            id="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Contoh: Sakit, Urusan Keluarga Mendadak, dll."
                            className="resize-none"
                            rows={4}
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-100">
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={isPending || !selectedSessionId}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isPending ? 'Mengirim...' : 'Kirim Pengajuan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
