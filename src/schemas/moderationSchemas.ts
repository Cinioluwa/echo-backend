import { z } from 'zod';

const suspendPresetEnum = z.enum(['1_DAY', '1_WEEK', '1_MONTH']);

const reportIdParam = z.object({
    id: z.coerce.number().int().positive('Report ID must be a positive integer'),
});

export const applyModerationActionSchema = z.object({
    params: reportIdParam,
    body: z.discriminatedUnion('action', [
        z.object({
            action: z.literal('DISMISS'),
            note: z.string().max(500).optional(),
        }),
        z.object({
            action: z.literal('WARN'),
            note: z.string().max(500).optional(),
        }),
        z.object({
            action: z.literal('REMOVE_POST'),
            note: z.string().max(500).optional(),
        }),
        z.object({
            action: z.literal('SUSPEND'),
            suspendPreset: suspendPresetEnum,
            note: z.string().max(500).optional(),
        }),
        z.object({
            action: z.literal('BAN'),
            note: z.string().max(500).optional(),
        }),
        z.object({
            action: z.literal('REQUEST_IDENTITY_DISCLOSURE'),
            // Requires a substantial written justification
            note: z
                .string()
                .min(50, 'A written justification of at least 50 characters is required for identity disclosure requests.')
                .max(2000),
        }),
    ]),
});

export type ApplyModerationActionInput = z.infer<typeof applyModerationActionSchema>;
