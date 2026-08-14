"use client";

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CheckSquare, List, Pencil, RotateCcw, Square, Table } from 'lucide-react';
// import * as Checkbox from '@radix-ui/react-checkbox'; // Not installed

import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';

import CreateLessonForm from './CreateLessonForm';
import LessonSpreadsheet from './LessonSpreadsheet';
import EditLessonModal from './EditLessonModal';
import DeleteLessonButton from './DeleteLessonButton';
import ImportLessonsButton from './ImportLessonsButton';
import ExportLessonsButton from './ExportLessonsButton';


type BlockLessonListProps = {
  blockId: string;
  lessons: LessonTemplateRecord[];
};

export default function BlockLessonList({ blockId, lessons }: BlockLessonListProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [restoringLessonId, setRestoringLessonId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // -- Original LessonTable Logic --
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const activeLessons = lessons.filter((lesson) => !lesson.is_archived);
  const archivedLessons = lessons
    .filter((lesson) => lesson.is_archived)
    .sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''));
  const sortedLessons = [...activeLessons].sort((a, b) => a.order_index - b.order_index);

  const toggleSelectAll = () => {
    if (selectedLessonIds.size === sortedLessons.length) {
      setSelectedLessonIds(new Set());
    } else {
      setSelectedLessonIds(new Set(sortedLessons.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedLessonIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLessonIds(next);
  };

  const editingLesson = activeLessons.find((l) => l.id === editingLessonId);
  const suggestedOrderIndex = sortedLessons.reduce((max, lesson) => Math.max(max, lesson.order_index), 0) + 1;

  const restoreLesson = async (lessonId: string) => {
    setRestoringLessonId(lessonId);
    setRestoreError(null);
    try {
      const response = await fetch(`/api/admin/curriculum/lessons/${lessonId}/restore`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Gagal memulihkan lesson');
      }
      router.refresh();
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : 'Gagal memulihkan lesson');
    } finally {
      setRestoringLessonId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', margin: 0, marginTop: '0.5rem' }}>
          Daftar Lesson
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <ExportLessonsButton blockId={blockId} />
          <ImportLessonsButton blockId={blockId} currentLessonCount={activeLessons.length} />
          {archivedLessons.length > 0 && (
            <button type="button" onClick={() => setShowArchived((value) => !value)} style={primaryLinkButtonStyle}>
              <Archive size={16} /> Arsip ({archivedLessons.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsBulkEditMode(!isBulkEditMode)}
            style={isBulkEditMode ? secondaryButtonStyle : primaryLinkButtonStyle}
          >
            {isBulkEditMode ? (
              <>
                <List size={16} /> Mode List
              </>
            ) : (
              <>
                <Table size={16} /> Mode Edit Massal (Spreadsheet)
              </>
            )}
          </button>
          <button type="button" onClick={() => setShowForm((prev) => !prev)} style={toggleButtonStyle}>
            {showForm ? '− Batal Tambah' : '+ Lesson Baru'}
          </button>
        </div>
      </div>

      {showForm ? (
        <div style={formWrapperStyle}>
          <CreateLessonForm blockId={blockId} suggestedOrderIndex={suggestedOrderIndex} />
        </div>
      ) : null}

      {isBulkEditMode ? (
        <LessonSpreadsheet
          lessons={activeLessons}
          blockId={blockId}
          onClose={() => setIsBulkEditMode(false)}
        />
      ) : (
        <>
          {/* Original Table View */}
          <div className="weekly-lesson-desktop" style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        style={checkboxButtonStyle}
                        title={selectedLessonIds.size === sortedLessons.length ? "Batalkan pilihan" : "Pilih semua"}
                      >
                        {selectedLessonIds.size === sortedLessons.length && sortedLessons.length > 0 ? (
                          <CheckSquare size={20} color="#1e3a5f" />
                        ) : (
                          <Square size={20} color="#cbd5e1" />
                        )}
                      </button>
                    </div>
                  </th>
                  <th style={{ ...thStyle, width: '50px' }}>No</th>
                  <th style={thStyle}>Judul Lesson</th>
                  <th style={thStyle}>Estimasi Sesi</th>
                  <th style={thStyle}>Slide</th>
                  <th style={thStyle}>Contoh</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: '100px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedLessons.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      Belum ada lesson.
                    </td>
                  </tr>
                ) : (
                  sortedLessons.map((lesson, lessonIndex) => {
                    const isSelected = selectedLessonIds.has(lesson.id);
                    return (
                      <tr key={lesson.id} style={trStyle}>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => toggleSelect(lesson.id)}
                              style={checkboxButtonStyle}
                            >
                              {isSelected ? (
                                <CheckSquare size={20} color="#1e3a5f" />
                              ) : (
                                <Square size={20} color="#cbd5e1" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td style={tdStyle}>{lessonIndex + 1}</td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{lesson.title}</div>
                          {lesson.summary && (
                            <div
                              style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}
                            >
                              {lesson.summary.length > 60
                                ? lesson.summary.substring(0, 60) + '...'
                                : lesson.summary}
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {lesson.estimated_meeting_count ? `${lesson.estimated_meeting_count} sesi` : '-'}
                        </td>
                        <td style={tdStyle}>
                          {lesson.slide_url ? (
                            <a
                              href={lesson.slide_url}
                              target="_blank"
                              rel="noreferrer"
                              style={linkStyle}
                            >
                              Link Slide
                            </a>
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>-</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {lesson.example_url ? (
                            <a
                              href={lesson.example_url}
                              target="_blank"
                              rel="noreferrer"
                              style={linkStyle}
                            >
                              Link Contoh
                            </a>
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>-</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                            <button
                              onClick={() => setEditingLessonId(lesson.id)}
                              style={iconButtonStyle}
                              title="Edit Lesson"
                            >
                              <Pencil size={16} />
                            </button>
                            <DeleteLessonButton lessonId={lesson.id} lessonTitle={lesson.title} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="weekly-lesson-mobile-list">
            {sortedLessons.length === 0 ? (
              <div className="weekly-lesson-mobile-empty">Belum ada lesson.</div>
            ) : (
              sortedLessons.map((lesson, lessonIndex) => {
                const isSelected = selectedLessonIds.has(lesson.id);

                return (
                  <article
                    key={lesson.id}
                    className={`weekly-lesson-mobile-card${isSelected ? ' is-selected' : ''}`}
                  >
                    <div className="weekly-lesson-mobile-head">
                      <button
                        type="button"
                        onClick={() => toggleSelect(lesson.id)}
                        className="weekly-lesson-mobile-select"
                        aria-label={`${isSelected ? 'Batalkan pilihan' : 'Pilih'} ${lesson.title}`}
                      >
                        {isSelected ? <CheckSquare size={21} /> : <Square size={21} />}
                      </button>
                      <span className="weekly-lesson-mobile-number">Lesson {lessonIndex + 1}</span>
                      <span className="weekly-lesson-mobile-session">
                        {lesson.estimated_meeting_count ? `${lesson.estimated_meeting_count} sesi` : 'Belum diatur'}
                      </span>
                    </div>

                    <div className="weekly-lesson-mobile-content">
                      <h4>{lesson.title}</h4>
                      {lesson.summary ? <p>{lesson.summary}</p> : <p className="is-empty">Belum ada ringkasan.</p>}
                    </div>

                    <div className="weekly-lesson-mobile-links">
                      {lesson.slide_url ? (
                        <a href={lesson.slide_url} target="_blank" rel="noreferrer">Buka slide</a>
                      ) : (
                        <span>Slide belum ada</span>
                      )}
                      {lesson.example_url ? (
                        <a href={lesson.example_url} target="_blank" rel="noreferrer">Buka contoh project</a>
                      ) : (
                        <span>Contoh project belum ada</span>
                      )}
                    </div>

                    <div className="weekly-lesson-mobile-actions">
                      <button
                        type="button"
                        onClick={() => setEditingLessonId(lesson.id)}
                        className="weekly-lesson-mobile-edit"
                        aria-label={`Edit lesson ${lesson.title}`}
                      >
                        <Pencil size={17} />
                        <span>Edit</span>
                      </button>
                      <DeleteLessonButton lessonId={lesson.id} lessonTitle={lesson.title} />
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {showArchived && archivedLessons.length > 0 && (
            <section style={archiveSectionStyle} aria-label="Lesson yang diarsipkan">
              <div style={archiveHeaderStyle}>
                <div>
                  <h4 style={{ margin: 0, color: '#78350f', fontSize: '0.95rem' }}>Lesson Diarsipkan</h4>
                  <p style={{ margin: '0.25rem 0 0', color: '#92400e', fontSize: '0.8rem' }}>
                    Tidak dipakai untuk jadwal baru, tetapi histori pembelajaran tetap tersimpan.
                  </p>
                </div>
              </div>
              {restoreError && <div style={errorBannerStyle}>{restoreError}</div>}
              <div style={archiveListStyle}>
                {archivedLessons.map((lesson) => (
                  <div key={lesson.id} style={archiveRowStyle}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, color: '#334155', fontWeight: 600 }}>{lesson.title}</p>
                      <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                        Diarsipkan {lesson.archived_at ? new Date(lesson.archived_at).toLocaleString('id-ID') : '-'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreLesson(lesson.id)}
                      disabled={restoringLessonId === lesson.id}
                      style={restoreButtonStyle}
                    >
                      <RotateCcw size={15} />
                      {restoringLessonId === lesson.id ? 'Memulihkan...' : 'Pulihkan'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick Actions for Selection (Optional - keeping from original if needed) */}
          {selectedLessonIds.size > 0 && (
            <div style={bulkActionsStyle}>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                {selectedLessonIds.size} lesson dipilih
              </span>
              <button style={bulkDeleteButtonStyle} onClick={() => alert('Fitur hapus massal via list belum diaktifkan ulang. Gunakan spreadsheet untuk lebih mudah.')}>
                Hapus Terpilih
              </button>
            </div>
          )}
        </>
      )}

      {editingLesson && (
        <EditLessonModal
          lesson={editingLesson}
          open={!!editingLessonId}
          onOpenChange={(open) => !open && setEditingLessonId(null)}
        />
      )}

    </div>
  );
}

// -- Styles from original LessonTable --

const tableContainerStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  overflow: 'hidden',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#ffffff',
  fontSize: '0.9rem',
};

const thStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  background: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
  color: '#475569',
  fontWeight: 600,
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const trStyle: CSSProperties = {
  borderBottom: '1px solid #f1f5f9',
};

const tdStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  verticalAlign: 'middle',
  color: '#334155',
};

const linkStyle: CSSProperties = {
  color: '#3b82f6',
  textDecoration: 'none',
  fontWeight: 500,
};

const iconButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.4rem',
  borderRadius: '0.375rem',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  color: '#64748b',
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const checkboxButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const bulkActionsStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  background: '#f1f5f9',
  borderRadius: '0.5rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '-0.5rem', // Connect visually to table
};

const bulkDeleteButtonStyle: CSSProperties = {
  padding: '0.4rem 0.8rem',
  borderRadius: '0.375rem',
  background: '#fee2e2',
  color: '#dc2626',
  border: '1px solid #fecaca',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
};

// -- Existing styles --

const toggleButtonStyle: CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  background: '#1e3a5f',
  color: '#ffffff',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  fontSize: '0.9rem',
};

const primaryLinkButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  background: '#fff',
  color: '#1e3a5f',
  border: '1px solid #e2e8f0',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '0.9rem',
};

const secondaryButtonStyle: CSSProperties = {
  ...primaryLinkButtonStyle,
  background: '#f1f5f9',
  color: '#64748b',
};

const formWrapperStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '1rem',
  background: '#f8fafc',
  marginBottom: '1rem',
};

const archiveSectionStyle: CSSProperties = {
  border: '1px solid #fde68a',
  borderRadius: '0.5rem',
  background: '#fffbeb',
  overflow: 'hidden',
};

const archiveHeaderStyle: CSSProperties = {
  padding: '0.9rem 1rem',
  borderBottom: '1px solid #fde68a',
};

const archiveListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const archiveRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '0.8rem 1rem',
  borderBottom: '1px solid #fef3c7',
  background: '#ffffff',
};

const restoreButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.4rem',
  border: '1px solid #dbe7ef',
  background: '#ffffff',
  color: '#1e3a5f',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
};

const errorBannerStyle: CSSProperties = {
  margin: '0.75rem 1rem',
  padding: '0.65rem 0.8rem',
  borderRadius: '0.4rem',
  background: '#fef2f2',
  color: '#b91c1c',
  fontSize: '0.82rem',
};
