'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function AdminPageActions({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const el = document.getElementById('admin-page-actions');
    if (!el) return null;

    return createPortal(
        <div className="row gap-2">{children}</div>,
        el
    );
}
