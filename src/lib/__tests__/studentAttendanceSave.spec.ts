import { describe, expect, it, vi } from 'vitest';
import { saveStudentAttendanceRows } from '@/lib/studentAttendanceSave';

const rows = [
  { coderId: 'one', fullName: 'Coder One', status: 'PRESENT', reason: '' },
  { coderId: 'two', fullName: 'Coder Two', status: 'ABSENT', reason: ' Sakit ' },
  { coderId: 'three', fullName: 'Coder Three', status: 'ABSENT', reason: 'Izin' },
];
describe('attendance save recovery', () => {
  it('marks successful rows individually and sends absence reasons without changing session status', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    const saved = vi.fn(); await saveStudentAttendanceRows('meeting', rows, saved, send);
    expect(saved.mock.calls.map(call => call[0])).toEqual(['one', 'two', 'three']);
    expect(send.mock.calls.every(([url]) => url === '/api/coach/attendance')).toBe(true);
    expect(JSON.parse(String(send.mock.calls[1][1]?.body))).toMatchObject({ coderId: 'two', status: 'ABSENT', reason: 'Sakit' });
  });
  it('keeps successful rows saved, attempts the remaining rows, and rejects so the caller cannot auto-complete', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response('{"error":"Connection failed"}', { status: 500 })).mockResolvedValueOnce(new Response('{}'));
    const saved = new Set<string>();
    await expect(saveStudentAttendanceRows('meeting', rows, id => saved.add(id), send)).rejects.toThrow(/Connection failed.*sudah tersimpan tetap aman/);
    expect(send).toHaveBeenCalledTimes(3); expect([...saved]).toEqual(['one', 'three']);
    const retry = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    await saveStudentAttendanceRows('meeting', rows.filter(row => !saved.has(row.coderId)), id => saved.add(id), retry);
    expect(retry).toHaveBeenCalledTimes(1); expect(JSON.parse(String(retry.mock.calls[0][1]?.body)).coderId).toBe('two');
  });
  it('preserves unsaved rows after network errors and reports readable errors for non-JSON failures', async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }));
    const saved = vi.fn();
    await expect(saveStudentAttendanceRows('meeting', rows.slice(0, 2), saved, send)).rejects.toThrow(/Network unavailable/);
    expect(saved).not.toHaveBeenCalled(); expect(send).toHaveBeenCalledTimes(2);
  });
});
