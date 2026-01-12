import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSessionOrThrow } from '@/lib/auth';
import SoftwareForm from '../SoftwareForm';

export default async function NewSoftwarePage() {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'ADMIN') {
        return <div>Unauthorized</div>;
    }

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}>
            <Link href="/admin/software" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
                <ArrowLeft size={16} />
                Kembali ke Daftar Software
            </Link>

            <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>Tambah Software Baru</h1>

            <SoftwareForm mode="create" />
        </div>
    );
}
