'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function StaggerContainer({ children, className }: { children: React.ReactNode, className?: string }) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // SSR fallback to prevent hydration mismatch
    if (!isMounted) return <div className={className}>{children}</div>;



    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                visible: {
                    transition: {
                        staggerChildren: 0.15
                    }
                }
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function StaggerItem({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
