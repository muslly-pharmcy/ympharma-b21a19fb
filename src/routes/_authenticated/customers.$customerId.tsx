import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getCustomer } from '@/lib/customers.functions'
import {
  updateCustomer, archiveCustomer,
  addCustomerAddress, addCustomerContact, addCustomerTag, removeCustomerTag,
} from '@/lib/customers.mutations.functions'

export const Route = createFileRoute('/_authenticated/customers/$customerId')({
  component: CustomerDetailPage,
  head: () => ({ meta: [{ title: 'بطاقة العميل — MUSLLY' }] }),
  errorComponent: ({ error }) => (
    <div className="p-6 text-red-500">فشل التحميل: {(error as Error).message}</div>
  ),
  notFoundComponent: () => <div className="p-6">العميل غير موجود</div>,
})

function CustomerDetailPage() {
  const { customerId } = Route.useParams()
  const router = useRouter()
  const q = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomer({ data: { id: customerId } }),
  })

  const update = useServerFn(updateCustomer)
  const archive = useServerFn(archiveCustomer)
  const addAddr = useServerFn(addCustomerAddress)
  const addContact = useServerFn(addCustomerContact)
  const addTag = useServerFn(addCustomerTag)
  const rmTag = useServerFn(removeCustomerTag)

  const [notes, setNotes] = useState('')
  const [addrForm, setAddrForm] = useState({ line1: '', city: '', kind: 'shipping' as const })
  const [contactForm, setContactForm] = useState({ kind: 'phone' as const, value: '' })
  const [tagInput, setTagInput] = useState('')

  const refresh = () => q.refetch()

  const notesMut = useMutation({ mutationFn: () => update({ data: { id: customerId, notes } }), onSuccess: refresh })
  const archiveMut = useMutation({
    mutationFn: () => archive({ data: { id: customerId } }),
    onSuccess: () => { router.navigate({ to: '/customers' }) },
  })
  const addrMut = useMutation({
    mutationFn: () => addAddr({ data: { customerId, kind: addrForm.kind, line1: addrForm.line1.trim(), city: addrForm.city.trim() || null } }),
    onSuccess: () => { setAddrForm({ line1: '', city: '', kind: 'shipping' }); refresh() },
  })
  const contactMut = useMutation({
    mutationFn: () => addContact({ data: { customerId, kind: contactForm.kind, value: contactForm.value.trim() } }),
    onSuccess: () => { setContactForm({ kind: 'phone', value: '' }); refresh() },
  })
  const tagMut = useMutation({
    mutationFn: () => addTag({ data: { customerId, tag: tagInput.trim() } }),
    onSuccess: () => { setTagInput(''); refresh() },
  })

  if (q.isLoading) return <div className="p-6 text-slate-400">جارٍ التحميل...</div>
  if (!q.data) return <div className="p-6 text-slate-400">العميل غير موجود</div>

  const { customer, addresses, contacts, tags } = q.data

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/customers" className="text-sm text-slate-400 hover:text-slate-200">← العودة</Link>
          <h1 className="text-3xl font-bold mt-1">{customer.full_name}</h1>
          <p className="text-emerald-300 font-mono text-sm">{customer.code}</p>
        </div>
        <div className="flex gap-2">
          <span className={`text-xs px-3 py-1 rounded ${
            customer.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
            customer.status === 'archived' ? 'bg-slate-500/20 text-slate-300' :
            'bg-amber-500/20 text-amber-300'
          }`}>{customer.status}</span>
          {customer.status === 'active' && (
            <button
              onClick={() => archiveMut.mutate()}
              disabled={archiveMut.isPending}
              className="rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1 text-sm"
            >أرشفة</button>
          )}
        </div>
      </div>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5 space-y-3">
          <h2 className="text-lg font-semibold">معلومات أساسية</h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-slate-400">الهاتف</dt><dd>{customer.phone ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">البريد</dt><dd>{customer.email ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">مرتبط بمريض</dt><dd>{customer.patient_id ? '✅' : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">تاريخ الإنشاء</dt><dd>{new Date(customer.created_at).toLocaleString('ar-EG')}</dd></div>
          </dl>
          <div className="space-y-2 pt-2">
            <textarea
              rows={3}
              defaultValue={customer.notes ?? ''}
              onBlur={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات..."
              className="w-full rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2 text-sm"
            />
            <button
              disabled={notesMut.isPending}
              onClick={() => notesMut.mutate()}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1 text-sm"
            >حفظ الملاحظات</button>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5 space-y-3">
          <h2 className="text-lg font-semibold">الوسوم</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t.id} className="text-xs bg-purple-500/20 text-purple-200 px-2 py-1 rounded flex items-center gap-1">
                {t.tag}
                <button onClick={() => rmTag({ data: { id: t.id, customerId } }).then(refresh)} className="hover:text-red-300">×</button>
              </span>
            ))}
            {tags.length === 0 && <span className="text-sm text-slate-400">لا توجد وسوم</span>}
          </div>
          <div className="flex gap-2">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              placeholder="وسم جديد..." className="flex-1 rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2 text-sm" />
            <button disabled={!tagInput.trim() || tagMut.isPending} onClick={() => tagMut.mutate()}
              className="rounded-lg bg-purple-500/30 hover:bg-purple-500/50 text-purple-100 px-3 text-sm">إضافة</button>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5 space-y-3">
          <h2 className="text-lg font-semibold">العناوين</h2>
          <ul className="space-y-2 text-sm">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-lg bg-slate-800/40 p-2">
                <div className="text-xs text-slate-400">{a.kind}{a.is_default ? ' • افتراضي' : ''}</div>
                <div>{a.line1}{a.city ? ` — ${a.city}` : ''}</div>
              </li>
            ))}
            {addresses.length === 0 && <li className="text-slate-400">لا توجد عناوين</li>}
          </ul>
          <div className="grid grid-cols-3 gap-2">
            <select value={addrForm.kind} onChange={(e) => setAddrForm({ ...addrForm, kind: e.target.value as 'shipping' })}
              className="rounded-lg bg-slate-800/70 border border-white/10 px-2 py-2 text-sm">
              <option value="shipping">شحن</option>
              <option value="billing">فوترة</option>
              <option value="other">آخر</option>
            </select>
            <input value={addrForm.line1} onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })}
              placeholder="العنوان *" className="rounded-lg bg-slate-800/70 border border-white/10 px-2 py-2 text-sm" />
            <input value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
              placeholder="المدينة" className="rounded-lg bg-slate-800/70 border border-white/10 px-2 py-2 text-sm" />
          </div>
          <button disabled={!addrForm.line1.trim() || addrMut.isPending} onClick={() => addrMut.mutate()}
            className="rounded-lg bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-100 px-3 py-1 text-sm">إضافة عنوان</button>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5 space-y-3">
          <h2 className="text-lg font-semibold">قنوات الاتصال</h2>
          <ul className="space-y-2 text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="rounded-lg bg-slate-800/40 p-2 flex justify-between">
                <span>{c.value}</span>
                <span className="text-xs text-slate-400">{c.kind}{c.is_primary ? ' • أساسي' : ''}</span>
              </li>
            ))}
            {contacts.length === 0 && <li className="text-slate-400">لا توجد قنوات</li>}
          </ul>
          <div className="grid grid-cols-3 gap-2">
            <select value={contactForm.kind} onChange={(e) => setContactForm({ ...contactForm, kind: e.target.value as 'phone' })}
              className="rounded-lg bg-slate-800/70 border border-white/10 px-2 py-2 text-sm">
              <option value="phone">هاتف</option>
              <option value="email">بريد</option>
              <option value="whatsapp">واتساب</option>
              <option value="other">آخر</option>
            </select>
            <input value={contactForm.value} onChange={(e) => setContactForm({ ...contactForm, value: e.target.value })}
              placeholder="القيمة *" className="col-span-2 rounded-lg bg-slate-800/70 border border-white/10 px-2 py-2 text-sm" />
          </div>
          <button disabled={!contactForm.value.trim() || contactMut.isPending} onClick={() => contactMut.mutate()}
            className="rounded-lg bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-100 px-3 py-1 text-sm">إضافة</button>
        </div>
      </section>
    </div>
  )
}
