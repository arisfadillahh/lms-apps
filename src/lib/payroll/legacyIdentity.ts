import type { PeriodDocument } from './model';

type Confirmation = { confirmed_at: string; reason: string };
export type LegacyIdentityLink = Confirmation & (
  { status: 'IGNORED' } |
  { status: 'LINKED'; profile_id: string; user_id: string | null; kind: 'COACH' | 'STAFF'; name: string }
);
export function linkLegacyIdentities(period: PeriodDocument, links: Record<string, LegacyIdentityLink>): PeriodDocument {
  const next=structuredClone(period);
  const sourceIds=new Set((period.legacy_imports??[]).flatMap(s=>s.rows.map(r=>r.sourceId)));
  next.legacy_links={...(period.legacy_links??{})};
  for(const sourceId of sourceIds){
    const link=links[sourceId];if(!link)throw new Error('Identitas sumber belum dikonfirmasi.');
    if(!link.reason.trim()||!Number.isFinite(Date.parse(link.confirmed_at)))throw new Error('Bukti konfirmasi identitas tidak valid.');
    if(link.status==='LINKED' && (!link.profile_id || !link.name.trim() || (link.kind==='COACH' && !link.user_id) || (link.kind==='STAFF' && link.user_id!==null)))throw new Error('Pasangan penerima tidak valid.');
    const previous=next.legacy_links[sourceId];
    if(previous){
      if(previous.status!==link.status || (previous.status==='LINKED' && link.status==='LINKED' && (previous.profile_id!==link.profile_id || previous.user_id!==link.user_id || previous.kind!==link.kind)))throw new Error('Identitas sudah ditautkan ke penerima lain.');
      continue;
    }
    next.legacy_links[sourceId]=structuredClone(link);
  }
  return next;
}
