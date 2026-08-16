import { useState } from 'react'
import { motion } from 'framer-motion'
import { Map, Building2, Users, TrendingUp, Flag } from 'lucide-react'

export function NationalModule() {
  const [, setSelectedGovernorate] = useState('all')

  const governorates = [
    { id: 'aden', name: 'عدن', branches: 3, hospitals: 5, doctors: 45, patients: 2847, status: 'active' },
    { id: 'lahj', name: 'لحج', branches: 1, hospitals: 2, doctors: 12, patients: 456, status: 'active' },
    { id: 'abyan', name: 'أبين', branches: 1, hospitals: 2, doctors: 8, patients: 234, status: 'active' },
    { id: 'taiz', name: 'تعز', branches: 2, hospitals: 4, doctors: 28, patients: 1234, status: 'active' },
    { id: 'ibb', name: 'إب', branches: 1, hospitals: 3, doctors: 15, patients: 678, status: 'active' },
    { id: 'hadramout', name: 'حضرموت', branches: 2, hospitals: 4, doctors: 22, patients: 890, status: 'active' },
    { id: 'hodeidah', name: 'الحديدة', branches: 2, hospitals: 3, doctors: 18, patients: 567, status: 'active' },
    { id: 'marib', name: 'مأرب', branches: 1, hospitals: 2, doctors: 10, patients: 345, status: 'active' },
    { id: 'sanaa', name: 'صنعاء', branches: 4, hospitals: 8, doctors: 67, patients: 4567, status: 'active' },
  ]

  const totalStats = {
    branches: governorates.reduce((sum, g) => sum + g.branches, 0),
    hospitals: governorates.reduce((sum, g) => sum + g.hospitals, 0),
    doctors: governorates.reduce((sum, g) => sum + g.doctors, 0),
    patients: governorates.reduce((sum, g) => sum + g.patients, 0),
  }

  return (
    <div className="space-y-6">
      {/* National Header */}
      <div className="glass-panel rounded-2xl p-6 text-center">
        <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Flag className="w-8 h-8 text-gold" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">المنصة الوطنية</h2>
        <p className="text-gray-500 mt-2">تغطية جميع محافظات الجمهورية اليمنية</p>
      </div>

      {/* Total Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'الفروع', value: totalStats.branches, icon: Building2, color: 'text-blue-600' },
          { label: 'المستشفيات', value: totalStats.hospitals, icon: Map, color: 'text-red-600' },
          { label: 'الأطباء', value: totalStats.doctors, icon: Users, color: 'text-green-600' },
          { label: 'المرضى', value: totalStats.patients.toLocaleString(), icon: TrendingUp, color: 'text-gold' },
        ].map((stat, i) => (
          <div key={i} className="glass-panel rounded-2xl p-5 text-center">
            <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Governorates */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">المحافظات</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {governorates.map((gov, i) => (
            <motion.div
              key={gov.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 border border-gray-100 rounded-xl hover:border-primary/20 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedGovernorate(gov.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">{gov.name}</h4>
                <span className="px-2 py-1 bg-green-50 text-green-600 text-xs rounded-full">
                  {gov.status === 'active' ? 'نشط' : 'قيد الإنشاء'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="font-bold text-sm">{gov.branches}</p>
                  <p className="text-xs text-gray-500">فروع</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="font-bold text-sm">{gov.hospitals}</p>
                  <p className="text-xs text-gray-500">مستشفيات</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="font-bold text-sm">{gov.doctors}</p>
                  <p className="text-xs text-gray-500">أطباء</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="font-bold text-sm">{gov.patients.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">مرضى</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Expansion Plan */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">خطة التوسع</h3>
        <div className="space-y-4">
          {[
            { phase: 'المرحلة الأولى', status: 'مكتمل', progress: 100, items: ['عدن', 'لحج', 'أبين'] },
            { phase: 'المرحلة الثانية', status: 'قيد التنفيذ', progress: 60, items: ['تعز', 'إب', 'حضرموت'] },
            { phase: 'المرحلة الثالثة', status: 'مخطط', progress: 0, items: ['الحديدة', 'مأرب', 'صنعاء'] },
          ].map((phase, i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold text-gray-900">{phase.phase}</p>
                  <p className="text-sm text-gray-500">{phase.items.join(' • ')}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  phase.status === 'مكتمل' ? 'bg-green-50 text-green-600' :
                  phase.status === 'قيد التنفيذ' ? 'bg-amber-50 text-amber-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {phase.status}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    phase.status === 'مكتمل' ? 'bg-green-500' :
                    phase.status === 'قيد التنفيذ' ? 'bg-amber-500' :
                    'bg-gray-400'
                  }`}
                  style={{ width: `${phase.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
