'use client';

import { useState } from 'react';
import JourneyMap, { JourneyCourse } from './JourneyMap';
import { motion, AnimatePresence } from 'framer-motion';

export default function JourneyModal({ courses }: { courses: JourneyCourse[] }) {
    const [isOpen, setIsOpen] = useState(false);

    if (courses.length === 0) return null;

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    background: 'linear-gradient(to right, #1e3a5f, #3b82f6)',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: 'white',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)',
                    transition: 'all 0.2s',
                    letterSpacing: '0.01em'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
                Learning Journey
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
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
                            backdropFilter: 'blur(4px)'
                        }}
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ duration: 0.2, type: 'spring', damping: 25, stiffness: 300 }}
                            style={{
                                background: 'white',
                                borderRadius: '16px',
                                width: '100%',
                                maxWidth: '1000px',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                position: 'relative',
                                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Learning Journey</h2>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        style={{
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
                                            color: '#64748b'
                                        }}
                                    >
                                        &times;
                                    </button>
                                </div>
                                <JourneyMap courses={courses} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
