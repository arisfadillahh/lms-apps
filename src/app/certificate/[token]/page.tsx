import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';

import { getCertificateByToken } from '@/lib/services/certificates';

export default async function CertificatePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const certificate = await getCertificateByToken(token);
    if (!certificate) notFound();

    const layout = certificate.layout_json || {};
    const primaryColor = typeof layout.primaryColor === 'string' ? layout.primaryColor : '#057BE3';
    const accentColor = typeof layout.accentColor === 'string' ? layout.accentColor : '#F2B929';
    const backgroundUrl = typeof layout.backgroundUrl === 'string' ? layout.backgroundUrl : null;
    const logoUrl = typeof layout.logoUrl === 'string' ? layout.logoUrl : null;
    const signatureName = typeof layout.signatureName === 'string' ? layout.signatureName : 'Clevio';

    return (
        <main style={pageStyle}>
            <section
                style={{
                    ...certificateStyle,
                    borderColor: primaryColor,
                    backgroundImage: backgroundUrl
                        ? `linear-gradient(rgba(255,255,255,.86), rgba(255,255,255,.9)), url("${backgroundUrl}")`
                        : `linear-gradient(135deg, rgba(5,123,227,.12), rgba(11,188,222,.12), rgba(242,185,41,.16))`
                }}
            >
                <header style={headerStyle}>
                    {logoUrl ? <img src={logoUrl} alt="Clevio" style={logoStyle} /> : <strong style={{ color: primaryColor }}>Clevio</strong>}
                    <span style={{ ...badgeStyle, background: accentColor }}>Digital Certificate</span>
                </header>

                <div style={bodyStyle}>
                    <p style={{ ...eyebrowStyle, color: primaryColor }}>{certificate.program_name}</p>
                    <h1 style={titleStyle}>Sertifikat Penyelesaian</h1>
                    <p style={mutedStyle}>Diberikan kepada</p>
                    <h2 style={{ ...nameStyle, color: primaryColor }}>{certificate.student_name}</h2>
                    <p style={descriptionStyle}>
                        atas partisipasi dalam program <strong>{certificate.program_name}</strong>
                        {certificate.level_name ? <> level <strong>{certificate.level_name}</strong></> : null}.
                    </p>
                    <div style={classListStyle}>
                        {certificate.class_names.map((name) => (
                            <span key={name} style={{ ...classPillStyle, borderColor: primaryColor }}>{name}</span>
                        ))}
                    </div>
                </div>

                <footer style={footerStyle}>
                    <div>
                        <span style={smallLabelStyle}>No. Sertifikat</span>
                        <strong>{certificate.certificate_number}</strong>
                    </div>
                    <div>
                        <span style={smallLabelStyle}>Tanggal</span>
                        <strong>{certificate.issued_date}</strong>
                    </div>
                    <div>
                        <span style={smallLabelStyle}>Tanda tangan</span>
                        <strong>{signatureName}</strong>
                    </div>
                </footer>
            </section>
        </main>
    );
}

const pageStyle: CSSProperties = {
    minHeight: '100vh',
    margin: 0,
    display: 'grid',
    placeItems: 'center',
    background: '#eaf8ff',
    padding: 24,
    fontFamily: 'Inter, Arial, sans-serif',
    color: '#0B1020'
};

const certificateStyle: CSSProperties = {
    width: 'min(1040px, 100%)',
    minHeight: 680,
    border: '10px solid',
    borderRadius: 24,
    backgroundColor: '#fff',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    boxShadow: '0 24px 70px rgba(6, 24, 59, .16)',
    padding: '42px 52px',
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    gap: 28
};

const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16
};

const logoStyle: CSSProperties = {
    maxWidth: 150,
    maxHeight: 60,
    objectFit: 'contain'
};

const badgeStyle: CSSProperties = {
    borderRadius: 999,
    color: '#06183B',
    fontSize: 13,
    fontWeight: 800,
    padding: '10px 16px'
};

const bodyStyle: CSSProperties = {
    display: 'grid',
    alignContent: 'center',
    justifyItems: 'center',
    textAlign: 'center',
    gap: 14
};

const eyebrowStyle: CSSProperties = {
    margin: 0,
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: 'uppercase'
};

const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: 'clamp(34px, 5vw, 60px)',
    lineHeight: 1.04,
    color: '#06183B'
};

const mutedStyle: CSSProperties = {
    margin: '10px 0 0',
    color: '#5d6b82',
    fontSize: 18
};

const nameStyle: CSSProperties = {
    margin: 0,
    fontSize: 'clamp(36px, 6vw, 72px)',
    lineHeight: 1.02
};

const descriptionStyle: CSSProperties = {
    maxWidth: 720,
    margin: 0,
    color: '#26354f',
    fontSize: 18,
    lineHeight: 1.6
};

const classListStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8
};

const classPillStyle: CSSProperties = {
    border: '1px solid',
    borderRadius: 999,
    background: '#fff',
    padding: '9px 14px',
    fontWeight: 800,
    color: '#06183B'
};

const footerStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 18,
    borderTop: '1px solid #d9e8ef',
    paddingTop: 22
};

const smallLabelStyle: CSSProperties = {
    display: 'block',
    color: '#66758d',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    marginBottom: 5
};
