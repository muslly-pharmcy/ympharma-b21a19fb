// Messaging channel adapters. Each adapter is a thin function that "delivers"
// a message on a given channel. External providers (WhatsApp Business,
// Twilio, SendGrid, FCM, ...) are not wired yet — adapters currently log a
// simulated send. Wiring a real provider is a single-file swap here.
import type { CampaignChannel } from '@/domain/crm/campaigns-schemas'

export interface Recipient {
  customerId: string
  fullName: string
  email: string | null
  phone: string | null
}

export interface DeliveryResult {
  ok: boolean
  address: string | null
  providerRef: string | null
  error?: string
}

function render(template: string, r: Recipient): string {
  return template
    .split('{{name}}').join(r.fullName)
    .split('{{email}}').join(r.email ?? '')
    .split('{{phone}}').join(r.phone ?? '')
}

export type Adapter = (template: string, subject: string | null, r: Recipient) => Promise<DeliveryResult>

async function whatsappAdapter(template: string, _subject: string | null, r: Recipient): Promise<DeliveryResult> {
  if (!r.phone) return { ok: false, address: null, providerRef: null, error: 'missing phone' }
  const msg = render(template, r)
  console.log('[campaign:whatsapp:sim]', r.phone, msg.slice(0, 80))
  return { ok: true, address: r.phone, providerRef: `sim-wa-${crypto.randomUUID().slice(0,8)}` }
}
async function smsAdapter(template: string, _subject: string | null, r: Recipient): Promise<DeliveryResult> {
  if (!r.phone) return { ok: false, address: null, providerRef: null, error: 'missing phone' }
  const msg = render(template, r)
  console.log('[campaign:sms:sim]', r.phone, msg.slice(0, 80))
  return { ok: true, address: r.phone, providerRef: `sim-sms-${crypto.randomUUID().slice(0,8)}` }
}
async function emailAdapter(template: string, subject: string | null, r: Recipient): Promise<DeliveryResult> {
  if (!r.email) return { ok: false, address: null, providerRef: null, error: 'missing email' }
  const msg = render(template, r)
  console.log('[campaign:email:sim]', r.email, '|', subject, '|', msg.slice(0, 80))
  return { ok: true, address: r.email, providerRef: `sim-em-${crypto.randomUUID().slice(0,8)}` }
}
async function pushAdapter(template: string, _subject: string | null, r: Recipient): Promise<DeliveryResult> {
  const msg = render(template, r)
  console.log('[campaign:push:sim]', r.customerId, msg.slice(0, 80))
  return { ok: true, address: r.customerId, providerRef: `sim-push-${crypto.randomUUID().slice(0,8)}` }
}
async function inAppAdapter(template: string, _subject: string | null, r: Recipient): Promise<DeliveryResult> {
  const msg = render(template, r)
  console.log('[campaign:in_app:sim]', r.customerId, msg.slice(0, 80))
  return { ok: true, address: r.customerId, providerRef: `sim-inapp-${crypto.randomUUID().slice(0,8)}` }
}

const REGISTRY: Record<CampaignChannel, Adapter> = {
  whatsapp: whatsappAdapter,
  sms: smsAdapter,
  email: emailAdapter,
  push: pushAdapter,
  in_app: inAppAdapter,
}

export function getAdapter(channel: CampaignChannel): Adapter {
  return REGISTRY[channel]
}
