import { z } from 'zod';

export const roleEnum = z.enum(['ADMIN', 'COACH', 'CODER']);

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only include letters, numbers, dot, underscore, and hyphen'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: roleEnum,
  fullName: z.string().min(1, 'Full name is required'),
  parentContactPhone: z
    .string()
    .min(6, 'Phone number must be at least 6 digits')
    .max(20)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  isActive: z.boolean().default(true),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const createClassSchema = z.object({
  name: z.string().min(3),
  type: z.enum(['WEEKLY', 'EKSKUL']),
  levelId: z.string().uuid().nullable().optional(),
  coachId: z.string().uuid(),
  scheduleDay: z.string().min(2),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/),
  zoomLink: z.string().url(),
  initialBlockId: z
    .union([z.string().uuid(), z.literal('')])
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  startDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid start date' }),
  endDate: z
    .union([
      z.string().refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid end date' }),
      z
        .literal('')
        .transform(() => undefined),
    ])
    .optional(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;

export const generateSessionsSchema = z.object({
  startDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid start date' }),
  endDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid end date' }),
  byDay: z.array(z.enum(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'])).min(1),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  zoomLinkSnapshot: z.string().url().optional().nullable(),
});

export type GenerateSessionsInput = z.infer<typeof generateSessionsSchema>;

export const assignSubstituteSchema = z.object({
  substituteCoachId: z.string().uuid().nullable(),
});

export const enrollCoderSchema = z.object({
  coderId: z.string().uuid(),
});

export const updateEnrollmentStatusSchema = z.object({
  coderId: z.string().uuid(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export const createBlockTemplateSchema = z.object({
  levelId: z.string().uuid(),
  name: z.string().min(3),
  summary: z.string().max(500).optional().or(z.literal('').transform(() => undefined)),
  orderIndex: z.number().int().min(0),
  estimatedSessions: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

export type CreateBlockTemplateInput = z.infer<typeof createBlockTemplateSchema>;

export const updateBlockTemplateSchema = z
  .object({
    name: z.string().min(3).optional(),
    summary: z.string().max(500).optional().or(z.literal('').transform(() => undefined)),
    orderIndex: z.number().int().min(0).optional(),
    estimatedSessions: z.number().int().min(0).optional().nullable(),
    isPublished: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No fields to update' });

export type UpdateBlockTemplateInput = z.infer<typeof updateBlockTemplateSchema>;

export const createLessonTemplateSchema = z.object({
  blockId: z.string().uuid(),
  title: z.string().min(3),
  summary: z.string().max(500).optional().or(z.literal('').transform(() => undefined)),
  slideUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  orderIndex: z.coerce.number().int().min(0),
  estimatedMeetingCount: z
    .preprocess((value) => (value === '' || value === null || value === undefined ? undefined : value), z.coerce.number().int().min(0))
    .optional(),
  makeUpInstructions: z.string().max(500).optional().or(z.literal('').transform(() => undefined)),
});

export type CreateLessonTemplateInput = z.infer<typeof createLessonTemplateSchema>;

export const updateLessonTemplateSchema = z
  .object({
    title: z.string().min(3).optional(),
    summary: z.string().max(500).optional().or(z.literal('').transform(() => undefined)),
    orderIndex: z
      .preprocess((value) => (value === undefined || value === null || value === '' ? undefined : value), z.coerce.number().int().min(0))
      .optional(),
    estimatedMeetingCount: z
      .preprocess(
        (value) => (value === '' || value === undefined ? null : value === null ? null : value),
        z.union([z.literal(null), z.coerce.number().int().min(0)]),
      )
      .optional(),
    slideUrl: z
      .string()
      .url()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    makeUpInstructions: z.string().max(500).optional().or(z.literal('').transform(() => undefined)),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No fields to update' });

export type UpdateLessonTemplateInput = z.infer<typeof updateLessonTemplateSchema>;

export const instantiateClassBlockSchema = z.object({
  blockId: z.string().uuid(),
  startDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Tanggal mulai tidak valid' }),
});

export type InstantiateClassBlockInput = z.infer<typeof instantiateClassBlockSchema>;
