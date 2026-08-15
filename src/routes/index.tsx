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
          'تصفّح آلاف الأدوية ومستحضرات العناية بأسعار معتمدة، مع إرشاد دوائي دقيق وتوصيل سريع من صيدلية المصلي.',
      },
      { property: 'og:title', content: 'صيدلية المصلي — دواؤك يصلك بثقة' },
      {
        property: 'og:description',
        content: 'صيدلية إلكترونية موثوقة: أدوية أصلية، استشارة صيدلي، وتوصيل سريع.',
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
