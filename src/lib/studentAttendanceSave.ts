export interface StudentAttendanceSaveRow { coderId: string; fullName: string; status: string; reason: string }

/** Preserve successful student rows so a retry does not recreate make-up notifications. */
export async function saveStudentAttendanceRows(
  sessionId: string,
  rows: StudentAttendanceSaveRow[],
  onSaved: (coderId: string) => void,
  send: typeof fetch = fetch,
): Promise<void> {
  let firstError: string | null = null;
  for (const row of rows) {
    try {
      const response = await send('/api/coach/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, coderId: row.coderId, status: row.status, reason: row.reason.trim() }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : `Gagal menyimpan presensi ${row.fullName}`);
      }
      onSaved(row.coderId);
    } catch (error) {
      firstError ??= error instanceof Error ? error.message : `Gagal menyimpan presensi ${row.fullName}`;
    }
  }
  if (firstError) throw new Error(`${firstError} Presensi yang sudah tersimpan tetap aman. Simpan lagi untuk mencoba baris yang belum tersimpan.`);
}
