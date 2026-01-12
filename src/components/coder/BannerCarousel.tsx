'use client';

import { useEffect, useState, useCallback } from 'react';

type Banner = {
    id: string;
    imagePath: string;
    linkUrl: string;
    title: string;
    order: number;
    isActive: boolean;
};

type BannerCarouselProps = {
    banners: Banner[];
};

export default function BannerCarousel({ banners }: BannerCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const activeBanners = banners.filter(b => b.isActive).sort((a, b) => a.order - b.order);

    const nextSlide = useCallback(() => {
        if (activeBanners.length === 0) return;
        setCurrentIndex(prev => (prev + 1) % activeBanners.length);
    }, [activeBanners.length]);

    const prevSlide = useCallback(() => {
        if (activeBanners.length === 0) return;
        setCurrentIndex(prev => (prev - 1 + activeBanners.length) % activeBanners.length);
    }, [activeBanners.length]);

    // Auto-scroll every 5 seconds
    useEffect(() => {
        if (isPaused || activeBanners.length <= 1) return;
        const interval = setInterval(nextSlide, 5000);
        return () => clearInterval(interval);
    }, [isPaused, nextSlide, activeBanners.length]);

    if (activeBanners.length === 0) return null;

    return (
        <div
            style={containerStyle}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <div style={carouselWrapperStyle}>
                {activeBanners.map((banner, index) => (
                    <a
                        key={banner.id}
                        href={banner.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            ...slideStyle,
                            opacity: index === currentIndex ? 1 : 0,
                            zIndex: index === currentIndex ? 1 : 0,
                        }}
                        aria-hidden={index !== currentIndex}
                    >
                        <img
                            src={banner.imagePath}
                            alt={banner.title}
                            style={imageStyle}
                        />
                    </a>
                ))}
            </div>

            {/* Navigation Arrows */}
            {activeBanners.length > 1 && (
                <>
                    <button onClick={prevSlide} style={{ ...arrowStyle, left: '1rem' }} aria-label="Previous">
                        ‹
                    </button>
                    <button onClick={nextSlide} style={{ ...arrowStyle, right: '1rem' }} aria-label="Next">
                        ›
                    </button>
                </>
            )}

            {/* Indicator Dots */}
            {activeBanners.length > 1 && (
                <div style={dotsContainerStyle}>
                    {activeBanners.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            style={{
                                ...dotStyle,
                                background: index === currentIndex ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                                transform: index === currentIndex ? 'scale(1.2)' : 'scale(1)',
                            }}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: '1280 / 320',
    borderRadius: '1rem',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
};

const carouselWrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
};

const slideStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    transition: 'opacity 500ms ease-in-out',
    display: 'block',
};

const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
};

const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(0, 0, 0, 0.4)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    fontSize: '1.5rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 200ms ease',
    zIndex: 2,
};

const dotsContainerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '1rem',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '0.5rem',
    zIndex: 2,
};

const dotStyle: React.CSSProperties = {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 200ms ease, transform 200ms ease',
};
