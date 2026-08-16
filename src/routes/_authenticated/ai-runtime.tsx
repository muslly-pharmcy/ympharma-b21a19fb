import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { invokeAgent, listAgents, listRuns } from '@/lib/ai.functions'

export const Route = createFileRoute('/_authenticated/ai-runtime')({
  component: AiRuntimePage,
  head: () => ({ meta: [{ title: 'AI Runtime — MUSLLY' }] }),
  errorComponent: ({ error }) => (
    <div className="p-6 text-red-500">فشل تحميل الصفحة: {(error as Error).message}</div>
  ),
  notFoundComponent: () => <div className="p-6">غير موجود</div>,
})

function AiRuntimePage() {
  const router = useRouter()
  const agentsQ = useQuery({ queryKey: ['air', 'agents'], queryFn: () => listAgents() })
  const runsQ = useQuery({ queryKey: ['air', 'runs'], queryFn: () => listRuns({ data: { limit: 25 } }) })
  const invoke = useServerFn(invokeAgent)

  const agents = agentsQ.data ?? []
  const runs = runsQ.data ?? []
  const [selected, setSelected] = useState<string>('')
  const [input, setInput] = useState('')
  const [productQuery, setProductQuery] = useState('')

  const currentKey = selected || agents[0]?.key || ''
  const current = agents.find((a) => a.key === currentKey)
  const usesProductSearch = current?.allowed_tools.includes('search_products')

  const mut = useMutation({
    mutationFn: async () => {
      const toolInputs: Record<string, Record<string, unknown>> = {}
      if (usesProductSearch && productQuery.trim()) {
        toolInputs.search_products = { query: productQuery.trim() }
      }
      return invoke({ data: { agentKey: currentKey, input, toolInputs } })
    },
    onSuccess: () => {
      runsQ.refetch()
      router.invalidate()
    },
  })

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">🧠 محرك الذكاء الاصطناعي</h1>
        <p className="text-sm text-slate-400">Phase 5 — Agent Runtime، Prompt Registry، Tool Registry</p>
      </header>

      {agentsQ.isLoading && <p className="text-slate-400">جارٍ تحميل الوكلاء...</p>}
      {agentsQ.isError && <p className="text-red-400">فشل التحميل: {(agentsQ.error as Error).message}</p>}

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5 space-y-4">
          <h2 className="text-lg font-semibold">تشغيل وكيل</h2>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">الوكيل</span>
            <select
              value={currentKey}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2"
            >
              {agents.map((a) => (
                <option key={a.key} value={a.key}>{a.display_name}</option>
              ))}
            </select>
            {current?.description && <p className="text-xs text-slate-400">{current.description}</p>}
            {current && (
              <p className="text-xs text-slate-500">
                الأدوات المسموحة: {current.allowed_tools.join('، ') || 'لا شيء'}
              </p>
            )}
          </label>

          {usesProductSearch && (
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">بحث منتج (اختياري)</span>
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="اسم المنتج..."
                className="w-full rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2"
              />
            </label>
          )}

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">السؤال / التعليمات</span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={5}
              placeholder="اكتب سؤالك للوكيل..."
              className="w-full rounded-lg bg-slate-800/70 border border-white/10 px-3 py-2"
            />
          </label>

          <button
            onClick={() => mut.mutate()}
            disabled={!currentKey || !input.trim() || mut.isPending}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-semibold py-2.5 transition"
          >
            {mut.isPending ? 'جارٍ التشغيل...' : 'تشغيل الوكيل'}
          </button>

          {mut.isError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 p-3 text-sm">
              {(mut.error as Error).message}
            </div>
          )}

          {mut.data && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-2">
              <div className="text-xs text-emerald-300">
                Run {mut.data.runId.slice(0, 8)} • {mut.data.latencyMs}ms
                {mut.data.totalTokens ? ` • ${mut.data.totalTokens} tok` : ''}
                {mut.data.toolsUsed.length > 0 && ` • أدوات: ${mut.data.toolsUsed.join(', ')}`}
              </div>
              <pre className="whitespace-pre-wrap text-sm text-slate-100">{mut.data.output}</pre>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5 space-y-3">
          <h2 className="text-lg font-semibold">آخر التشغيلات</h2>
          <div className="max-h-[600px] overflow-y-auto space-y-2">
            {runs.length === 0 && <p className="text-sm text-slate-400">لا توجد تشغيلات بعد</p>}
            {runs.map((r) => (
              <details key={r.id} className="rounded-lg bg-slate-800/40 border border-white/5 p-3">
                <summary className="cursor-pointer flex items-center justify-between text-sm">
                  <span className="font-medium">{r.agent_key}</span>
                  <span className={`text-xs ${r.status === 'success' ? 'text-emerald-400' : r.status === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                    {r.status} • {new Date(r.created_at).toLocaleString('ar-EG')}
                  </span>
                </summary>
                <div className="mt-2 space-y-2 text-xs text-slate-300">
                  <div><span className="text-slate-500">Input:</span> {r.input}</div>
                  {r.output && <div className="whitespace-pre-wrap"><span className="text-slate-500">Output:</span> {r.output}</div>}
                  {r.error_message && <div className="text-red-300">Error: {r.error_message}</div>}
                  <div className="text-slate-500">
                    {r.model} • {r.latency_ms ?? '?'}ms • {r.total_tokens ?? '?'} tok
                    {r.tools_used?.length ? ` • tools: ${r.tools_used.join(', ')}` : ''}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
