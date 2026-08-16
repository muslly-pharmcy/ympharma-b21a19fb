import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { motion } from 'framer-motion'
import { Truck, MapPin, Clock, Phone, Package } from 'lucide-react'
import { listModuleDeliveries } from '@/lib/modules.functions'
import { Skeleton } from '@/components/skeletons/Skeleton'

const statusColors: Record<string, string> = {
  assigned: 'bg-blue-50 text-blue-600',
  picked_up: 'bg-amber-50 text-amber-600',
  in_transit: 'bg-purple-50 text-purple-600',
  delivered: 'bg-green-50 text-green-600',
  failed: 'bg-red-50 text-red-600',
}
const statusLabels: Record<string, string> = {
  assigned: 'تم التعيين',
  picked_up: 'تم الاستلام',
  in_transit: 'في الطريق',
  delivered: 'تم التوصيل',
  failed: 'فشل',
}

export function DeliveryModule() {
  const [status, setStatus] = useState<'all' | 'assigned' | 'in_transit' | 'delivered'>('all')
  const fetchDeliveries = useServerFn(listModuleDeliveries)
  const { data, isLoading } = useQuery({
    queryKey: ['module', 'deliveries', status],
    queryFn: () => fetchDeliveries({ data: { status } }),
    staleTime: 30_000,
  })
  const deliveries = data?.items ?? []
  const warning = data?.warning ?? null

  return (
    <div className="space-y-6">
      {warning && (
        <div className="glass-panel rounded-2xl p-3 bg-amber-50/50 text-amber-800 text-sm">
          {warning}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'الكل', value: deliveries.length, color: 'bg-gray-50 text-gray-600' },
          { label: 'في الطريق', value: deliveries.filter((d) => d.status === 'in_transit').length, color: 'bg-purple-50 text-purple-600' },
          { label: 'تم التوصيل', value: deliveries.filter((d) => d.status === 'delivered').length, color: 'bg-green-50 text-green-600' },
          { label: 'متأخر', value: deliveries.filter((d) => d.status === 'assigned' && new Date(d.createdAt).getTime() < Date.now() - 3600000).length, color: 'bg-red-50 text-red-600' },
        ].map((stat, i) => (
          <div key={i} className={`glass-panel rounded-2xl p-4 ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="flex gap-2">
          {(['all', 'assigned', 'in_transit', 'delivered'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${status === s ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {s === 'all' ? 'الكل' : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : deliveries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Truck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>لا توجد عمليات توصيل</p>
          </div>
        ) : (
          deliveries.map((delivery, i) => (
            <motion.div
              key={delivery.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel rounded-2xl p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Truck className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">طلب #{delivery.orderId?.slice(0, 8)}</p>
                    <p className="text-sm text-gray-500">{new Date(delivery.createdAt).toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[delivery.status] ?? 'bg-gray-50 text-gray-600'}`}>
                  {statusLabels[delivery.status] ?? delivery.status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600"><MapPin className="w-4 h-4 text-gray-400" /><span>الوجهة</span></div>
                <div className="flex items-center gap-2 text-sm text-gray-600"><Clock className="w-4 h-4 text-gray-400" /><span>{delivery.estimatedTime ? new Date(delivery.estimatedTime).toLocaleTimeString('ar-SA') : 'غير محدد'}</span></div>
                <div className="flex items-center gap-2 text-sm text-gray-600"><Phone className="w-4 h-4 text-gray-400" /><span>السائق</span></div>
              </div>
              {delivery.notes && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl text-sm text-amber-700">
                  <Package className="w-4 h-4 inline ml-1" />
                  {delivery.notes}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
