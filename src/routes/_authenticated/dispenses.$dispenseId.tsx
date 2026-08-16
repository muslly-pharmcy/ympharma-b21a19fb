import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, ShieldCheck, Truck, XCircle, CheckCircle2, RotateCcw, ScanLine } from 'lucide-react'
import { getDispense } from '@/lib/dispenses.functions'
import {
  prepareDispense, verifyDispense, dispensePrescription, completeDispense,
  cancelDispense, returnDispense, verifyDispenseItemBarcode,
} from '@/lib/dispenses.mutations.functions'

export const Route = createFileRoute('/_authenticated/dispenses/$dispenseId')({
  head: () => ({ meta: [{ title: 'تفاصيل الصرف — MUSLLY AI OS' }] }),
  component: DispenseDetailPage,
  errorComponent: ({ error }) => <div className="p-8 text-center text-red-600">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة', prepared: 'مُحضّرة', verified: 'مُتحقق منها',
  dispensed: 'مصروفة', completed: 'مكتملة', returned: 'مُرتجعة', cancelled: 'ملغاة',
}

function DispenseDetailPage() {
  const { dispenseId } = Route.useParams()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['dispense', dispenseId],
    queryFn: () => getDispense({ data: { id: dispenseId } }),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['dispense', dispenseId] })
    qc.invalidateQueries({ queryKey: ['dispenses'] })
  }

  const [barcodeMap, setBarcodeMap] = useState<Record<string, string>>({})
  const [cancelReason, setCancelReason] = useState('')
  const [returnQty, setReturnQty] = useState<number>(1)
  const [returnReason, setReturnReason] = useState('')

  const prep = useMutation({ mutationFn: () => prepareDispense({ data: { dispenseId } }), onSuccess: invalidate })
  const ver = useMutation({ mutationFn: () => verifyDispense({ data: { dispenseId } }), onSuccess: invalidate })
  const dsp = useMutation({ mutationFn: () => dispensePrescription({ data: { dispenseId } }), onSuccess: invalidate })
  const comp = useMutation({ mutationFn: () => completeDispense({ data: { dispenseId } }), onSuccess: invalidate })
  const canc = useMutation({ mutationFn: () => cancelDispense({ data: { dispenseId, reason: cancelReason } }), onSuccess: invalidate })
  const ret = useMutation({ mutationFn: () => returnDispense({ data: { dispenseId, qty: returnQty, reason: returnReason } }), onSuccess: invalidate })
  const bc = useMutation({
    mutationFn: (v: { itemId: string; value: string }) =>
      verifyDispenseItemBarcode({ data: { dispenseItemId: v.itemId, barcodeValue: v.value } }),
    onSuccess: invalidate,
  })

  if (isLoading || !data) return <div className="p-8 text-center">جارٍ التحميل...</div>
  const { dispense: d, items, history, returns } = data
  const status = d.status
  const mutating = prep.isPending || ver.isPending || dsp.isPending || comp.isPending || canc.isPending || ret.isPending

  return (
    <div dir="rtl" className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/dispenses" className="text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> عودة للقائمة
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{d.dispense_no ?? d.id.slice(0, 8)}</h1>
            <p className="text-sm text-gray-500">
              المريض: <b>{d.patient?.full_name}</b> — MRN: {d.patient?.mrn ?? '—'}
            </p>
            <p className="text-sm text-gray-500">
              الوصفة: <Link to="/prescriptions/$prescriptionId" params={{ prescriptionId: d.prescription_id }} className="text-blue-600 hover:underline">
                {d.prescription?.prescription_no ?? d.prescription_id.slice(0, 8)}
              </Link>
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>

        <div className="flex gap-2 flex-wrap pt-4">
          {status === 'draft' && (
            <button onClick={() => prep.mutate()} disabled={mutating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> تحضير وحجز مخزون (FEFO)
            </button>
          )}
          {status === 'prepared' && (
            <button onClick={() => ver.mutate()} disabled={mutating}
              className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> تحقق (فحوصات السلامة + الباركود)
            </button>
          )}
          {status === 'verified' && (
            <button onClick={() => dsp.mutate()} disabled={mutating}
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              <Truck className="w-4 h-4" /> صرف (خصم المخزون)
            </button>
          )}
          {status === 'dispensed' && (
            <button onClick={() => comp.mutate()} disabled={mutating}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> إكمال
            </button>
          )}
        </div>

        {(status === 'draft' || status === 'prepared' || status === 'verified') && (
          <div className="mt-4 flex gap-2 items-center">
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
              placeholder="سبب الإلغاء..." className="flex-1 px-3 py-2 border rounded" />
            <button onClick={() => canc.mutate()} disabled={mutating || cancelReason.length < 2}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> إلغاء
            </button>
          </div>
        )}

        {(status === 'dispensed' || status === 'completed') && (
          <div className="mt-4 flex gap-2 items-center">
            <input type="number" min={1} value={returnQty} onChange={(e) => setReturnQty(Number(e.target.value))}
              className="w-24 px-3 py-2 border rounded" />
            <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
              placeholder="سبب الإرجاع..." className="flex-1 px-3 py-2 border rounded" />
            <button onClick={() => ret.mutate()} disabled={mutating || returnReason.length < 2 || returnQty <= 0}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> إرجاع
            </button>
          </div>
        )}

        {(prep.error || ver.error || dsp.error || canc.error || ret.error || comp.error || bc.error) && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 rounded text-sm">
            {(prep.error || ver.error || dsp.error || canc.error || ret.error || comp.error || bc.error)?.message}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold mb-3">أصناف الصرف</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-right">الدواء</th>
              <th className="px-3 py-2 text-right">المطلوب</th>
              <th className="px-3 py-2 text-right">المصروف</th>
              <th className="px-3 py-2 text-right">الحجز</th>
              <th className="px-3 py-2 text-right">الباركود</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="px-3 py-2">{it.medication_name}</td>
                <td className="px-3 py-2">{it.qty_requested}</td>
                <td className="px-3 py-2">{it.qty_dispensed}</td>
                <td className="px-3 py-2 font-mono text-xs">{it.reservation_id?.slice(0, 8) ?? '—'}</td>
                <td className="px-3 py-2">
                  {it.barcode_verified ? (
                    <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {it.barcode_value}</span>
                  ) : status === 'prepared' && it.product_id ? (
                    <div className="flex gap-1">
                      <input
                        value={barcodeMap[it.id] ?? ''}
                        onChange={(e) => setBarcodeMap({ ...barcodeMap, [it.id]: e.target.value })}
                        placeholder="امسح الباركود"
                        className="px-2 py-1 border rounded text-xs w-32"
                      />
                      <button
                        onClick={() => bc.mutate({ itemId: it.id, value: barcodeMap[it.id] ?? '' })}
                        disabled={!barcodeMap[it.id]}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs flex items-center gap-1 disabled:opacity-50"
                      >
                        <ScanLine className="w-3 h-3" /> تحقق
                      </button>
                    </div>
                  ) : <span className="text-gray-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {returns.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold mb-3">المرتجعات</h2>
          <ul className="space-y-1 text-sm">
            {returns.map((r) => (
              <li key={r.id} className="flex justify-between border-b pb-1">
                <span>الكمية: {r.qty} — السبب: {r.reason}</span>
                <span className="text-gray-500 text-xs">{new Date(r.created_at).toLocaleString('ar-SA')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold mb-3">سجل الحالات</h2>
        <ol className="space-y-1 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between border-b pb-1">
              <span>{h.from_status ?? '—'} → <b>{STATUS_LABEL[h.to_status] ?? h.to_status}</b>{h.reason ? ` — ${h.reason}` : ''}</span>
              <span className="text-gray-500 text-xs">{new Date(h.created_at).toLocaleString('ar-SA')}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
