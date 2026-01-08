'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type EkskulRubricLauncherProps = {
  classId: string;
  defaultSemesterTag: string;
};

export default function EkskulRubricLauncher({ classId, defaultSemesterTag }: EkskulRubricLauncherProps) {
  const router = useRouter();
  const [semesterTag, setSemesterTag] = useState(defaultSemesterTag);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    if (!semesterTag.trim()) {
      setError('Isi tag semester terlebih dahulu');
      return;
    }
    setError(null);
    const slug = `${encodeURIComponent(classId)}__${encodeURIComponent(semesterTag.trim())}`;
    router.push(`/coach/rubrics/ekskul/${slug}`);
  };

  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <input
        value={semesterTag}
        onChange={(event) => setSemesterTag(event.target.value)}
        placeholder="Contoh: 2024-S1"
        style={{
          padding: '0.6rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #cbd5f5',
          fontSize: '0.95rem',
          minWidth: '180px',
        }}
      />
      <button
        type="button"
        onClick={handleOpen}
        style={{
          padding: '0.55rem 1.1rem',
          borderRadius: '0.5rem',
          border: 'none',
          background: '#16a34a',
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Buka form rubrik
      </button>
      {error ? <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{error}</span> : null}
    </div>
  );
}
