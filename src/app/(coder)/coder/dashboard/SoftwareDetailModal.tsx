'use client';

import { useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Software = {
    id: string;
    name: string;
    version: string | null;
    description: string | null;
    installation_url: string | null;
    installation_instructions: string | null;
    minimum_specs: Record<string, string> | null;
    access_info: string | null;
};

export default function SoftwareDetailModal({ software }: { software: Software }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#fff';
                }}
            >
                Cara Install
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={overlayStyle}
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ duration: 0.2, type: 'spring', damping: 25, stiffness: 300 }}
                            style={modalStyle}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div style={headerStyle}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                                        {software.name}
                                    </h2>
                                    {software.version && (
                                        <span style={{ fontSize: '0.85rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', marginTop: '0.5rem', display: 'inline-block' }}>
                                            v{software.version}
                                        </span>
                                    )}
                                </div>
                                <button onClick={() => setIsOpen(false)} style={closeButtonStyle}>&times;</button>
                            </div>

                            <div style={contentStyle}>
                                {/* Description */}
                                {software.description && (
                                    <p style={{ fontSize: '0.95rem', color: '#334155', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                                        {software.description}
                                    </p>
                                )}

                                {/* Action Button (Download) */}
                                {software.installation_url && (
                                    <div style={{ marginBottom: '2rem' }}>
                                        <a
                                            href={software.installation_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={downloadButtonStyle}
                                        >
                                            Download Software ⬇️
                                        </a>
                                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', fontStyle: 'italic' }}>
                                            *Link akan terbuka di tab baru
                                        </p>
                                    </div>
                                )}

                                {/* Instructions & Specs Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>

                                    {/* Installation Instructions */}
                                    {software.installation_instructions && (
                                        <div style={infoBoxStyle}>
                                            <h3 style={sectionTitleStyle}>📝 Cara Install</h3>
                                            <div style={{ fontSize: '0.9rem', color: '#334155', whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                                                {software.installation_instructions}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {/* Min Specs */}
                                        {software.minimum_specs && Object.keys(software.minimum_specs).length > 0 && (
                                            <div style={{ ...infoBoxStyle, background: '#fffbeb', borderColor: '#fcd34d' }}>
                                                <h3 style={{ ...sectionTitleStyle, color: '#92400e' }}>💻 Spesifikasi Minimum</h3>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                                                    {Object.entries(software.minimum_specs).map(([key, value]) => value && (
                                                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #fde68a', paddingBottom: '0.25rem' }}>
                                                            <span style={{ color: '#b45309', textTransform: 'capitalize', fontWeight: 600 }}>{key}</span>
                                                            <span style={{ color: '#78350f' }}>{value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Access Info */}
                                        {software.access_info && (
                                            <div style={{ ...infoBoxStyle, background: '#ecfdf5', borderColor: '#6ee7b7' }}>
                                                <h3 style={{ ...sectionTitleStyle, color: '#065f46' }}>🔑 Info Akses</h3>
                                                <p style={{ fontSize: '0.9rem', color: '#047857', lineHeight: '1.5', margin: 0 }}>
                                                    {software.access_info}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem',
    backdropFilter: 'blur(4px)',
};

const modalStyle: CSSProperties = {
    background: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
    position: 'relative',
};

const headerStyle: CSSProperties = {
    position: 'sticky',
    top: 0,
    background: 'white',
    padding: '1.5rem 2rem',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    zIndex: 10,
};

const contentStyle: CSSProperties = {
    padding: '2rem',
};

const closeButtonStyle: CSSProperties = {
    background: '#f1f5f9',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '1.2rem',
    color: '#64748b',
};

const downloadButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1e3a5f',
    color: 'white',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    textDecoration: 'none',
    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
    transition: 'transform 0.2s',
};

const infoBoxStyle: CSSProperties = {
    background: '#f8fafc',
    padding: '1.5rem',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
};

const sectionTitleStyle: CSSProperties = {
    fontSize: '0.9rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: '1rem',
    letterSpacing: '0.05em',
};
