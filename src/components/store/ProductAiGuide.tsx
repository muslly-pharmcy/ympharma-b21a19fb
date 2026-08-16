import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Sparkles, Loader2 } from 'lucide-react'
import { getProductAiGuide } from '@/lib/ai/gemini-product-descriptions.functions'

const SECTIONS = [
  { key: 'indications', label: 'دواعي الاستخدام' },
  { key: 'dosage', label: 'الجرعة وطريقة الاستعمال' },
  { key: 'ingredients', label: 'المكوّنات' },
  { key: 'benefits', label: 'الفوائد' },
  { key: 'precautions', label: 'تحذيرات واحتياطات' },
] as const

export function ProductAiGuide({ productId }: { productId: string }) {
  const fn = useServerFn(getProductAiGuide)
  const { data, isLoading } = useQuery({
    queryKey: ['storefront', 'product', productId, 'ai-guide'],
    queryFn: () => fn({ data: { productId } }),
    staleTime: 60 * 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحضير الدليل الدوائي…
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
        <Sparkles className="h-4 w-4" /> الدليل الدوائي
      </h2>
      {data.summary && (
        <p className="text-sm leading-6 text-gray-700">{data.summary}</p>
      )}
      {SECTIONS.map(({ key, label }) => {
        const items = data[key]
        if (!items || items.length === 0) return null
        return (
          <div key={key}>
            <h3 className="text-xs font-semibold text-gray-900">{label}</h3>
            <ul className="mt-1 list-disc space-y-1 pr-5 text-sm leading-6 text-gray-700">
              {items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </div>
        )
      })}
      <p className="text-[11px] text-gray-500">
        هذه المعلومات إرشادية ولا تُغني عن استشارة الطبيب أو الصيدلي.
      </p>
    </div>
  )
}
