import type { CSSProperties } from 'react';

export default function CoachLoading() {
    return (
        <div style={containerStyle}>
            <div style={{ ...baseStyle, height: '60px', width: '45%', marginBottom: '0.5rem' }} />
            <div style={{ ...baseStyle, height: '140px' }} />
            <div style={{ ...baseStyle, height: '80px' }} />
            <div style={{ ...baseStyle, height: '160px' }} />
        </div>
    );
}

const containerStyle: CSSProperties = {
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: '1.5rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
};

const baseStyle: CSSProperties = {
    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
    backgroundSize: '400% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: '12px',
};
