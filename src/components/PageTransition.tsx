'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export default function PageTransition({ children }: { children: ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}
        >
            {children}
        </motion.div>
    );
}
