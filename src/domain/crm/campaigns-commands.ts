import { z } from 'zod'
import { segmentRulesArray } from './segment-dsl'

export const campaignChannel = z.enum(['whatsapp','sms','email','push','in_app'])
export const campaignStatus  = z.enum(['draft','scheduled','running','paused','completed','cancelled'])

export const createCampaignInput = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  channel: campaignChannel,
  segment_id: z.string().uuid().optional().nullable(),
  message_template: z.string().trim().min(1).max(10_000),
  subject: z.string().trim().max(300).optional().nullable(),
  scheduled_at: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string().min(6).max(120),
  correlationId: z.string().optional(),
})
export type CreateCampaignInput = z.infer<typeof createCampaignInput>

export const updateCampaignInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  segment_id: z.string().uuid().nullable().optional(),
  message_template: z.string().trim().min(1).max(10_000).optional(),
  subject: z.string().trim().max(300).nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
})
export type UpdateCampaignInput = z.infer<typeof updateCampaignInput>

export const transitionCampaignInput = z.object({
  id: z.string().uuid(),
  next: campaignStatus,
  correlationId: z.string().optional(),
})
export type TransitionCampaignInput = z.infer<typeof transitionCampaignInput>

export const scheduleCampaignInput = z.object({
  id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  correlationId: z.string().optional(),
})
export type ScheduleCampaignInput = z.infer<typeof scheduleCampaignInput>

// Segments
export const upsertSegmentInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  rules: segmentRulesArray,
  combinator: z.enum(['and','or']).default('and'),
})
export type UpsertSegmentInput = z.infer<typeof upsertSegmentInput>

export const recalcSegmentInput = z.object({
  id: z.string().uuid(),
})
export type RecalcSegmentInput = z.infer<typeof recalcSegmentInput>

export const previewSegmentInput = z.object({
  rules: segmentRulesArray,
  combinator: z.enum(['and','or']).default('and'),
  limit: z.number().int().min(1).max(500).default(50),
})
export type PreviewSegmentInput = z.infer<typeof previewSegmentInput>

// Runtime dispatch (start campaign now)
export const startCampaignInput = z.object({
  id: z.string().uuid(),
  idempotencyKey: z.string().min(6).max(120),
  correlationId: z.string().optional(),
})
export type StartCampaignInput = z.infer<typeof startCampaignInput>
