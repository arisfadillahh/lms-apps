'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import SoftwareLogo from '@/components/software/SoftwareLogo';
import { defaultSoftwareLogo, normalizeSoftwareLogoUrl } from '@/lib/softwareLogos';

const schema = z.object({
    name: z.string().min(2, 'Minimal 2 karakter'),
    description: z.string().optional().or(z.literal('')),
    version: z.string().optional().or(z.literal('')),
    installationUrl: z.string().url('URL tidak valid').optional().or(z.literal('')),
    installationInstructions: z.string().optional().or(z.literal('')),
    accessInfo: z.string().optional().or(z.literal('')),
    iconUrl: z.string().refine(value => !value.trim() || normalizeSoftwareLogoUrl(value) !== null, 'Gunakan URL gambar HTTPS yang valid.').optional(),
    // minimumSpecs as JSON string
    minimumSpecsCpu: z.string().optional().or(z.literal('')),
    minimumSpecsRam: z.string().optional().or(z.literal('')),
    minimumSpecsStorage: z.string().optional().or(z.literal('')),
    minimumSpecsOs: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

type SoftwareFormProps = {
    mode: 'create' | 'edit';
    initialData?: {
        id: string;
        name: string;
        description?: string | null;
        version?: string | null;
        installation_url?: string | null;
        installation_instructions?: string | null;
        access_info?: string | null;
        icon_url?: string | null;
        minimum_specs?: {
            cpu?: string;
            ram?: string;
            storage?: string;
            os?: string;
        } | null;
    };
};

export default function SoftwareForm({ mode, initialData }: SoftwareFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoLoadFailed,setLogoLoadFailed] = useState(false);
    const logoInput = useRef<HTMLInputElement>(null);
    const clearLogoFile = () => { setLogoFile(null); if (logoInput.current) logoInput.current.value = ''; };

    const {
        register,
        handleSubmit,
        watch, setValue, setError, clearErrors,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: initialData?.name ?? '',
            description: initialData?.description ?? '',
            version: initialData?.version ?? '',
            installationUrl: initialData?.installation_url ?? '',
            installationInstructions: initialData?.installation_instructions ?? '',
            accessInfo: initialData?.access_info ?? '',
            iconUrl: initialData?.icon_url ?? '',
            minimumSpecsCpu: initialData?.minimum_specs?.cpu ?? '',
            minimumSpecsRam: initialData?.minimum_specs?.ram ?? '',
            minimumSpecsStorage: initialData?.minimum_specs?.storage ?? '',
            minimumSpecsOs: initialData?.minimum_specs?.os ?? '',
        },
    });
    const softwareName = watch('name');
    const iconUrl = watch('iconUrl');
    useEffect(()=>setLogoLoadFailed(false),[iconUrl,logoFile]);
    useEffect(() => {
        if (!logoFile) { setLogoPreview(null); return; }
        const url = URL.createObjectURL(logoFile);
        setLogoPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [logoFile]);

    const onSubmit = async (values: FormValues) => {
        setIsSubmitting(true);
        setErrorMessage(null);

        const minimumSpecs = {
            cpu: values.minimumSpecsCpu || null,
            ram: values.minimumSpecsRam || null,
            storage: values.minimumSpecsStorage || null,
            os: values.minimumSpecsOs || null,
        };

        const hasSpecs = Object.values(minimumSpecs).some(v => v !== null);

        const payload = {
            name: values.name,
            description: values.description || null,
            version: values.version || null,
            installationUrl: values.installationUrl || null,
            installationInstructions: values.installationInstructions || null,
            accessInfo: values.accessInfo || null,
            iconUrl: values.iconUrl || null,
            minimumSpecs: hasSpecs ? minimumSpecs : null,
        };

        try {
            if (logoFile) {
                const form = new FormData();
                form.set('file', logoFile);
                const upload = await fetch('/api/admin/software/logo', { method:'POST', body:form });
                const data = await upload.json().catch(() => ({}));
                if (!upload.ok || !normalizeSoftwareLogoUrl(data.iconUrl)) throw new Error(data.error || 'Logo gagal diunggah. Coba simpan lagi.');
                payload.iconUrl = data.iconUrl;
                // Preserve successful upload on a subsequent software-save failure/retry.
                setValue('iconUrl', data.iconUrl, { shouldDirty:true, shouldValidate:true });
                clearLogoFile();
            }
            const url = mode === 'edit' ? `/api/admin/software/${initialData?.id}` : '/api/admin/software';
            const method = mode === 'edit' ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error ?? 'Gagal menyimpan software');
            }

            router.push('/admin/software');
            router.refresh();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Terjadi kesalahan');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: '600px' }}>
            <div style={formGroupStyle}>
                <label style={labelStyle}>Nama Software *</label>
                <input type="text" style={inputStyle} {...register('name')} placeholder="Contoh: Scratch 3.0" />
                {errors.name && <span style={errorStyle}>{errors.name.message}</span>}
            </div>

            <section style={{ ...formGroupStyle, padding:16, border:'1px solid #dce5f2', borderRadius:12 }} aria-label="Logo software">
                <label htmlFor="software-logo-file" style={labelStyle}>Logo Software</label>
                <p style={{fontSize:12,color:'#64748b',lineHeight:1.5,margin:'0 0 12px'}}>Logo digunakan di katalog software dan portofolio publik coder.</p>
                <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
                    <div style={{ width:80, height:80, flexShrink:0, display:'grid', placeItems:'center', background:'#fff', border:'1px solid #dce5f2', borderRadius:12, padding:10 }}>
                        {logoPreview ? <img src={logoPreview} alt="Preview logo yang dipilih" style={{ width:'100%', height:'100%', objectFit:'contain' }} onError={()=>setError('iconUrl',{type:'manual',message:'Gambar tidak dapat dibaca. Pilih file PNG, JPG, atau WebP yang valid.'})} />
                            : <SoftwareLogo name={softwareName} src={iconUrl} size={58} onSourceError={source=>{if (source === normalizeSoftwareLogoUrl(iconUrl)) setLogoLoadFailed(true);}} />}
                    </div>
                    <div style={{ flex:'1 1 220px', minWidth:0 }}>
                        <input ref={logoInput} id="software-logo-file" type="file" accept="image/png,image/jpeg,image/webp" disabled={isSubmitting}
                            style={{ maxWidth:'100%' }} onChange={event => {
                                const file = event.currentTarget.files?.[0];
                                if (!file) return;
                                if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 1024*1024 || !file.size) {
                                    setError('iconUrl', { type:'manual', message:'Pilih PNG, JPG, atau WebP maksimal 1 MB.' });
                                    event.currentTarget.value = ''; return;
                                }
                                clearErrors('iconUrl'); setLogoFile(file);
                            }} />
                        <p style={{ fontSize:12, color:'#64748b', lineHeight:1.5, margin:'8px 0' }}>PNG, JPG, atau WebP, maksimal 1 MB. Logo tersimpan bersama data software.</p>
                        {logoFile && <button type="button" className="btn btn-sm" disabled={isSubmitting} onClick={() => { clearLogoFile(); clearErrors('iconUrl'); }}>Batalkan pilihan gambar</button>}
                    </div>
                </div>
                <label htmlFor="software-logo-url" style={labelStyle}>Atau pakai URL logo</label>
                <input id="software-logo-url" type="text" inputMode="url" style={inputStyle} disabled={isSubmitting || Boolean(logoFile)}
                    {...register('iconUrl')} placeholder="https://…/logo.png" />
                {errors.iconUrl && <span style={errorStyle} role="alert">{errors.iconUrl.message}</span>}
                {logoLoadFailed && <p role="status" style={{fontSize:12,color:'#956100',lineHeight:1.5}}>Preview URL belum bisa dimuat. Periksa link gambar; logo bawaan ditampilkan sementara jika tersedia.</p>}
                {!logoFile && !iconUrl && <p style={{ fontSize:12, color:'#64748b', lineHeight:1.5, margin:'8px 0 0' }}>
                    {defaultSoftwareLogo(softwareName) ? 'Logo resmi bawaan digunakan. Isi URL atau unggah gambar untuk menggantinya.' : 'Belum ada logo bawaan. Unggah gambar atau isi URL logo software ini.'}
                </p>}
                {(iconUrl || logoFile) && <button type="button" className="btn btn-sm" style={{ marginTop:8 }} disabled={isSubmitting} onClick={() => { clearLogoFile(); setValue('iconUrl','',{ shouldDirty:true, shouldValidate:true }); clearErrors('iconUrl'); }}>Gunakan logo bawaan</button>}
            </section>

            <div style={formGroupStyle}>
                <label style={labelStyle}>Deskripsi</label>
                <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} {...register('description')}
                    placeholder="Penjelasan singkat tentang software ini" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Versi</label>
                    <input type="text" style={inputStyle} {...register('version')} placeholder="3.0.1" />
                </div>

                <div style={formGroupStyle}>
                    <label style={labelStyle}>URL Download</label>
                    <input type="url" style={inputStyle} {...register('installationUrl')} placeholder="https://..." />
                    {errors.installationUrl && <span style={errorStyle}>{errors.installationUrl.message}</span>}
                </div>
            </div>

            <div style={formGroupStyle}>
                <label style={labelStyle}>Cara Install / Akses</label>
                <textarea rows={4} style={{ ...inputStyle, resize: 'vertical' }} {...register('installationInstructions')}
                    placeholder="Langkah-langkah menginstall atau mengakses software..." />
            </div>

            <div style={formGroupStyle}>
                <label style={labelStyle}>Info Akses (Login, License, dll)</label>
                <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} {...register('accessInfo')}
                    placeholder="Contoh: Gunakan akun Google sekolah untuk login" />
            </div>

            {/* Minimum Specs */}
            <div style={{ ...formGroupStyle, background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                <label style={{ ...labelStyle, marginBottom: '12px', display: 'block' }}>Spesifikasi Minimum</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <label style={{ fontSize: '12px', color: '#64748b' }}>CPU</label>
                        <input type="text" style={inputStyle} {...register('minimumSpecsCpu')} placeholder="Intel Core i3" />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', color: '#64748b' }}>RAM</label>
                        <input type="text" style={inputStyle} {...register('minimumSpecsRam')} placeholder="4 GB" />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', color: '#64748b' }}>Storage</label>
                        <input type="text" style={inputStyle} {...register('minimumSpecsStorage')} placeholder="500 MB" />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', color: '#64748b' }}>OS</label>
                        <input type="text" style={inputStyle} {...register('minimumSpecsOs')} placeholder="Windows 10 / macOS" />
                    </div>
                </div>
            </div>

            {errorMessage && (
                <div style={{ padding: '12px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                    {errorMessage}
                </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                        ...buttonStyle,
                        opacity: isSubmitting ? 0.6 : 1,
                    }}
                >
                    {isSubmitting ? 'Menyimpan...' : mode === 'edit' ? 'Simpan Perubahan' : 'Tambah Software'}
                </button>
                <button
                    type="button"
                    onClick={() => router.back()}
                    style={secondaryButtonStyle}
                >
                    Batal
                </button>
            </div>
        </form>
    );
}

const formGroupStyle: CSSProperties = {
    marginBottom: '16px',
};

const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#334155',
    marginBottom: '6px',
};

const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    color: '#0f172a',
    background: '#ffffff',
};

const errorStyle: CSSProperties = {
    fontSize: '12px',
    color: '#dc2626',
    marginTop: '4px',
    display: 'block',
};

const buttonStyle: CSSProperties = {
    padding: '12px 24px',
    background: '#1e3a5f',
    color: 'white',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    border: 'none',
    cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
    padding: '12px 24px',
    background: '#f1f5f9',
    color: '#475569',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    border: 'none',
    cursor: 'pointer',
};
