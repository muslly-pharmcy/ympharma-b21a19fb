import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { listCampaigns, listSegments } from '@/lib/campaigns.functions'
import { createCampaign, transitionCampaign, startCampaign } from '@/lib/campaigns.mutations.functions'
import type { CampaignChannel } from '@/domain/crm/campaigns-schemas'

export const Route = createFileRoute('/_authenticated/campaigns')({
  component: CampaignsPage,
  head: () => ({ meta: [{ title: 'الحملات — MUSLLY' }] }),
  errorComponent: ({ error }) => <div className="p-6 text-red-500">فشل التحميل: {(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">غير موجود</div>,
})

function CampaignsPage() {
  const [status, setStatus] = useState<'all'|'draft'|'scheduled'|'running'|'paused'|'completed'|'cancelled'>('all')
  const list = useQuery({ queryKey: ['campaigns', status], queryFn: () => listCampaigns({ data: { status } }) })
  const segs = useQuery({ queryKey: ['segments-lite'], queryFn: () => listSegments() })
  const create = useServerFn(createCampaign)
  const trans = useServerFn(transitionCampaign)
  const start = useServerFn(startCampaign)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<{ name: string; channel: CampaignChannel; message_template: string; subject: string; segment_id: string; scheduled_at: string }>({
    name: '', channel: 'whatsapp', message_template: '', subject: '', segment_id: '', scheduled_at: '',
  })

  const createMut = useMutation({
    mutationFn: () => create({ data: {
      name: form.name.trim(), channel: form.channel,
      message_template: form.message_template.trim(),
      subject: form.subject.trim() || null,
      segment_id: form.segment_id || null,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      idempotencyKey: `cmp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    } }),
    onSuccess: () => { setShowNew(false); setForm({ name: '', channel: 'whatsapp', message_template: '', subject: '', segment_id: '', scheduled_at: '' }); list.refetch() },
  })

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📣 الحملات التسويقية</h1>
          <p className="text-sm text-slate-400">CRM D3 — Campaigns & Segmentation</p>
        </div>
        <div className="flex gap-2">
          <Link to="/segments" className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2">🎯 الشرائح</Link>
          <button onClick={() => setShowNew((v) => !v)} className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2">
            {showNew ? 'إلغاء' : '+ حملة جديدة'}
          </button>
        </div>
      </header>

      {showNew && (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <input placeholder="الاسم *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as CampaignChannel })} className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2">
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="push">Push</option>
              <option value="in_app">In-App</option>
            </select>
            <select value={form.segment_id} onChange={(e) => setForm({ ...form, segment_id: e.target.value })} className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2">
              <option value="">الجميع (بدون شريحة)</option>
              {(segs.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.member_count})</option>)}
            </select>
            {form.channel === 'email' && (
              <input placeholder="عنوان البريد" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
            )}
            <input type="datetime-local" placeholder="جدولة" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
          </div>
          <textarea rows={3} placeholder="نص الرسالة (يدعم {{name}}, {{phone}}, {{email}})" value={form.message_template} onChange={(e) => setForm({ ...form, message_template: e.target.value })} className="w-full rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2" />
          {createMut.isError && <div className="text-red-300 text-sm">{(createMut.error as Error).message}</div>}
          <button disabled={!form.name || !form.message_template || createMut.isPending} onClick={() => createMut.mutate()} className="rounded-lg bg-emerald-500 disabled:opacity-40 text-slate-950 font-semibold px-4 py-2">
            {createMut.isPending ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(['all','draft','scheduled','running','paused','completed','cancelled'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-sm ${status === s ? 'bg-emerald-500 text-slate-950 font-semibold' : 'bg-slate-800/70 border border-white/10'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="text-right px-4 py-2">الكود</th>
              <th className="text-right px-4 py-2">الاسم</th>
              <th className="text-right px-4 py-2">القناة</th>
              <th className="text-right px-4 py-2">الحالة</th>
              <th className="text-right px-4 py-2">الجمهور</th>
              <th className="text-right px-4 py-2">مرسل / فشل</th>
              <th className="text-right px-4 py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-4 py-2 font-mono text-emerald-300">
                  <Link to="/campaigns/$id" params={{ id: c.id }}>{c.code}</Link>
                </td>
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2">{c.channel}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    c.status === 'running' ? 'bg-blue-500/20 text-blue-300' :
                    c.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                    c.status === 'scheduled' ? 'bg-amber-500/20 text-amber-300' :
                    c.status === 'paused' ? 'bg-orange-500/20 text-orange-300' :
                    c.status === 'cancelled' ? 'bg-red-500/20 text-red-300' :
                    'bg-slate-500/20 text-slate-300'
                  }`}>{c.status}</span>
                </td>
                <td className="px-4 py-2">{c.audience_size.toLocaleString('ar-EG')}</td>
                <td className="px-4 py-2 text-slate-400">{c.sent_count} / <span className="text-red-300">{c.failed_count}</span></td>
                <td className="px-4 py-2 space-x-1 space-x-reverse">
                  {(c.status === 'draft' || c.status === 'scheduled' || c.status === 'paused') && (
                    <button onClick={async () => { await start({ data: { id: c.id, idempotencyKey: `start-${c.id}-${Date.now()}` } }); list.refetch() }}
                      className="text-xs bg-emerald-500 text-slate-950 font-semibold px-2 py-1 rounded">تشغيل</button>
                  )}
                  {c.status === 'running' && (
                    <button onClick={async () => { await trans({ data: { id: c.id, next: 'paused' } }); list.refetch() }}
                      className="text-xs bg-orange-500 text-slate-950 font-semibold px-2 py-1 rounded">إيقاف مؤقت</button>
                  )}
                  {['draft','scheduled','paused','running'].includes(c.status) && (
                    <button onClick={async () => { await trans({ data: { id: c.id, next: 'cancelled' } }); list.refetch() }}
                      className="text-xs bg-red-500/70 text-white px-2 py-1 rounded">إلغاء</button>
                  )}
                </td>
              </tr>
            ))}
            {list.isSuccess && (list.data ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">لا توجد حملات بعد</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
