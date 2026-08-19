'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

export default function ActionDropdown({
    children,
    label = 'Buka menu aksi',
}: {
    children: ReactNode;
    label?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
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
            
            {isOpen && (
                <div 
                    className="dropdown-menu" 
                    style={{ 
                        position: 'absolute', 
                        right: 0, 
                        top: '100%', 
                        marginTop: 4, 
                        background: '#fff', 
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        boxShadow: 'var(--shadow-sm)',
                        minWidth: 160,
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 4
                    }}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent row clicks from closing it immediately
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}
