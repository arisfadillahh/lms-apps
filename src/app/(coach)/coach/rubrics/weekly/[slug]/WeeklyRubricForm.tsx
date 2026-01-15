'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const GRADES: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];

type CompetencyMap = Record<string, { label: string; descriptions?: Record<'A' | 'B' | 'C', string> }>;

type WeeklyRubricFormProps = {
  classId: string;
  blockId: string;
  coders: { id: string; fullName: string }[];
  competencies: CompetencyMap;
  positiveCharacters: string[];
};

export default function WeeklyRubricForm({ classId, blockId, coders, competencies, positiveCharacters }: WeeklyRubricFormProps) {
  const router = useRouter();
  const [coderId, setCoderId] = useState(coders[0]?.id ?? '');
  const [grades, setGrades] = useState<Record<string, 'A' | 'B' | 'C'>>(() => {
    const initial: Record<string, 'A' | 'B' | 'C'> = {};
    Object.keys(competencies).forEach((key) => {
      initial[key] = 'B';
    });
    return initial;
  });
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleCharacter = (character: string) => {
    setSelectedCharacters((prev) => {
      if (prev.includes(character)) {
        return prev.filter((item) => item !== character);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, character];
    });
  };

  const submit = () => {
    setStatusMessage(null);
    setErrorMessage(null);

    if (!coderId) {
      setErrorMessage('Please select a coder');
      return;
    }

    if (selectedCharacters.length !== 3) {
      setErrorMessage('Please select exactly 3 positive characters');
      return;
    }

    startTransition(async () => {
      const response = await fetch('/api/coach/rubrics/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          blockId,
          coderId,
          grades,
          positiveCharacters: selectedCharacters,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Failed to submit rubric');
        return;
      }

      setStatusMessage('Rubric submitted');
      router.refresh();
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={fieldStyle}>
        <label style={labelStyle}>Coder</label>
        <select
          value={coderId}
          onChange={(event) => setCoderId(event.target.value)}
          style={inputStyle}
        >
          {coders.map((coder) => (
            <option key={coder.id} value={coder.id}>
              {coder.fullName}
            </option>
          ))}
        </select>
      </div>

      <div style={gridStyle}>
        {Object.entries(competencies).map(([key, competency]) => (
          <div key={key} style={competencyCard}>
            <p style={{ fontWeight: 600, color: '#0f172a' }}>{competency.label}</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              {GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setGrades((prev) => ({ ...prev, [key]: grade }))}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '0.5rem',
                    border: '1px solid',
                    borderColor: grades[key] === grade ? '#1e3a5f' : '#cbd5f5',
                    background: grades[key] === grade ? '#1e3a5f' : '#fff',
                    color: grades[key] === grade ? '#fff' : '#1e3a5f',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {grade}
                </button>
              ))}
            </div>
            {competency.descriptions ? (
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                {competency.descriptions[grades[key]]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Positive Characters (choose 3)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {positiveCharacters.map((character) => {
            const selected = selectedCharacters.includes(character);
            return (
              <button
                key={character}
                type="button"
                onClick={() => toggleCharacter(character)}
                style={{
                  padding: '0.35rem 0.7rem',
                  borderRadius: '999px',
                  border: '1px solid',
                  borderColor: selected ? '#16a34a' : '#cbd5f5',
                  background: selected ? '#16a34a' : '#fff',
                  color: selected ? '#fff' : '#16a34a',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                {character}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          style={{
            padding: '0.6rem 1.3rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#1e3a5f',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? 'Submitting…' : 'Submit Rubric'}
        </button>
        {statusMessage ? <span style={{ color: '#15803d', fontSize: '0.9rem' }}>{statusMessage}</span> : null}
        {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{errorMessage}</span> : null}
      </div>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.9rem',
  color: '#1f2937',
  fontWeight: 500,
};

const inputStyle: CSSProperties = {
  padding: '0.65rem 0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5f5',
  fontSize: '0.95rem',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1rem',
};

const competencyCard: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '1rem',
  background: '#ffffff',
};
