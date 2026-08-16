import { createFileRoute } from '@tanstack/react-router'
import { Phone, Mail, MapPin, MessageCircle, Clock } from 'lucide-react'
import { PHARMACY } from '@/shared/branding'

export const Route = createFileRoute('/contact')({
  head: () => ({
    meta: [
      { title: `تواصل معنا — ${PHARMACY.nameAr}` },
      { name: 'description', content: `تواصل مع ${PHARMACY.nameAr} عبر الهاتف، واتساب، أو البريد الإلكتروني — ${PHARMACY.addressAr}.` },
      { property: 'og:title', content: `تواصل معنا — ${PHARMACY.nameAr}` },
      { property: 'og:description', content: `اتصل بنا في ${PHARMACY.addressAr}.` },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://muslly.com/contact' },
    ],
    links: [{ rel: 'canonical', href: 'https://muslly.com/contact' }],
  }),
  component: ContactPage,
})

function ContactPage() {
  const waLink = `https://wa.me/${PHARMACY.whatsapp.replace(/\D/g, '')}`
  const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(PHARMACY.addressEn)}&output=embed`

  const cards = [
    { icon: Phone, title: 'الهاتف', value: PHARMACY.phone, href: `tel:${PHARMACY.phone}`, color: 'text-primary' },
    { icon: MessageCircle, title: 'واتساب', value: 'راسلنا مباشرة', href: waLink, color: 'text-green-600' },
    { icon: Mail, title: 'البريد الإلكتروني', value: PHARMACY.email, href: `mailto:${PHARMACY.email}`, color: 'text-primary' },
    { icon: MapPin, title: 'العنوان', value: PHARMACY.addressAr, href: PHARMACY.mapsUrl, color: 'text-primary' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-10">
      <header className="text-center space-y-3">
        <img src={PHARMACY.logo} alt={PHARMACY.nameAr} className="w-20 h-20 mx-auto rounded-2xl bg-primary/5 p-3" />
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">تواصل مع {PHARMACY.nameAr}</h1>
        <p className="text-gray-600">نحن هنا لخدمتك — تواصل معنا في أي وقت.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ icon: Icon, title, value, href, color }) => (
          <a key={title} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
             className="p-5 rounded-2xl border border-gray-200 bg-white hover:shadow-md hover:border-primary/30 transition text-right">
            <Icon className={`w-8 h-8 mb-3 ${color}`} />
            <div className="text-sm text-gray-500 mb-1">{title}</div>
            <div className="font-semibold text-gray-900" dir={title === 'الهاتف' || title === 'البريد الإلكتروني' ? 'ltr' : 'rtl'}>{value}</div>
          </a>
        ))}
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />ساعات العمل</h2>
          <ul className="space-y-2 text-gray-700">
            {PHARMACY.hoursAr.map((h) => (
              <li key={h.day} className="flex justify-between border-b border-primary/10 pb-2">
                <span className="font-medium">{h.day}</span>
                <span className="text-gray-600">{h.time}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl overflow-hidden border border-gray-200 min-h-[280px]">
          <iframe
            title="خريطة صيدلية المصلي"
            src={mapEmbed}
            className="w-full h-full min-h-[280px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </div>
  )
}
