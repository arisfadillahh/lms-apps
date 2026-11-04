import type { Activity, Contract } from './model';
export type RequestKind = 'EVENT' | 'OBSERVATION_ONLINE' | 'OBSERVATION_OFFLINE' | 'TRAINING_ONLINE' | 'TRAINING_OFFLINE';
export interface ActivityRequest {
  id: string; coach_id: string; activity_at: string; kind: RequestKind; label: string; notes: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; mode: Contract; revision: number;
  review_reason: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string;
}
export const requestLabels: Record<RequestKind, string> = { EVENT: 'Event', OBSERVATION_ONLINE: 'Observasi online', OBSERVATION_OFFLINE: 'Observasi offline', TRAINING_ONLINE: 'Training online', TRAINING_OFFLINE: 'Training offline' };
export function approvedRequestActivities(requests: ActivityRequest[]): Activity[] {
  return requests.filter(r => r.status === 'APPROVED').map(r => ({
    key: `request:${r.id}`, user_id: r.coach_id, date: r.activity_at, label: r.label, kind: r.kind,
    mode: r.mode, delivery: r.kind.endsWith('_OFFLINE') ? 'OFFLINE' : 'ONLINE', students: 1, cancelled: false,
    details: `${requestLabels[r.kind]} · Disetujui admin: ${r.review_reason ?? ''}`,
  }));
}
