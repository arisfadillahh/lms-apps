import type { CSSProperties } from 'react';

export default function CoachLoading() {
    return (
        <div style={containerStyle}>
            <div style={skeletonHeaderStyle} />
            <div style={skeletonCardStyle} />
            <div style={skeletonCardShortStyle} />
            <div style={skeletonCardStyle} />
        </div>
    );
}

const containerStyle: CSSProperties = {
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: '1.5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
};

const base: CSSProperties = {
    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
    backgroundSize: '400% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: '12px',
};

const skeletonHeaderStyle: CSSProperties = { ...base, height: '80px', width: '60%' };
const skeletonCardStyle: CSSProperties = { ...base, height: '140px' };
const skeletonCardShortStyle: CSSProperties = { ...base, height: '80px' };
