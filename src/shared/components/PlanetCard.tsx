import { motion } from 'framer-motion'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react'
import type { Planet } from '@/types'

interface PlanetCardProps {
  planet: Planet
  index: number
}

export default function PlanetCard({ planet, index }: PlanetCardProps) {
  const navigate = useNavigate()

  return (
    <motion.div
      className="planet-card p-5 group"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={{ y: -4, scale: 1.02 }}
      onClick={() => navigate({ to: '/planet/$planetId', params: { planetId: planet.id } })}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${planet.color}15` }}
        >
          {planet.icon}
        </div>

        {planet.stats && planet.stats.alerts > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            <span className="text-xs font-bold text-red-600">{planet.stats.alerts}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <h3 className="text-lg font-bold text-gray-900 mb-1">{planet.nameAr}</h3>
      <p className="text-sm text-gray-500 mb-4 line-clamp-2">{planet.description}</p>

      {/* Stats */}
      {planet.stats && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <p className="text-lg font-bold text-gray-900">{planet.stats.total.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">الإجمالي</p>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <p className="text-lg font-bold text-green-600">{planet.stats.active}</p>
            <p className="text-[10px] text-green-600">نشط</p>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded-lg">
            <p className="text-lg font-bold text-amber-600">{planet.stats.pending}</p>
            <p className="text-[10px] text-amber-600">معلق</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs text-gray-500">يعمل</span>
        </div>
        <div className="flex items-center gap-1 text-primary group-hover:gap-2 transition-all">
          <span className="text-sm font-medium">الدخول</span>
          <ArrowLeft className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  )
}
