import { useParams, useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { getPlanetById } from '@/data/planets'
import { ArrowRight, Home, Settings, BarChart3, FileText, Users } from 'lucide-react'
import { useState, lazy, Suspense } from 'react'
import LoadingSpinner from '@/shared/components/LoadingSpinner'

// Lazy load all modules (named exports → normalize to default)
const PharmacyModule = lazy(() => import('@/modules/pharmacy/PharmacyModule').then(m => ({ default: m.PharmacyModule })))
const InventoryModule = lazy(() => import('@/modules/inventory/InventoryModule').then(m => ({ default: m.InventoryModule })))
const DoctorsModule = lazy(() => import('@/modules/doctors/DoctorsModule').then(m => ({ default: m.DoctorsModule })))
const PatientsModule = lazy(() => import('@/modules/patients/PatientsModule').then(m => ({ default: m.PatientsModule })))
const FinanceModule = lazy(() => import('@/modules/finance/FinanceModule').then(m => ({ default: m.FinanceModule })))
const DeliveryModule = lazy(() => import('@/modules/delivery/DeliveryModule').then(m => ({ default: m.DeliveryModule })))
const ReportsModule = lazy(() => import('@/modules/reports/ReportsModule').then(m => ({ default: m.ReportsModule })))
const MarketingModule = lazy(() => import('@/modules/marketing/MarketingModule').then(m => ({ default: m.MarketingModule })))
const SecurityModule = lazy(() => import('@/modules/security/SecurityModule').then(m => ({ default: m.SecurityModule })))
const EmergencyModule = lazy(() => import('@/modules/emergency/EmergencyModule').then(m => ({ default: m.EmergencyModule })))
const NationalModule = lazy(() => import('@/modules/national/NationalModule').then(m => ({ default: m.NationalModule })))
const LaboratoryModule = lazy(() => import('@/modules/laboratory/LaboratoryModule').then(m => ({ default: m.LaboratoryModule })))
const InsuranceModule = lazy(() => import('@/modules/insurance/InsuranceModule').then(m => ({ default: m.InsuranceModule })))

const tabs = [
  { id: 'overview', label: 'نظرة عامة', icon: Home },
  { id: 'analytics', label: 'التحليلات', icon: BarChart3 },
  { id: 'reports', label: 'التقارير', icon: FileText },
  { id: 'users', label: 'المستخدمين', icon: Users },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
]

const moduleMap: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  pharmacy: PharmacyModule,
  inventory: InventoryModule,
  doctors: DoctorsModule,
  patients: PatientsModule,
  finance: FinanceModule,
  delivery: DeliveryModule,
  reports: ReportsModule,
  ceo: ReportsModule,
  marketing: MarketingModule,
  medical: PharmacyModule,
  hospitals: DoctorsModule,
  laboratory: LaboratoryModule,
  emergency: EmergencyModule,
  insurance: InsuranceModule,
  security: SecurityModule,
  national: NationalModule,
}

export default function PlanetPage() {
  const { planetId } = useParams({ strict: false }) as { planetId?: string }
  const navigate = useNavigate()
  const planet = getPlanetById(planetId || '')
  const [activeTab, setActiveTab] = useState('overview')

  if (!planet) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-300 mb-4">404</h1>
          <p className="text-gray-500 mb-6">الكوكب غير موجود</p>
          <button onClick={() => navigate({ to: '/' })} className="btn-primary">
            العودة للرئيسية
          </button>
        </div>
      </div>
    )
  }

  const ModuleComponent = moduleMap[planet.module]

  return (
    <div className="min-h-screen bg-background">
      <motion.div
        className="relative overflow-hidden"
        style={{ backgroundColor: `${planet.color}08` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-8">
          <button
            onClick={() => navigate({ to: '/' })}
            className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors mb-4"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="text-sm">العودة للكون</span>
          </button>

          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ backgroundColor: `${planet.color}20` }}
            >
              {planet.icon}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{planet.nameAr}</h1>
              <p className="text-gray-500">{planet.description}</p>
            </div>
          </div>

          <p className="mt-5 text-xs text-gray-500">
            تظهر المؤشرات التشغيلية هنا بعد ربط مصدر البيانات الفعلي.
          </p>
        </div>
      </motion.div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'overview' && ModuleComponent && (
            <Suspense fallback={<LoadingSpinner text="جاري تحميل الوحدة..." />}>
              <ModuleComponent />
            </Suspense>
          )}

          {activeTab === 'overview' && !ModuleComponent && (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">نظرة عامة</h3>
              <p className="text-gray-500">هذه الوحدة قيد التطوير</p>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">التحليلات</h3>
              <p className="text-gray-500">سيتم عرض الرسوم البيانية والتحليلات هنا</p>
            </div>
          )}

          {activeTab === 'reports' && (
            <Suspense fallback={<LoadingSpinner text="جاري تحميل التقارير..." />}>
              <ReportsModule />
            </Suspense>
          )}

          {activeTab === 'users' && (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">المستخدمين</h3>
              <p className="text-gray-500">سيتم عرض قائمة المستخدمين هنا</p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">الإعدادات</h3>
              <p className="text-gray-500">سيتم عرض إعدادات الكوكب هنا</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
