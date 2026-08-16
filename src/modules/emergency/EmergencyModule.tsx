import { useState } from 'react'
import { motion } from 'framer-motion'
import { Phone, Ambulance, AlertTriangle, MapPin, Heart, Siren } from 'lucide-react'

export function EmergencyModule() {
  const [, setEmergencyType] = useState<string | null>(null)

  const emergencyTypes = [
    { id: 'medical', name: 'طوارئ طبية', icon: Heart, color: 'bg-red-500', desc: 'حالة طبية حرجة تتطلب تدخلاً فورياً' },
    { id: 'accident', name: 'حادث مروري', icon: Siren, color: 'bg-amber-500', desc: 'حادث مروري أو إصابة' },
    { id: 'poison', name: 'تسمم', icon: AlertTriangle, color: 'bg-purple-500', desc: 'تسمم غذائي أو دوائي' },
    { id: 'cardiac', name: 'توقف قلب', icon: Heart, color: 'bg-red-600', desc: 'توقف القلب أو الجهاز التنفسي' },
  ]

  const emergencyNumbers = [
    { name: 'طوارئ المستشفى', number: '199', available: true },
    { name: 'إسعاف عدن', number: '191', available: true },
    { name: 'الدفاع المدني', number: '190', available: true },
    { name: 'الشرطة', number: '194', available: true },
  ]

  const handleEmergency = (type: string) => {
    setEmergencyType(type)
    // In production, this would trigger actual emergency protocols
    alert('تم إرسال بلاغ الطوارئ! سيتم التواصل معك فوراً.')
  }

  return (
    <div className="space-y-6">
      {/* Emergency Alert Banner */}
      <div className="bg-red-500 text-white rounded-2xl p-6 text-center">
        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Siren className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">زر الطوارئ</h2>
        <p className="text-red-100">في حالة الطوارئ، اضغط على الزر أدناه فوراً</p>
      </div>

      {/* Emergency Types */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {emergencyTypes.map((type, i) => (
          <motion.button
            key={type.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => handleEmergency(type.id)}
            className={`${type.color} text-white p-6 rounded-2xl text-right hover:opacity-90 transition-opacity`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <type.icon className="w-6 h-6" />
              </div>
              <div className="text-right">
                <h3 className="text-xl font-bold">{type.name}</h3>
                <p className="text-sm opacity-90 mt-1">{type.desc}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Emergency Numbers */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Phone className="w-5 h-5 text-red-500" />
          أرقام الطوارئ
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {emergencyNumbers.map((num, i) => (
            <a
              key={i}
              href={`tel:${num.number}`}
              className="flex items-center justify-between p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{num.name}</p>
                  <p className="text-sm text-gray-500">{num.available ? 'متاح 24/7' : 'غير متاح'}</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-red-600">{num.number}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Nearest Hospitals */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          أقرب المستشفيات
        </h3>
        <div className="space-y-3">
          {[
            { name: 'مستشفى الجمهورية', distance: '1.2 كم', time: '5 دقائق', emergency: true },
            { name: 'مستشفى السعيد', distance: '2.8 كم', time: '12 دقيقة', emergency: true },
            { name: 'مستشفى اليمن السويدي', distance: '4.5 كم', time: '18 دقيقة', emergency: true },
          ].map((hospital, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Ambulance className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{hospital.name}</p>
                  <p className="text-sm text-gray-500">{hospital.distance} • {hospital.time}</p>
                </div>
              </div>
              <span className="px-2 py-1 bg-green-50 text-green-600 text-xs rounded-full font-medium">
                طوارئ
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* First Aid Guide */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          إسعافات أولية
        </h3>
        <div className="space-y-3">
          {[
            { title: 'توقف التنفس', steps: ['اتصل بالإسعاف', 'افتح مجرى الهواء', 'أجرِ التنفس الصناعي'] },
            { title: 'نزيف حاد', steps: ['اضغط على الجرح', 'ارفع المنطقة المصابة', 'لا تزعج الجرح'] },
            { title: 'سكتة قلبية', steps: ['اتصل بالإسعاف', 'ابدأ CPR', 'استخدم AED إن وجد'] },
          ].map((guide, i) => (
            <div key={i} className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <p className="font-bold text-amber-800 mb-2">{guide.title}</p>
              <ol className="list-decimal list-inside text-sm text-amber-700 space-y-1">
                {guide.steps.map((step, j) => (
                  <li key={j}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
