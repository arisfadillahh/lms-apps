export type ReimbursementStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface ReimbursementRequest {
  id: string; profile_id: string; period_id: string; title: string; amount: number;
  evidence_path: string; evidence_bytes: number; content_hash: string;
  status: ReimbursementStatus; revision: number; created_at: string;
  reviewed_by: string | null; reviewed_at: string | null; review_reason: string | null;
}
export const REIMBURSEMENT_BUCKET = 'payroll-reimbursements-private';
export const MAX_REIMBURSEMENT_AMOUNT = 1_000_000_000;
