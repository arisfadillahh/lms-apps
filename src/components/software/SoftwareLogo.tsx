'use client';

import { useState, type CSSProperties } from 'react';
import { Package } from 'lucide-react';
import { defaultSoftwareLogo, normalizeSoftwareLogoUrl } from '@/lib/softwareLogos';

export default function SoftwareLogo({ name, src, size = 40, className, style, onSourceError }: {
  name: string; src?: string | null; size?: number; className?: string; style?: CSSProperties; onSourceError?: (source: string) => void;
}) {
  const primary = normalizeSoftwareLogoUrl(src) || defaultSoftwareLogo(name);
  // Keying the image state to its sources lets edits recover from an earlier failed URL.
  return <LogoImage key={`${name}:${primary}`} name={name} primary={primary} size={size} className={className} style={style} onSourceError={onSourceError} />;
}

function LogoImage({ name, primary, size, className, style, onSourceError }: {
  name: string; primary: string | null; size: number; className?: string; style?: CSSProperties; onSourceError?: (source: string) => void;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const sources = [...new Set([primary, defaultSoftwareLogo(name)].filter(Boolean))] as string[];
  const source = sources.find(src => !failed.includes(src));
  return <span className={className} style={{ width:size, height:size, display:'inline-grid', placeItems:'center', flexShrink:0, ...style }}>
    {source ? <img src={source} alt={`Logo ${name}`} width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer"
      style={{ width:'100%', height:'100%', objectFit:'contain' }} onError={() => { setFailed(old => [...old, source]); onSourceError?.(source); }} />
      : <Package size={Math.min(size, 24)} aria-label={`Logo ${name} belum tersedia`} />}
  </span>;
}
