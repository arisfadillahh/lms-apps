'use client';

import { useEffect } from 'react';

/**
 * MobileScrollFix - Fixes duplicate scrollbar issue on mobile
 * 
 * This component ensures only the body scrolls on mobile by:
 * 1. Setting main content to overflow: hidden (no scrollbar)
 * 2. Letting body handle all scrolling
 */
export default function MobileScrollFix() {
    useEffect(() => {
        const applyMobileFix = () => {
            if (window.innerWidth <= 768) {
                // Create/update style element for scrollbar hiding
                let styleEl = document.getElementById('mobile-scroll-fix-styles');
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'mobile-scroll-fix-styles';
                    document.head.appendChild(styleEl);
                }

                // Hide scrollbar on main content areas and ensure only body scrolls
                styleEl.textContent = `
                    @media (max-width: 768px) {
                        html {
                            height: auto !important;
                            overflow: visible !important;
                        }
                        
                        body {
                            height: auto !important;
                            min-height: 100vh !important;
                            overflow-x: hidden !important;
                            overflow-y: scroll !important;
                        }
                        
                        #__next {
                            height: auto !important;
                            min-height: 100vh !important;
                        }
                        
                        .admin-main-content,
                        .coach-main-content,
                        .coder-main-content {
                            overflow: visible !important;
                            height: auto !important;
                            min-height: auto !important;
                            max-height: none !important;
                            -ms-overflow-style: none !important;
                            scrollbar-width: none !important;
                        }
                        
                        .admin-main-content::-webkit-scrollbar,
                        .coach-main-content::-webkit-scrollbar,
                        .coder-main-content::-webkit-scrollbar {
                            display: none !important;
                            width: 0 !important;
                            height: 0 !important;
                        }
                    }
                `;

                // Also apply inline styles
                document.documentElement.style.setProperty('height', 'auto', 'important');
                document.documentElement.style.setProperty('overflow', 'visible', 'important');

                document.body.style.setProperty('height', 'auto', 'important');
                document.body.style.setProperty('overflow-y', 'scroll', 'important');
                document.body.style.setProperty('overflow-x', 'hidden', 'important');

                // Fix main content areas - make them not scrollable at all
                const mainElements = document.querySelectorAll('.admin-main-content, .coach-main-content, .coder-main-content');
                mainElements.forEach(el => {
                    const elem = el as HTMLElement;
                    elem.style.setProperty('overflow', 'visible', 'important');
                    elem.style.setProperty('height', 'auto', 'important');
                    elem.style.setProperty('min-height', 'auto', 'important');
                    elem.style.setProperty('max-height', 'none', 'important');
                    // Hide any scrollbar that might appear
                    elem.style.setProperty('-ms-overflow-style', 'none', 'important');
                    elem.style.setProperty('scrollbar-width', 'none', 'important');
                });
            } else {
                // Reset on desktop
                const styleEl = document.getElementById('mobile-scroll-fix-styles');
                if (styleEl) {
                    styleEl.textContent = '';
                }

                document.documentElement.style.removeProperty('height');
                document.documentElement.style.removeProperty('overflow');
                document.body.style.removeProperty('height');
                document.body.style.removeProperty('overflow-y');
                document.body.style.removeProperty('overflow-x');

                const mainElements = document.querySelectorAll('.admin-main-content, .coach-main-content, .coder-main-content');
                mainElements.forEach(el => {
                    const elem = el as HTMLElement;
                    elem.style.removeProperty('overflow');
                    elem.style.removeProperty('height');
                    elem.style.removeProperty('min-height');
                    elem.style.removeProperty('max-height');
                    elem.style.removeProperty('-ms-overflow-style');
                    elem.style.removeProperty('scrollbar-width');
                });
            }
        };

        // Apply on mount with slight delay to ensure DOM is ready
        setTimeout(applyMobileFix, 100);
        applyMobileFix();

        // Apply on resize
        window.addEventListener('resize', applyMobileFix);

        // Re-apply on navigation (SPA)
        const observer = new MutationObserver(() => {
            if (window.innerWidth <= 768) {
                applyMobileFix();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Cleanup
        return () => {
            window.removeEventListener('resize', applyMobileFix);
            observer.disconnect();
        };
    }, []);

    return null;
}
