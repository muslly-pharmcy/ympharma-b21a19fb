import { Link } from '@tanstack/react-router'
import { Phone, Mail, MapPin, MessageCircle, Clock } from 'lucide-react'
import { PHARMACY } from '@/shared/branding'
import { GlassLogo } from '@/shared/components/GlassLogo'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-16 border-t border-gray-200/60 bg-white/70 backdrop-blur">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 py-10 grid gap-8 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <GlassLogo src={PHARMACY.logo} alt={PHARMACY.nameAr} className="h-14 w-14" />
            <div className="min-w-0">
              <div className="truncate font-bold text-gray-900">{PHARMACY.nameAr}</div>
              <div className="truncate text-xs text-gray-500">{PHARMACY.nameEn}</div>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{PHARMACY.description}</p>
        </div>


        <div>
          <h3 className="font-semibold text-gray-900 mb-3">روابط سريعة</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><Link to="/about" className="hover:text-primary">من نحن</Link></li>
            <li><Link to="/contact" className="hover:text-primary">تواصل معنا</Link></li>
            <li><Link to="/store" className="hover:text-primary">المتجر</Link></li>
            <li><Link to="/medical-directory" className="hover:text-primary">الدليل الطبي</Link></li>
            <li><Link to="/guides" className="hover:text-primary">الأدلة الدوائية</Link></li>
            <li><Link to="/tools" className="hover:text-primary">الأدوات الطبية</Link></li>
            <li><Link to="/delivery/aden" className="hover:text-primary">توصيل الأدوية في عدن</Link></li>
          </ul>

        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-3">تواصل معنا</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /><a href={`tel:${PHARMACY.phone}`} dir="ltr">{PHARMACY.phone}</a></li>
            <li className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-green-600" /><a href={`https://wa.me/${PHARMACY.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">واتساب</a></li>
            <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /><a href={`mailto:${PHARMACY.email}`} dir="ltr">{PHARMACY.email}</a></li>
            <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-primary mt-0.5" /><a href={PHARMACY.mapsUrl} target="_blank" rel="noreferrer">{PHARMACY.addressAr}</a></li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />ساعات العمل</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            {PHARMACY.hoursAr.map((h) => (
              <li key={h.day} className="flex justify-between gap-3">
                <span>{h.day}</span>
                <span className="text-gray-500">{h.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200/60 py-4 text-center text-xs text-gray-500">
        © {year} {PHARMACY.nameAr} — {PHARMACY.nameEn}. جميع الحقوق محفوظة.
      </div>
    </footer>
  )
}
