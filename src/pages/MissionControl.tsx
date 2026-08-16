import { motion } from 'framer-motion'
import { useAI } from '@/context/AIContext'
import { 
  Cpu, MemoryStick, Activity, Zap, Users, Package, 
  TrendingUp, AlertTriangle, CheckCircle, Clock, Brain,
  Server, Database, Wifi, Shield
} from 'lucide-react'

export default function MissionControl() {
  const { agents, events } = useAI()

  const systemStats = [
    { label: 'CPU Usage', value: '34%', icon: Cpu, color: 'text-blue-600', bg: 'bg-blue-50', bar: 'bg-blue-500' },
    { label: 'Memory', value: '62%', icon: MemoryStick, color: 'text-purple-600', bg: 'bg-purple-50', bar: 'bg-purple-500' },
    { label: 'Network', value: '89%', icon: Wifi, color: 'text-green-600', bg: 'bg-green-50', bar: 'bg-green-500' },
    { label: 'Storage', value: '45%', icon: Database, color: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-500' },
  ]

  const kpiCards = [
    { label: 'إجمالي الإيرادات', value: '1,250,000', unit: 'ر.ي', change: '+12%', trend: 'up', icon: TrendingUp },
    { label: 'الطلبات اليوم', value: '156', unit: '', change: '+8%', trend: 'up', icon: Package },
    { label: 'العملاء النشطين', value: '2,847', unit: '', change: '+5%', trend: 'up', icon: Users },
    { label: 'التنبيهات الحرجة', value: '3', unit: '', change: '-2', trend: 'down', icon: AlertTriangle },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface-dark text-white">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">مركز القيادة</h1>
              <p className="text-sm text-gray-400">Mission Control — مراقبة النظام في الوقت الفعلي</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi, i) => (
            <motion.div
              key={i}
              className="glass-panel rounded-2xl p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center">
                  <kpi.icon className="w-5 h-5 text-primary" />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  kpi.trend === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {kpi.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-xs text-gray-500">{kpi.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Stats */}
          <motion.div 
            className="glass-panel rounded-2xl p-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              حالة النظام
            </h3>
            <div className="space-y-4">
              {systemStats.map((stat, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <stat.icon className={`w-4 h-4 ${stat.color}`} />
                      <span className="text-sm text-gray-600">{stat.label}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{stat.value}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${stat.bar} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: stat.value }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Active Agents */}
          <motion.div 
            className="glass-panel rounded-2xl p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-gold" />
              الوكلاء النشطين
            </h3>
            <div className="space-y-3">
              {agents.map(agent => (
                <div key={agent.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-xl">{agent.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{agent.nameAr}</p>
                    <p className="text-xs text-gray-500">{agent.tasksCompleted.toLocaleString()} مهمة</p>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    agent.status === 'active' ? 'bg-green-500 animate-pulse' :
                    agent.status === 'busy' ? 'bg-amber-500' :
                    agent.status === 'idle' ? 'bg-blue-400' : 'bg-gray-400'
                  }`} />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Events */}
          <motion.div 
            className="glass-panel rounded-2xl p-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              آخر الأحداث
            </h3>
            <div className="space-y-3 max-h-[320px] overflow-y-auto">
              {events.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Clock className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">لا توجد أحداث حالياً</p>
                </div>
              ) : (
                events.slice(0, 10).map(event => (
                  <div key={event.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      event.priority === 'critical' ? 'bg-red-500' :
                      event.priority === 'high' ? 'bg-amber-500' :
                      event.priority === 'medium' ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{event.type}</p>
                      <p className="text-xs text-gray-500 truncate">{event.source}</p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* Security Status */}
        <motion.div 
          className="glass-panel rounded-2xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold text-gray-900">حالة الأمن</h3>
            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full font-medium">آمن</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'RLS', status: 'مفعل', ok: true },
              { label: 'RBAC', status: 'مفعل', ok: true },
              { label: 'Encryption', status: 'AES-256', ok: true },
              { label: 'Audit Log', status: 'يسجل', ok: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <CheckCircle className={`w-4 h-4 ${item.ok ? 'text-green-500' : 'text-red-500'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.status}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
