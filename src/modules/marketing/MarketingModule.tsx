import { useState } from 'react'
import { Megaphone, Mail, MessageSquare, Send, Target, TrendingUp } from 'lucide-react'

type CampaignChannel = 'email' | 'sms' | 'whatsapp' | 'social'

export function MarketingModule() {
  const [activeCampaign, setActiveCampaign] = useState<CampaignChannel>('whatsapp')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState('all')
  const [sending, setSending] = useState(false)

  const campaignStats = [
    { label: 'إجمالي الحملات', value: '24', icon: Megaphone, color: 'text-purple-600' },
    { label: 'معدل الفتح', value: '68%', icon: Mail, color: 'text-blue-600' },
    { label: 'معدل النقر', value: '12.5%', icon: Target, color: 'text-green-600' },
    { label: 'التحويلات', value: '156', icon: TrendingUp, color: 'text-gold' },
  ]

  const templates = [
    { id: 1, name: 'عرض خاص', content: '🎉 عرض خاص! خصم 20% على جميع الفيتامينات هذا الأسبوع فقط!', type: 'promotion' },
    { id: 2, name: 'تذكير دواء', content: '⏰ تذكير: حان وقت أخذ دوائك. صحتك تهمنا!', type: 'reminder' },
    { id: 3, name: 'طلب جديد', content: '✅ تم استلام طلبك بنجاح. رقم الطلب: #ORDER_ID', type: 'order' },
    { id: 4, name: 'توصيل', content: '🚚 طلبك في الطريق! وقت التوصيل المتوقع: TIME', type: 'delivery' },
  ]

  const handleSend = async () => {
    setSending(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setSending(false)
    alert('تم إرسال الحملة بنجاح!')
    setMessage('')
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {campaignStats.map((stat, i) => (
          <div key={i} className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Campaign Builder */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          إنشاء حملة جديدة
        </h3>

        <div className="space-y-4">
          {/* Channel Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">قناة التواصل</label>
            <div className="flex gap-2">
              {([
                { id: 'whatsapp', label: 'واتساب', icon: MessageSquare },
                { id: 'sms', label: 'SMS', icon: Send },
                { id: 'email', label: 'بريد', icon: Mail },
                { id: 'social', label: 'سوشيال', icon: Megaphone },
              ] satisfies Array<{ id: CampaignChannel; label: string; icon: typeof Megaphone }>).map(channel => (
                <button
                  key={channel.id}
                  onClick={() => setActiveCampaign(channel.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeCampaign === channel.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/25'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <channel.icon className="w-4 h-4" />
                  {channel.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الجمهور المستهدف</label>
            <select
              value={audience}
              onChange={e => setAudience(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-right"
            >
              <option value="all">جميع العملاء</option>
              <option value="active">العملاء النشطين</option>
              <option value="inactive">العملاء غير النشطين</option>
              <option value="new">العملاء الجدد</option>
              <option value="vip">VIP</option>
            </select>
          </div>

          {/* Templates */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">القوالب الجاهزة</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setMessage(template.content)}
                  className="p-3 bg-gray-50 rounded-xl text-right hover:bg-primary/5 transition-colors text-left"
                >
                  <p className="font-medium text-sm text-gray-900">{template.name}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.content}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الرسالة</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              rows={4}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 text-right resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{message.length} حرف</p>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                إرسال الحملة
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
