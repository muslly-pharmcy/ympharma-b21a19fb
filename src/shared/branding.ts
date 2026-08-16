import almoslyLogo from '@/assets/almosly-logo-optimized.webp'

// Central pharmacy branding — single source of truth for name, logo, and contact info.
export const PHARMACY = {
  nameAr: 'صيدلية المصلي',
  nameEn: 'Almosly Pharmacy',

  tagline: 'رعاية دوائية ذكية في عدن',
  taglineEn: 'Smart pharmaceutical care in Aden',
  description:
    'صيدلية المصلي — رعاية دوائية موثوقة في عدن مع مساعد ذكاء صناعي، صرف الوصفات، وتوصيل الأدوية.',
  logo: almoslyLogo,
  phone: '+967 782 878 280',
  whatsapp: '+967782878280',
  whatsappUrl: 'https://wa.me/967782878280',
  email: 'info@muslly.com',
  facebookUrl: 'https://business.facebook.com/latest/home/?asset_id=1170639849472726&business_id=2157569191654292',
  addressAr: 'كريتر — عدن، اليمن',
  addressEn: 'Crater — Aden, Yemen',
  mapsUrl: 'https://maps.google.com/?q=Aden+Crater+Al+Musalli+Pharmacy',
  hoursAr: [
    { day: 'السبت – الخميس', time: '8:00 صباحاً – 11:00 مساءً' },
    { day: 'الجمعة', time: '4:00 عصراً – 11:00 مساءً' },
  ],
} as const
