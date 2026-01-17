'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2 } from 'lucide-react';


import { useSession } from 'next-auth/react';
import { MENU_ITEMS, SIDEBAR_STRUCTURE } from '@/lib/adminMenu';

type Props = {
    user: {
        id: string;
        full_name: string;
        parent_contact_phone: string | null;
        role: 'ADMIN' | 'COACH' | 'CODER';
        admin_permissions?: { menus: string[]; is_superadmin: boolean } | null;
    };
};

export default function EditUserButton({ user }: Props) {
    const router = useRouter();
    const { data: session } = useSession();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [fullName, setFullName] = useState(user.full_name);
    const [parentContact, setParentContact] = useState(user.parent_contact_phone || '');
    const [permissions, setPermissions] = useState<string[]>(user.admin_permissions?.menus || []);
    const [error, setError] = useState<string | null>(null);

    const isSuperAdmin = session?.user?.username === 'admin';
    const isTargetAdmin = user.role === 'ADMIN';

    const handleOpen = () => {
        setFullName(user.full_name);
        setParentContact(user.parent_contact_phone || '');
        setPermissions(user.admin_permissions?.menus || []);
        setError(null);
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setError(null);
    };

    const togglePermission = (code: string) => {
        setPermissions(prev =>
            prev.includes(code)
                ? prev.filter(p => p !== code)
                : [...prev, code]
        );
    };

    const handleSubmit = () => {
        if (!fullName.trim()) {
            setError('Nama lengkap wajib diisi');
            return;
        }
        setError(null);

        startTransition(async () => {
            try {
                const payload: any = {
                    id: user.id,
                    fullName: fullName.trim(),
                    parentContactPhone: user.role === 'CODER' ? parentContact.trim() || null : null,
                };

                if (isSuperAdmin && isTargetAdmin) {
                    payload.adminPermissions = {
                        menus: permissions,
                        is_superadmin: false // Only 'admin' is superadmin
                    };
                }

                const response = await fetch('/api/admin/users/update', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal mengupdate user');
                    return;
                }

                handleClose();
                router.refresh();
            } catch (err) {
                console.error(err);
                setError('Terjadi kesalahan');
            }
        });
    };

    return (
        <>
            <button onClick={handleOpen} style={editBtnStyle} title="Edit User">
                <Edit2 size={14} />
            </button>

            {open && (
                <div style={backdropStyle} onClick={handleClose}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Edit User</h3>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Username</label>
                            <input
                                type="text"
                                value={user.id.slice(0, 8) + '...'} // Just showing ID partly or name? Username not passed in props but existing code showed ID.
                                // Actually props type has 'id', 'full_name' etc. 'username' is missing in Props!
                                // Wait, existing code had: value={user.id.slice(0, 8) + '...'}
                                // I will stick to existing logic but note that username might be better if passed.
                                disabled
                                style={{ ...inputStyle, background: '#f1f5f9', color: '#64748b' }}
                            />
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                Username tidak bisa diubah
                            </p>
                        </div>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Nama Lengkap *</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Nama lengkap"
                                style={inputStyle}
                                autoFocus
                            />
                        </div>

                        {user.role === 'CODER' && (
                            <div style={fieldStyle}>
                                <label style={labelStyle}>Kontak Orang Tua (WhatsApp)</label>
                                <input
                                    type="tel"
                                    value={parentContact}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        setParentContact(val);
                                    }}
                                    placeholder="08123456789"
                                    style={inputStyle}
                                />
                            </div>
                        )}

                        <div style={{ ...fieldStyle, background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem' }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Role: {user.role}</label>
                            {!isSuperAdmin && (
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                    Role tidak bisa diubah dari sini
                                </p>
                            )}
                        </div>

                        {/* Permissions Section - Only for Super Admin editing Admin */}
                        {isSuperAdmin && isTargetAdmin && (
                            <div style={{ marginBottom: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>Akses Menu (Per-Page)</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {SIDEBAR_STRUCTURE.map((item, idx) => {
                                        if (item.type === 'single') {
                                            const menu = MENU_ITEMS[item.id];
                                            return (
                                                <div key={item.id}>
                                                    <label style={checkboxLabelStyle}>
                                                        <input
                                                            type="checkbox"
                                                            checked={permissions.includes(item.id)}
                                                            onChange={() => togglePermission(item.id)}
                                                            style={checkboxStyle}
                                                        />
                                                        {menu.label}
                                                    </label>
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div key={idx} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem' }}>
                                                    <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>
                                                        {item.label}
                                                    </h4>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                                                        {item.children.map(childId => {
                                                            const menu = MENU_ITEMS[childId];
                                                            return (
                                                                <label key={childId} style={checkboxLabelStyle}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={permissions.includes(childId)}
                                                                        onChange={() => togglePermission(childId)}
                                                                        style={checkboxStyle}
                                                                    />
                                                                    {menu.label}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    })}
                                </div>
                            </div>
                        )}

                        {error && <p style={errorStyle}>{error}</p>}

                        <div style={actionsStyle}>
                            <button onClick={handleClose} style={cancelStyle} disabled={isPending}>
                                Batal
                            </button>
                            <button onClick={handleSubmit} style={submitStyle} disabled={isPending}>
                                {isPending ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const editBtnStyle: CSSProperties = {
    padding: '0.35rem',
    borderRadius: '0.375rem',
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#475569',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
};

const modalStyle: CSSProperties = {
    background: '#fff',
    padding: '1.5rem',
    borderRadius: '1rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
    maxHeight: '90vh',
    overflowY: 'auto'
};

const titleStyle: CSSProperties = {
    margin: '0 0 1.25rem 0',
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#0f172a',
};

const fieldStyle: CSSProperties = {
    marginBottom: '1rem',
};

const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#334155',
    marginBottom: '0.35rem',
};

const inputStyle: CSSProperties = {
    width: '100%',
    padding: '0.55rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    color: '#0f172a',
};

const actionsStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1.25rem',
};

const cancelStyle: CSSProperties = {
    padding: '0.55rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#475569',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};

const submitStyle: CSSProperties = {
    padding: '0.55rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#1e3a5f',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};

const errorStyle: CSSProperties = {
    color: '#dc2626',
    fontSize: '0.85rem',
    marginTop: '0.5rem',
};

const checkboxStyle: CSSProperties = {
    width: '16px',
    height: '16px',
    borderRadius: '4px',
    accentColor: '#1e3a5f',
    cursor: 'pointer',
};

const checkboxLabelStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: '#334155',
    cursor: 'pointer',
    fontWeight: 500
};
