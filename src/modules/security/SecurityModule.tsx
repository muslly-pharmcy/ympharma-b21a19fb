import { motion } from 'framer-motion'
import { Shield, Construction, ExternalLink, Lock, Eye } from 'lucide-react'
import { Link } from '@tanstack/react-router'

// R1.2 — F-06 remediation: this dashboard previously rendered hard-coded
// "security status", fake audit logs, fake user counts, and fake RLS policy
// summaries. Those values misled operators into believing the platform was
// monitored when nothing was wired up.
//
// Until a real telemetry backend is connected (audit_events, ai_security_events,
// error_logs, uptime_incidents), this surface deliberately shows only
// verifiable facts and points admins to the real data surfaces.
// See docs/engineering/WAVE-C7-REGRESSION-LOG.md (R1.2).

export function SecurityModule() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-6 border border-amber-200 bg-amber-50/60"
      >
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Construction className="w-5 h-5 text-amber-700" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-gray-900">لوحة الأمن قيد التطوير</h3>
            <p className="text-sm text-gray-700 leading-6">
              هذه الصفحة كانت تعرض بيانات ثابتة غير حقيقية. تم إخفاؤها
              مؤقتاً حتى ربطها بمصادر التتبع الفعلية (سجل التدقيق،
              أحداث الأمان، سجل الأخطاء). لا تعتبر أي رقم أو حالة قديمة
              دليلاً على الوضع الفعلي للنظام.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Verifiable facts only — no counters, no fake logs. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: Shield,
            label: 'Row Level Security',
            body: 'مُفعّل على جداول البيانات الحساسة (المرضى، الطلبات، الملفات الطبية). التحقق يتم على مستوى قاعدة البيانات.',
          },
          {
            icon: Lock,
            label: 'المصادقة',
            body: 'Supabase Auth عبر بوابة Lovable. جلسات المستخدم مُشفَّرة ومحمية بـ bearer token على كل استدعاء server function.',
          },
          {
            icon: Eye,
            label: 'التدقيق',
            body: 'الأحداث الفعلية تُكتب في جداول audit_events و ai_security_events. لا يوجد ملخص واجهة حي بعد.',
          },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="glass-panel rounded-2xl p-5"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <item.icon className="w-5 h-5 text-primary" />
            </div>
            <p className="font-bold text-gray-900 mb-1">{item.label}</p>
            <p className="text-sm text-gray-600 leading-6">{item.body}</p>
          </motion.div>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <h4 className="font-bold text-gray-900 mb-3">مصادر التتبع الحقيقية</h4>
        <p className="text-sm text-gray-600 mb-4">
          للاطلاع على البيانات الفعلية استخدم أدوات الإدارة أدناه — لا تعتمد على
          هذه الصفحة قبل إعادة ربطها.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            to="/ai-runtime"
            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">مراقبة تشغيل الوكلاء (AI Runtime)</span>
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </Link>
        </div>
      </div>
    </div>
  )
}
