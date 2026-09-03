'use client';

import { useState, useRef, useEffect, useLayoutEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export type DropdownPosition = {
    top: number;
    left: number;
    maxHeight: number;
};

/** Keep action menus reachable even when their trigger lives in an overflow container. */
export function getDropdownPosition(
    triggerRect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>,
    viewport: { width: number; height: number },
    menuSize: { width: number; height: number } = { width: 200, height: 240 },
    gap = 4,
): DropdownPosition {
    const spaceBelow = viewport.height - triggerRect.bottom - gap;
    const spaceAbove = triggerRect.top - gap;
    const openAbove = spaceBelow < Math.min(menuSize.height, 240) && spaceAbove > spaceBelow;
    const availableHeight = Math.max(96, (openAbove ? spaceAbove : spaceBelow));
    const unclampedLeft = triggerRect.right - menuSize.width;
    const left = Math.min(Math.max(gap, unclampedLeft), Math.max(gap, viewport.width - menuSize.width - gap));
    const top = openAbove
        ? Math.max(gap, triggerRect.top - Math.min(menuSize.height, availableHeight) - gap)
        : Math.min(viewport.height - gap, triggerRect.bottom + gap);

    return { top, left, maxHeight: availableHeight };
}

export default function ActionDropdown({
    children,
    label = 'Buka menu aksi',
}: {
    children: ReactNode;
    label?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState<DropdownPosition | null>(null);
    const [mounted, setMounted] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => setMounted(true), []);

    const updatePosition = () => {
        const trigger = dropdownRef.current?.querySelector('button');
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const menu = menuRef.current;
        setPosition(getDropdownPosition(
            rect,
            { width: window.innerWidth, height: window.innerHeight },
            menu ? { width: menu.offsetWidth || 200, height: menu.offsetHeight || 240 } : undefined,
        ));
    };

    useLayoutEffect(() => {
        if (!isOpen) {
            setPosition(null);
            return;
        }
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            const target = event.target as Node;
            if (dropdownRef.current && !dropdownRef.current.contains(target) && !menuRef.current?.contains(target)) {
                setIsOpen(false);
            }
        }
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setIsOpen(false);
        }
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const menu = isOpen && mounted && position ? createPortal(
        <div
            ref={menuRef}
            className="dropdown-menu"
            style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                maxHeight: position.maxHeight,
                overflowY: 'auto',
                background: 'var(--surface, #fff)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-sm)',
                minWidth: 160,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                padding: 4,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body,
    ) : null;

    return (
        <>
        <div className="dropdown" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button 
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }} 
                className="btn btn-sm btn-ghost"
                style={{ padding: '4px 8px' }}
                aria-label={label}
                title={label}
            >
                <MoreVertical size={16} />
            </button>
            
        </div>
        {menu}
        </>
    );
}
