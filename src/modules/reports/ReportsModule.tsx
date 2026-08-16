import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, BarChart3, PieChart, TrendingUp, Calendar } from 'lucide-react'

interface ReportTemplate {
  id: string
  name: string
  description: string
  icon: typeof BarChart3
  category: string
  color: string
}

const reportTemplates: ReportTemplate[] = [
  { id: 'sales', name: 'تقرير المبيعات', description: 'إيرادات، أرباح، وتوجهات المبيعات', icon: TrendingUp, category: 'مالي', color: 'text-green-600' },
  { id: 'inventory', name: 'تقرير المخزون', description: 'حالة المخزون، FEFO، والتنبيهات', icon: BarChart3, category: 'عمليات', color: 'text-blue-600' },
  { id: 'doctors', name: 'تقرير الأطباء', description: 'حجوزات، تقييمات، وأداء الأطباء', icon: PieChart, category: 'طبي', color: 'text-purple-600' },
  { id: 'patients', name: 'تقرير المرضى', description: 'زيارات، تشخيصات، ومتابعة المرضى', icon: FileText, category: 'طبي', color: 'text-red-600' },
  { id: 'marketing', name: 'تقرير التسويق', description: 'حملات، تحويلات، وعائد الاستثمار', icon: TrendingUp, category: 'تسويق', color: 'text-amber-600' },
  { id: 'finance', name: 'تقرير مالي شامل', description: 'ميزانية، تدفق نقدي، وتحليل مالي', icon: BarChart3, category: 'مالي', color: 'text-green-600' },
  { id: 'delivery', name: 'تقرير التوصيل', description: 'أوقات، مسارات، وأداء السائقين', icon: PieChart, category: 'عمليات', color: 'text-blue-600' },
  { id: 'ai', name: 'تقرير الذكاء الاصطناعي', description: 'قرارات AI، أداء الوكلاء، والتعلم', icon: FileText, category: 'ذكاء', color: 'text-gold' },
]

export function ReportsModule() {
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [generating, setGenerating] = useState<string | null>(null)

  const generateReport = async (reportId: string) => {
    setGenerating(reportId)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setGenerating(null)
    alert(`تم إنشاء التقرير: ${reportId}`)
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-primary" />
          <div className="flex gap-2">
            {[
              { id: 'day', label: 'اليوم' },
              { id: 'week', label: 'الأسبوع' },
              { id: 'month', label: 'الشهر' },
              { id: 'quarter', label: 'الربع' },
              { id: 'year', label: 'السنة' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedPeriod === p.id
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {reportTemplates.map((report, i) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-panel rounded-2xl p-5 hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center`}>
                <report.icon className={`w-5 h-5 ${report.color}`} />
              </div>
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                {report.category}
              </span>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{report.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{report.description}</p>
            <button
              onClick={() => generateReport(report.id)}
              disabled={generating === report.id}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating === report.id ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  إنشاء التقرير
                </>
              )}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Recent Reports */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">التقارير السابقة</h3>
        <div className="space-y-3">
          {[
            { name: 'تقرير المبيعات - يونيو 2026', date: '2026-06-30', type: 'PDF', size: '2.4 MB' },
            { name: 'تقرير المخزون - Q2 2026', date: '2026-06-15', type: 'Excel', size: '1.8 MB' },
            { name: 'تحليل أداء الأطباء - مايو', date: '2026-05-31', type: 'PDF', size: '3.1 MB' },
          ].map((report, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-gray-900">{report.name}</p>
                  <p className="text-xs text-gray-500">{report.date} • {report.type} • {report.size}</p>
                </div>
              </div>
              <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <Download className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
