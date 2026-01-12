import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getSessionOrThrow } from '@/lib/auth';
import { getSoftwareById } from '@/lib/dao/softwareDao';
import SoftwareForm from '../SoftwareForm';
import DeleteSoftwareButton from './DeleteSoftwareButton';

type PageProps = { params: Promise<{ id: string }> };

export default async function EditSoftwarePage({ params }: PageProps) {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'ADMIN') {
        return <div>Unauthorized</div>;
    }

    const { id } = await params;
    const software = await getSoftwareById(id);

    if (!software) {
        notFound();
    }

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <Link href="/admin/software" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>
                        <ArrowLeft size={16} />
                        Kembali ke Daftar Software
                    </Link>
                    <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Edit Software</h1>
                </div>

                <DeleteSoftwareButton softwareId={id} softwareName={software.name} />
            </div>

            <SoftwareForm
                mode="edit"
                initialData={{
                    id: software.id,
                    name: software.name,
                    description: software.description,
                    version: software.version,
                    installation_url: software.installation_url,
                    installation_instructions: software.installation_instructions,
                    access_info: software.access_info,
                    icon_url: software.icon_url,
                    minimum_specs: software.minimum_specs as { cpu?: string; ram?: string; storage?: string; os?: string } | null,
                }}
            />
        </div>
    );
}
