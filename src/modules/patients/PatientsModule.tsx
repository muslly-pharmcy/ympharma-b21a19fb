import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { motion } from 'framer-motion'
import { Search, User, Heart, AlertTriangle, FileText, Plus } from 'lucide-react'
import { listModulePatients } from '@/lib/modules.functions'
import { Skeleton } from '@/components/skeletons/Skeleton'

export function PatientsModule() {
  const [searchQuery, setSearchQuery] = useState('')
  const fetchPatients = useServerFn(listModulePatients)
  const { data, isLoading } = useQuery({
    queryKey: ['module', 'patients'],
    queryFn: () => fetchPatients(),
    staleTime: 30_000,
  })
  const patients = data?.items ?? []
  const filtered = patients.filter((p) =>
    p.nameAr?.includes(searchQuery) ||
    p.name?.includes(searchQuery) ||
    p.allergies?.some((a) => a.includes(searchQuery)),
  )

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مريض، حساسية، أو مرض مزمن..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-right"
            />
          </div>
          <button className="px-4 py-2.5 bg-primary text-white rounded-xl font-medium flex items-center gap-2 hover:bg-primary-600 transition-colors">
            <Plus className="w-4 h-4" />
            مريض جديد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>لا يوجد مرضى</p>
          </div>
        ) : (
          filtered.map((patient, i) => (
            <motion.div
              key={patient.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel rounded-2xl p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
                  {patient.gender === 'male' ? '👨' : '👩'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900">{patient.nameAr || patient.name}</h3>
                  <p className="text-sm text-gray-500">
                    {patient.dateOfBirth ? `العمر: ${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} سنة` : 'العمر غير متوفر'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Heart className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs text-gray-500">{patient.bloodType || 'فصيلة غير معروفة'}</span>
                  </div>
                </div>
              </div>
              {patient.allergies.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {patient.allergies.map((allergy, idx) => (
                    <span key={idx} className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded-full">
                      <AlertTriangle className="w-3 h-3 inline ml-1" />
                      {allergy}
                    </span>
                  ))}
                </div>
              )}
              {patient.chronicDiseases.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {patient.chronicDiseases.map((d, idx) => (
                    <span key={idx} className="px-2 py-1 bg-amber-50 text-amber-600 text-xs rounded-full">{d}</span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors">
                  السجل الطبي
                </button>
                <button className="px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors" aria-label="ملف">
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
