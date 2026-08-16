export type CampaignStatus = 'draft'|'scheduled'|'running'|'paused'|'completed'|'cancelled'
export type CampaignChannel = 'whatsapp'|'sms'|'email'|'push'|'in_app'
export type CampaignEventKind = 'queued'|'sent'|'delivered'|'opened'|'clicked'|'bounced'|'failed'|'unsubscribed'
export type RecipientStatus = 'pending'|'sent'|'delivered'|'failed'|'skipped'

// JSON-safe shapes for the RPC boundary.
export interface SerializableRule {
  op: string
  days?: number
  value?: string | number
}
export type SerializableMeta = Record<string, string | number | boolean | null>

export interface Campaign {
  id: string
  organization_id: string
  code: string
  name: string
  description: string | null
  channel: CampaignChannel
  segment_id: string | null
  message_template: string
  subject: string | null
  status: CampaignStatus
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  audience_size: number
  sent_count: number
  delivered_count: number
  failed_count: number
  created_at: string
  updated_at: string
}

export interface Segment {
  id: string
  organization_id: string
  code: string
  name: string
  description: string | null
  rules: SerializableRule[]
  combinator: 'and' | 'or'
  is_dynamic: boolean
  member_count: number
  last_recalculated_at: string | null
  created_at: string
  updated_at: string
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  customer_id: string
  channel: CampaignChannel
  address: string | null
  status: RecipientStatus
  sent_at: string | null
  error: string | null
  created_at: string
}

export interface CampaignEvent {
  id: string
  campaign_id: string
  recipient_id: string | null
  customer_id: string | null
  kind: CampaignEventKind
  channel: CampaignChannel | null
  provider_ref: string | null
  metadata: SerializableMeta
  occurred_at: string
}
