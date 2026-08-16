import { useState } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical, Search, Clock, CheckCircle, AlertTriangle } from 'lucide-react'

export function LaboratoryModule() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'urgent'>('all')

  const tests = [
    { id: 1, patient: 'أحمد محمد', test: 'CBC', status: 'completed', result: 'Normal', date: '2026-07-19', urgent: false },
    { id: 2, patient: 'فاطمة علي', test: 'Blood Sugar', status: 'pending', result: null, date: '2026-07-19', urgent: true },
    { id: 3, patient: 'محمد صالح', test: 'Lipid Profile', status: 'completed', result: 'High LDL', date: '2026-07-18', urgent: false },
    { id: 4, patient: 'سارة أحمد', test: 'Thyroid Function', status: 'pending', result: null, date: '2026-07-19', urgent: false },
    { id: 5, patient: 'خالد عبدالله', test: 'Liver Function', status: 'completed', result: 'Elevated ALT', date: '2026-07-18', urgent: true },
  ]

  const filteredTests = tests.filter(t => {
    if (filter === 'all') return true
    if (filter === 'urgent') return t.urgent
    return t.status === filter
  }).filter(t => 
    t.patient.includes(searchQuery) || t.test.includes(searchQuery)
  )

  const statusColors: Record<string, string> = {
    completed: 'bg-green-50 text-green-600',
    pending: 'bg-amber-50 text-amber-600',
    urgent: 'bg-red-50 text-red-600',
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي التحاليل', value: '456', icon: FlaskConical, color: 'text-purple-600' },
          { label: 'مكتمل', value: '312', icon: CheckCircle, color: 'text-green-600' },
          { label: 'معلق', value: '89', icon: Clock, color: 'text-amber-600' },
          { label: 'عاجل', value: '12', icon: AlertTriangle, color: 'text-red-600' },
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
              placeholder="ابحث عن تحليل أو مريض..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-right"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'pending', 'completed', 'urgent'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'الكل' : f === 'pending' ? 'معلق' : f === 'completed' ? 'مكتمل' : 'عاجل'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tests Table */}
      <div className="glass-panel rounded-2xl p-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">المريض</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">التحليل</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">الحالة</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">النتيجة</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {filteredTests.map((test, i) => (
              <motion.tr
                key={test.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-900">{test.patient}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{test.test}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[test.status] || 'bg-gray-50 text-gray-600'}`}>
                    {test.status === 'completed' ? 'مكتمل' : test.status === 'pending' ? 'معلق' : 'عاجل'}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">{test.result || '—'}</td>
                <td className="py-3 px-4 text-sm text-gray-500">{test.date}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
