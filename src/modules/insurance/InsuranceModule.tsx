import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Search, Clock, CheckCircle, XCircle } from 'lucide-react'

export function InsuranceModule() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'expired'>('all')

  const policies = [
    { id: 1, patient: 'أحمد محمد', company: 'Yemen Insurance', type: 'صحي', status: 'active', coverage: '80%', expiry: '2026-12-31' },
    { id: 2, patient: 'فاطمة علي', company: 'Tawuniya', type: 'صحي', status: 'pending', coverage: '70%', expiry: '2027-06-30' },
    { id: 3, patient: 'محمد صالح', company: 'Bupa', type: 'صحي', status: 'active', coverage: '90%', expiry: '2026-09-15' },
    { id: 4, patient: 'سارة أحمد', company: 'MedGulf', type: 'صحي', status: 'expired', coverage: '75%', expiry: '2026-01-01' },
  ]

  const filteredPolicies = policies.filter(p => {
    if (filter === 'all') return true
    return p.status === filter
  }).filter(p => 
    p.patient.includes(searchQuery) || p.company.includes(searchQuery)
  )

  const statusColors: Record<string, string> = {
    active: 'bg-green-50 text-green-600',
    pending: 'bg-amber-50 text-amber-600',
    expired: 'bg-red-50 text-red-600',
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي البوليصات', value: '234', icon: Shield, color: 'text-blue-600' },
          { label: 'نشطة', value: '189', icon: CheckCircle, color: 'text-green-600' },
          { label: 'معلقة', value: '34', icon: Clock, color: 'text-amber-600' },
          { label: 'منتهية', value: '11', icon: XCircle, color: 'text-red-600' },
        ].map((stat, i) => (
          <div key={i} className="glass-panel rounded-2xl p-5">
            <stat.icon className={`w-6 h-6 mb-2 ${stat.color}`} />
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث عن بوليصة أو شركة..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-right"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'active', 'pending', 'expired'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'الكل' : f === 'active' ? 'نشطة' : f === 'pending' ? 'معلقة' : 'منتهية'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Policies Table */}
      <div className="glass-panel rounded-2xl p-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">المريض</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">الشركة</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">النوع</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">التغطية</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">الحالة</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">الانتهاء</th>
            </tr>
          </thead>
          <tbody>
            {filteredPolicies.map((policy, i) => (
              <motion.tr
                key={policy.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-900">{policy.patient}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{policy.company}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{policy.type}</td>
                <td className="py-3 px-4 text-sm font-bold text-primary">{policy.coverage}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[policy.status] || 'bg-gray-50 text-gray-600'}`}>
                    {policy.status === 'active' ? 'نشطة' : policy.status === 'pending' ? 'معلقة' : 'منتهية'}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">{policy.expiry}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
