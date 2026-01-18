/**
 * List ID Invoice (CCR)
 * Route: /admin/coders/list-ccr
 * 
 * View and edit existing CCR (ID Invoice) assignments.
 */

import CCRList from './CCRList';

export const dynamic = 'force-dynamic';

export default function ListCCRPage() {
    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: '#1e293b',
                    marginBottom: '0.5rem'
                }}>
                    Daftar ID Invoice
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                    Lihat dan edit nomor ID Invoice (CCR) yang sudah terdaftar
                </p>
            </div>
            <CCRList />
        </div>
    );
}
