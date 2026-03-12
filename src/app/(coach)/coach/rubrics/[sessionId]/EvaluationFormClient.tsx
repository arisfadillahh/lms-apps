'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { CheckCircle2, ChevronRight, User } from 'lucide-react';

import type { EvaluationCriteriaRecord } from '@/lib/dao/reportsDao';

type EvaluationFormClientProps = {
  sessionId: string;
  students: { id: string; full_name: string }[];
  criteriaList: EvaluationCriteriaRecord[];
};

export default function EvaluationFormClient({ sessionId, students, criteriaList }: EvaluationFormClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // state: coderId -> criteriaId -> score (number or empty string)
  const [scores, setScores] = useState<Record<string, Record<string, string>>>(() => {
    const initial: Record<string, Record<string, string>> = {};
    students.forEach(s => {
      initial[s.id] = {};
      criteriaList.forEach(c => {
        initial[s.id][c.id] = ''; // Start empty
      });
    });
    return initial;
  });

  const [errorMessage, setErrorMessage] = useState('');

  const handleScoreChange = (coderId: string, criteriaId: string, val: string) => {
    // Only allow empty string or numbers 1-10
    if (val !== '') {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 1 || num > 10) return;
    }
    
    setScores(prev => ({
      ...prev,
      [coderId]: {
        ...prev[coderId],
        [criteriaId]: val
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Validate all fields are filled
    const missingFields = students.some(s => 
      criteriaList.some(c => scores[s.id][c.id] === '')
    );

    if (missingFields) {
      setErrorMessage('Mohon isi semua nilai (1-10) untuk seluruh Coder sebelum menyimpan.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/coach/evaluations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            scores
          })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Terjadi kesalahan saat menyimpan nilai.');
        }

        router.push('/coach/rubrics');
        router.refresh();
      } catch (err: any) {
        setErrorMessage(err.message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {errorMessage && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 500 }}>
          {errorMessage}
        </div>
      )}

      {students.map((student) => (
        <div key={student.id} style={studentCardStyle}>
          <div style={studentHeaderStyle}>
            <div style={avatarStyle}>
              <User size={20} color="#1e3a5f" />
            </div>
            <h3 style={studentNameStyle}>{student.full_name}</h3>
          </div>
          
          <div style={criteriaGridStyle}>
            {criteriaList.map(criteria => (
              <div key={criteria.id} style={criteriaInputGroup}>
                <div style={{ flex: 1 }}>
                  <label style={criteriaLabelStyle}>{criteria.name}</label>
                  <p style={criteriaDescStyle}>{criteria.description}</p>
                </div>
                <input 
                  type="number"
                  min="1"
                  max="10"
                  required
                  placeholder="-"
                  value={scores[student.id][criteria.id]}
                  onChange={(e) => handleScoreChange(student.id, criteria.id, e.target.value)}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={actionFooterStyle}>
        <button 
          type="button" 
          onClick={() => router.push('/coach/rubrics')}
          style={cancelButtonStyle}
          disabled={isPending}
        >
          Batal
        </button>
        <button 
          type="submit"
          style={submitButtonStyle}
          disabled={isPending}
        >
          {isPending ? 'Menyimpan...' : (
            <>Simpan Nilai <ChevronRight size={18} /></>
          )}
        </button>
      </div>
    </form>
  );
}

const studentCardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '1rem',
  border: '1px solid #e2e8f0',
  boxShadow: 'var(--shadow-small)',
  overflow: 'hidden',
};

const studentHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1.25rem 1.5rem',
  background: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
};

const avatarStyle: CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  background: '#e0f2fe',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const studentNameStyle: CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 700,
  color: '#0f172a',
  margin: 0,
};

const criteriaGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: '0',
};

const criteriaInputGroup: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid #f1f5f9',
  gap: '2rem',
};

const criteriaLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '1.05rem',
  fontWeight: 600,
  color: '#1e293b',
  marginBottom: '0.25rem',
};

const criteriaDescStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#64748b',
  margin: 0,
  lineHeight: 1.5,
};

const inputStyle: CSSProperties = {
  width: '80px',
  height: '48px',
  fontSize: '1.25rem',
  fontWeight: 700,
  textAlign: 'center',
  borderRadius: '0.75rem',
  border: '2px solid #cbd5e1',
  color: '#0f172a',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const actionFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: '1rem',
  marginTop: '1rem',
};

const cancelButtonStyle: CSSProperties = {
  padding: '0.85rem 1.5rem',
  borderRadius: '0.5rem',
  background: '#f1f5f9',
  color: '#475569',
  border: 'none',
  fontWeight: 600,
  fontSize: '0.95rem',
  cursor: 'pointer',
};

const submitButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.85rem 1.75rem',
  borderRadius: '0.5rem',
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  fontWeight: 600,
  fontSize: '0.95rem',
  cursor: 'pointer',
  boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)',
};
