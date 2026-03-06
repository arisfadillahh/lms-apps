'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function CoderTemplate({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <motion.div
            key={pathname}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
                duration: 0.4,
                ease: [0.25, 0.1, 0.25, 1],
                opacity: { duration: 0.3 }
            }}
            className="h-full w-full"
        >
            {children}
        </motion.div>
    );
}
