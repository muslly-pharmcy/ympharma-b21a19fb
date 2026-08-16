import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { submitMedicalRequest } from '@/lib/medical-requests.functions'
import { PHARMACY } from '@/shared/branding'

export const Route = createFileRoute('/request')({
  head: () => ({
    meta: [
      { title: 'اطلب دواء أو استشارة — صيدلية المصلي' },
      {
        name: 'description',
        content:
          'أرسل طلب دواء أو حجز استشارة صيدلانية من صيدلية المصلي في عدن. سنعاود التواصل معك خلال دقائق.',
      },
      { property: 'og:title', content: 'اطلب دواء أو استشارة — صيدلية المصلي' },
      { property: 'og:description', content: 'طلب دواء أو استشارة صيدلانية عبر الإنترنت.' },
      { property: 'og:url', content: 'https://muslly.com/request' },
    ],
    links: [{ rel: 'canonical', href: 'https://muslly.com/request' }],
  }),
  component: RequestPage,
})

function RequestPage() {
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    request_type: 'medication' as 'medication' | 'consultation' | 'delivery' | 'other',
    note: '',
  })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: () => submitMedicalRequest({ data: form }),
    onError: (e: Error) => setErrorMsg(e.message ?? 'حدث خطأ غير متوقع'),
  })

  const submitted = mut.data?.ok === true

  return (
    <div dir="rtl" className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-3xl border border-primary/15 bg-white/70 p-6 shadow-sm md:p-10">
        <h1 className="text-2xl font-black text-gray-900 md:text-3xl">
          اطلب دواء أو استشارة
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          املأ النموذج وسيتواصل معك فريق {PHARMACY.nameAr} خلال دقائق عبر واتساب أو الاتصال.
        </p>

        {submitted ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl bg-primary/10 p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h2 className="text-lg font-bold text-primary">تم إرسال طلبك بنجاح</h2>
            <p className="text-sm text-gray-700">
              سنعاود التواصل معك على الرقم <b>{form.phone}</b> في أقرب وقت.
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                to="/"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                العودة للرئيسية
              </Link>
              <a
                href={`https://wa.me/${PHARMACY.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary"
              >
                واتساب مباشر
              </a>
            </div>
          </div>
        ) : (
          <form
            className="mt-6 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              setErrorMsg(null)
              mut.mutate()
            }}
          >
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-gray-800">الاسم الكامل *</span>
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:border-primary focus:outline-none"
                placeholder="مثال: محمد أحمد"
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-gray-800">رقم الهاتف / واتساب *</span>
              <input
                required
                minLength={5}
                maxLength={40}
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:border-primary focus:outline-none"
                placeholder="+967 777 000 000"
              />
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-gray-800">نوع الطلب *</span>
              <select
                value={form.request_type}
                onChange={(e) =>
                  setForm({ ...form, request_type: e.target.value as typeof form.request_type })
                }
                className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:border-primary focus:outline-none"
              >
                <option value="medication">طلب دواء</option>
                <option value="consultation">استشارة صيدلانية</option>
                <option value="delivery">توصيل طلب سابق</option>
                <option value="other">استفسار آخر</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-gray-800">
                تفاصيل إضافية <span className="font-normal text-gray-500">(اختياري)</span>
              </span>
              <textarea
                rows={4}
                maxLength={2000}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:border-primary focus:outline-none"
                placeholder="اسم الدواء، الجرعة، الأعراض، عنوان التوصيل..."
              />
            </label>

            {errorMsg && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={mut.isPending}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-60"
            >
              {mut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> إرسال الطلب
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
