import { createFileRoute } from '@tanstack/react-router'
import Storefront from '@/pages/Storefront'
import { PHARMACY } from '@/shared/branding'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'صيدلية المصلي — توصيل أدوية في عدن' },
      {
        name: 'description',
        content:
          'تصفّح المنتجات المتاحة، وارفع وصفتك للمراجعة، مع تأكيد السعر وموعد التوصيل من صيدلية المصلي.',
      },
      { property: 'og:title', content: 'صيدلية المصلي — دواؤك يصلك بثقة' },
      {
        property: 'og:description',
        content: 'صيدلية إلكترونية لتصفح المنتجات، مراجعة الوصفات، وطلب التوصيل داخل عدن.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://muslly.com/' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [{ rel: 'canonical', href: 'https://muslly.com/' }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Pharmacy',
          name: PHARMACY.nameAr,
          alternateName: PHARMACY.nameEn,
          description: PHARMACY.description,
          url: 'https://muslly.com/',
          telephone: PHARMACY.phone,
          email: PHARMACY.email,
          hasMap: PHARMACY.mapsUrl,
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'كريتر',
            addressLocality: 'عدن',
            addressCountry: 'YE',
          },
          areaServed: { '@type': 'City', name: 'عدن' },
          openingHoursSpecification: [
            {
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: [
                'Saturday',
                'Sunday',
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
              ],
              opens: '08:00',
              closes: '23:00',
            },
            {
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: 'Friday',
              opens: '16:00',
              closes: '23:00',
            },
          ],
        }),
      },
    ],
  }),
  component: Storefront,
})
