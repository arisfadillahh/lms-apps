"use client";

export default function LessonAutoAssignNotice() {
  return (
    <div
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: '0.75rem',
        padding: '0.85rem 1rem',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
      }}
    >
      <strong style={{ color: '#0f172a' }}>Jadwal sinkron otomatis</strong>
      <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>
        Setelah block, lesson, atau sesi berubah, sistem langsung memasangkan lesson ke sesi mendatang mengikuti urutan kurikulum tanpa perlu
        klik tombol tambahan. Pakai form lompat lesson di bawah kalau ingin melakukan pengecualian.
      </p>
    </div>
  );
}
