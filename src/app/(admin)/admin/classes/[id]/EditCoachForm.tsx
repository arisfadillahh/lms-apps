'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateClass } from '@/lib/dao/classesDao';

type Coach = {
  id: string;
  full_name: string | null;
};

type Props = {
  classId: string;
  currentCoachId: string;
  coaches: Coach[];
};

export default function EditCoachForm({ classId, currentCoachId, coaches }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState(currentCoachId);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    if (selectedCoachId === currentCoachId) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await updateClass(classId, { coachId: selectedCoachId });
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error('Failed to update coach:', error);
      alert('Gagal mengupdate coach. Coba lagi ya Bos.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        style={{
          background: 'none',
          border: 'none',
          color: '#3b82f6',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
          padding: '0 0.5rem',
          textDecoration: 'underline'
        }}
      >
        [Ubah Coach]
      </button>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
      <select
        value={selectedCoachId}
        onChange={(e) => setSelectedCoachId(e.target.value)}
        disabled={isLoading}
        style={{
          padding: '0.2rem 0.4rem',
          borderRadius: '4px',
          border: '1px solid #cbd5e1',
          fontSize: '0.85rem'
        }}
      >
        {coaches.map((coach) => (
          <option key={coach.id} value={coach.id}>
            {coach.full_name || 'Tanpa Nama'}
          </option>
        ))}
      </select>
      <button
        onClick={handleSave}
        disabled={isLoading}
        style={{
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '0.2rem 0.6rem',
          fontSize: '0.8rem',
          cursor: 'pointer'
        }}
      >
        {isLoading ? '...' : 'Simpan'}
      </button>
      <button
        onClick={() => setIsEditing(false)}
        disabled={isLoading}
        style={{
          background: '#64748b',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '0.2rem 0.6rem',
          fontSize: '0.8rem',
          cursor: 'pointer'
        }}
      >
        Batal
      </button>
    </div>
  );
}
