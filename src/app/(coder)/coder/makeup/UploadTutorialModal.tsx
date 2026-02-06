'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { FolderPlus, Upload, Share2, Link2, X, HelpCircle } from 'lucide-react';

export default function UploadTutorialModal() {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setShowModal(true)}
                style={tutorialButtonStyle}
            >
                <HelpCircle size={18} />
                Tutorial Upload
            </button>

            {showModal && (
                <div style={modalOverlayStyle} onClick={() => setShowModal(false)}>
                    <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={modalTitleStyle}>Cara Upload Karya ke Google Drive</h3>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                style={closeButtonStyle}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={modalBodyStyle}>
                            <div style={stepCardStyle}>
                                <div style={stepNumberStyle}>1</div>
                                <div style={stepIconWrapperStyle}>
                                    <FolderPlus size={24} color="#3b82f6" />
                                </div>
                                <div>
                                    <div style={stepTitleStyle}>Buat Folder di Google Drive</div>
                                    <div style={stepDescStyle}>
                                        Buka Google Drive → Klik tombol <strong>"+ Baru"</strong> atau <strong>"New"</strong> →
                                        Pilih <strong>"Folder Baru"</strong> atau <strong>"New Folder"</strong> →
                                        Beri nama folder sesuai tugas (misal: "Makeup Game Tembak Alien")
                                    </div>
                                </div>
                            </div>

                            <div style={stepCardStyle}>
                                <div style={stepNumberStyle}>2</div>
                                <div style={stepIconWrapperStyle}>
                                    <Upload size={24} color="#3b82f6" />
                                </div>
                                <div>
                                    <div style={stepTitleStyle}>Upload File Karya ke Folder</div>
                                    <div style={stepDescStyle}>
                                        Buka folder yang sudah dibuat → Klik <strong>"Upload File"</strong> →
                                        Pilih semua file karya kamu (game, screenshot, video, dll) →
                                        Tunggu sampai upload selesai
                                    </div>
                                </div>
                            </div>

                            <div style={stepCardStyle}>
                                <div style={stepNumberStyle}>3</div>
                                <div style={stepIconWrapperStyle}>
                                    <Share2 size={24} color="#3b82f6" />
                                </div>
                                <div>
                                    <div style={stepTitleStyle}>Atur Izin Akses Folder (PENTING!)</div>
                                    <div style={stepDescStyle}>
                                        Klik kanan pada <strong>folder</strong> (bukan file) → Pilih <strong>"Bagikan"</strong> atau <strong>"Share"</strong> →
                                        Di bagian <strong>"General Access"</strong>, klik dropdown dan ubah dari "Restricted" menjadi <strong>"Anyone with the link"</strong> →
                                        Pastikan role-nya <strong>"Viewer"</strong> → Klik <strong>"Done"</strong>
                                    </div>
                                </div>
                            </div>

                            <div style={stepCardStyle}>
                                <div style={stepNumberStyle}>4</div>
                                <div style={stepIconWrapperStyle}>
                                    <Link2 size={24} color="#3b82f6" />
                                </div>
                                <div>
                                    <div style={stepTitleStyle}>Copy Link Folder dan Submit</div>
                                    <div style={stepDescStyle}>
                                        Setelah klik "Done", akan muncul tombol <strong>"Copy link"</strong> →
                                        Klik tombol tersebut untuk copy link folder →
                                        Paste link di kotak <strong>"Link Google Drive"</strong> pada form tugas →
                                        Klik <strong>"Kirim Karya"</strong>
                                    </div>
                                </div>
                            </div>

                            <div style={importantBoxStyle}>
                                <strong>📌 Yang Harus Diingat:</strong>
                                <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem' }}>
                                    <li>Upload ke <strong>FOLDER</strong>, bukan file satuan</li>
                                    <li>Share <strong>FOLDER-nya</strong>, bukan file satu-satu</li>
                                    <li>Pastikan izin akses sudah <strong>"Anyone with the link"</strong></li>
                                    <li>Submit <strong>link folder</strong>, bukan link file</li>
                                </ul>
                            </div>

                            <div style={warningBoxStyle}>
                                <strong>⚠️ Perhatian:</strong> Jika izin akses tidak diatur dengan benar, coach tidak akan bisa melihat karya kamu dan tugas akan dianggap belum dikumpulkan!
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Styles
const tutorialButtonStyle: CSSProperties = {
    background: '#3b82f6',
    border: 'none',
    padding: '0.65rem 1.25rem',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
    transition: 'background 0.2s',
};

const modalOverlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    zIndex: 9999,
};

const modalContentStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '16px',
    width: 'min(700px, 90vw)',
    maxHeight: '85vh',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
};

const modalHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #e2e8f0',
};

const modalTitleStyle: CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
};

const closeButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
};

const modalBodyStyle: CSSProperties = {
    padding: '1.5rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
};

const stepCardStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'auto auto 1fr',
    gap: '1rem',
    alignItems: 'start',
    padding: '1.25rem',
    background: '#f8fafc',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
};

const stepNumberStyle: CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#3b82f6',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.95rem',
    flexShrink: 0,
};

const stepIconWrapperStyle: CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: '#eff6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
};

const stepTitleStyle: CSSProperties = {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '0.5rem',
};

const stepDescStyle: CSSProperties = {
    fontSize: '0.85rem',
    color: '#475569',
    lineHeight: 1.6,
};

const importantBoxStyle: CSSProperties = {
    padding: '1rem 1.25rem',
    background: '#eff6ff',
    border: '2px solid #3b82f6',
    borderRadius: '8px',
    color: '#1e40af',
    fontSize: '0.85rem',
    lineHeight: 1.6,
};

const warningBoxStyle: CSSProperties = {
    padding: '1rem 1.25rem',
    background: '#fffbeb',
    border: '2px solid #fef3c7',
    borderRadius: '8px',
    color: '#92400e',
    fontSize: '0.85rem',
    lineHeight: 1.5,
};
