import { z } from 'zod';

const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Tanggal tidak valid');
const amount = z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000);
const nonnegative = amount.nonnegative();
const reason = z.string().trim().min(5).max(1000);
const mode = z.enum(['FULLTIME', 'MITRA']);
const period = { periodId: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/), revision: z.number().int().nonnegative() };
const ids = z.array(id).min(1).max(20).refine(v => new Set(v).size === v.length, 'Penerima terpilih ganda');
const triple = z.tuple([nonnegative, nonnegative, nonnegative]);
const recurringAllowances = z.array(z.object({ label: z.string().trim().min(1).max(160), amount: nonnegative })).max(20);
export const payrollRatesSchema = z.object({
  WEEKLY_ONLINE: triple, WEEKLY_OFFLINE: triple, EKSKUL_ONLINE: triple, EKSKUL_OFFLINE: triple,
  TRIAL: nonnegative, GOAL: nonnegative, EVENT: nonnegative, TRAINING_ONLINE: nonnegative, TRAINING_OFFLINE: nonnegative, OBSERVATION_ONLINE: nonnegative, OBSERVATION_OFFLINE: nonnegative,
});
export const payrollCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('profile'), id: id.optional(), userId: id.nullable().optional(), kind: z.enum(['COACH', 'STAFF']), name: z.string().trim().min(1).max(160), jobTitle: z.string().trim().max(160).default(''), staffPhone: z.string().trim().max(30).nullable().default(null), active: z.boolean().default(true), contract: mode, baseSalary: nonnegative, positionAllowance: nonnegative.optional(), otherAllowances: recurringAllowances.optional(), effectiveFrom: date }),
  z.object({ action: z.literal('rates'), effectiveFrom: date, rates: payrollRatesSchema }),
  z.object({ action: z.literal('settings'), activeFrom: date, automationEnabled: z.boolean() }),
  z.object({ action: z.literal('create'), year: z.number().int().min(2020).max(2099), month: z.number().int().min(1).max(12) }),
  z.object({ action: z.literal('calculate'), ...period }),
  z.object({ action: z.literal('finalize'), ...period }),
  z.object({ action: z.literal('reopen'), ...period, reason }),
  z.object({ action: z.literal('assignPic'), ...period, userId: id }),
  z.object({ action: z.literal('reviewCorrection'), ...period, id, status: z.enum(['IN_PROGRESS', 'DONE', 'REJECTED']), reason }),
  z.object({ action: z.literal('reverseTransfer'), ...period, transferId: z.string().min(1).max(300), reason }),
  z.object({ action: z.literal('component'), ...period, id: id.optional(), profileId: id, date, label: z.string().trim().min(1).max(160), amount, reason }),
  z.object({ action: z.literal('removeComponent'), ...period, id, reason }),
  z.object({ action: z.literal('activity'), ...period, profileId: id, date, kind: z.enum(['WEEKLY', 'EKSKUL', 'TRIAL', 'EVENT', 'TRAINING_ONLINE', 'TRAINING_OFFLINE', 'OBSERVATION_ONLINE', 'OBSERVATION_OFFLINE']), mode, delivery: z.enum(['ONLINE', 'OFFLINE']).default('ONLINE'), students: z.number().int().min(1).max(500).default(1), label: z.string().trim().min(1).max(160), reason }),
  z.object({ action: z.literal('removeActivity'), ...period, id, reason }),
  z.object({ action: z.literal('override'), ...period, sourceKey: z.string().min(1).max(300), profileId: id.optional(), amount: nonnegative.optional(), excluded: z.boolean().optional(), mode: mode.optional(), reason }),
  z.object({ action: z.literal('transfer'), ...period, profileIds: ids, reference: z.string().trim().max(300).default('') }),
  z.object({ action: z.literal('send'), ...period, profileIds: ids, kind: z.enum(['RECAP', 'SLIP']), resend: z.boolean().default(false) }),
  z.object({ action: z.literal('recoverDelivery'), ...period, key: z.string().min(1).max(300), reason }),
  z.object({ action: z.literal('classMode'), classId: id, mode }),
  z.object({ action: z.literal('reviewActivity'), id, requestRevision: z.number().int().nonnegative(), status: z.enum(['APPROVED','REJECTED']), mode, reason }),
]);
export type PayrollCommand = z.infer<typeof payrollCommandSchema>;
