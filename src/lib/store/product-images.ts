/**
 * High-resolution studio-grade pharma & beauty imagery mapping.
 *
 * Products live in the database (thousands of rows), so instead of a static
 * per-product array we resolve every product deterministically to a real
 * photograph based on its own image columns, its name, or its dosage form /
 * category keywords. No product ever falls back to a grey vector icon.
 *
 * All generated URLs request WebP (`fm=webp&auto=format`) and expose a
 * responsive `srcset` so weak connections (Aden metro) download the smallest
 * useful variant.
 */

const U = (id: string, w = 800) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fm=webp&fit=crop&w=${w}&q=68`

/** Responsive widths served to the browser, smallest first. */
export const IMAGE_WIDTHS = [240, 400, 640, 800] as const

/**
 * Build a `srcset` for an Unsplash-style URL that already carries a `w=`
 * query param. Non-matching (e.g. database-hosted) URLs return an empty
 * string so the caller can omit the attribute.
 */
export function buildSrcSet(url: string): string {
  if (!/[?&]w=\d+/.test(url)) return ''
  return IMAGE_WIDTHS.map((w) => `${url.replace(/([?&]w=)\d+/, `$1${w}`)} ${w}w`).join(', ')
}

/** Low-bandwidth default: pick the ~400px variant when available. */
export function lowBandwidthSrc(url: string): string {
  return /[?&]w=\d+/.test(url) ? url.replace(/([?&]w=)\d+/, '$1400') : url
}

export type ProductImageBucket =
  | 'vials'
  | 'tablets'
  | 'syrups'
  | 'skincare'
  | 'haircare'
  | 'makeup'
  | 'vitamins'
  | 'baby'
  | 'devices'
  | 'general'

/** Curated pools: every entry is a real, high-resolution studio photograph. */
export const IMAGE_POOLS: Record<ProductImageBucket, string[]> = {
  // Sterile vials, ampoules, injections
  vials: [
    U('1584362917165-526a968579e8'),
    U('1607619056574-7b8d3ee536b2'),
    U('1612817288484-6f916006741a'),
    U('1631549916768-4119b2e5f926'),
  ],
  // Blister packs, tablets, capsules, antibiotics
  tablets: [
    U('1584308666744-24d5c474f2ae'),
    U('1471864190281-a93a3070b6de'),
    U('1585435557343-3b092031a831'),
    U('1626716493137-b67fe9501e76'),
  ],
  // Amber syrup bottles, suspensions, drops
  syrups: [
    U('1550572017-edd951b55104'),
    U('1603398938378-e54eab446dde'),
    U('1584017911766-d451b3d0e843'),
    U('1608248543803-ba4f8c70ae0b'),
  ],
  // Luxury minimalist cosmeceutical containers — creams, serums, sunscreen
  skincare: [
    U('1556228720-195a672e8a03'),
    U('1571781926291-c477ebfd024b'),
    U('1620916566398-39f1143ab7be'),
    U('1596462502278-27bfdc403348'),
    U('1612817288484-6f916006741a'),
    U('1608248543803-ba4f8c70ae0b'),
  ],
  // Shampoo, conditioner, hair oils & treatments
  haircare: [
    U('1522338242992-e1a54906a8da'),
    U('1526947425960-945c6e72858f'),
    U('1608248597279-f99d160bfcbc'),
    U('1585232004423-244e0e6904e3'),
  ],
  // Makeup, lipstick, fragrance, nail care
  makeup: [
    U('1596462502278-27bfdc403348'),
    U('1512496015851-a90fb38ba796'),
    U('1522335789203-aabd1fc54bc9'),
    U('1571781926291-c477ebfd024b'),
  ],
  // Supplement bottles, capsules, vitamins
  vitamins: [
    U('1585232004423-244e0e6904e3'),
    U('1584308666744-24d5c474f2ae'),
    U('1512069772995-ec65ed45afd6'),
    U('1550572017-4fcdbb59cc32'),
  ],
  // Mother & baby care
  baby: [
    U('1519689680058-324335c77eba'),
    U('1522771930-78848d9293e8'),
    U('1596704017254-9b121068fb31'),
    U('1607453998774-d533f65dac99'),
  ],
  // Devices, thermometers, monitors
  devices: [
    U('1584515933487-779824d29309'),
    U('1581595219315-a187dd40c322'),
    U('1576671081837-49000212a370'),
    U('1512070679279-8988d32161be'),
  ],
  // Generic pharmacy shelf / packaging
  general: [
    U('1587854692152-cbe660dbde88'),
    U('1576602976047-174e57a47881'),
    U('1585435557343-3b092031a831'),
    U('1631549916768-4119b2e5f926'),
  ],
}

/** Explicit overrides for well-known local brands. */
const NAME_OVERRIDES: Array<{ match: string[]; bucket: ProductImageBucket }> = [
  { match: ['روسيفلكس', 'roseflex', 'rocephin', 'ceftriaxone', 'سيفترياكسون'], bucket: 'vials' },
  { match: ['سيبروفلكس', 'ciproflex', 'ciprofloxacin', 'سيبروفلوكساسين'], bucket: 'tablets' },
  { match: ['بانادول', 'panadol', 'paracetamol', 'باراسيتامول'], bucket: 'tablets' },
  { match: ['أموكسيل', 'amoxil', 'amoxicillin', 'أموكسيسيلين'], bucket: 'tablets' },
  { match: ['فيتامين', 'vitamin', 'omega', 'أوميغا', 'zinc', 'زنك'], bucket: 'vitamins' },
  { match: ['vichy', 'فيشي', 'la roche', 'لاروش', 'bioderma', 'بيوديرما', 'cerave', 'سيرافي', 'eucerin', 'يوسيرين'], bucket: 'skincare' },
  { match: ['pantene', 'بانتين', 'head & shoulders', 'هيد اند شولدرز', 'kerastase', 'كيراستاز'], bucket: 'haircare' },
  { match: ['maybelline', 'مايبيلين', 'loreal', 'لوريال', 'nivea', 'نيفيا'], bucket: 'makeup' },
]

const BUCKET_KEYWORDS: Array<{ bucket: ProductImageBucket; words: string[] }> = [
  {
    bucket: 'vials',
    words: [
      'vial', 'ampoule', 'injection', 'injectable', 'iv', 'im',
      'حقن', 'حقنة', 'أمبول', 'امبول', 'فيال', 'وريدي', 'عضلي',
    ],
  },
  {
    bucket: 'haircare',
    words: [
      'shampoo', 'conditioner', 'hair', 'scalp', 'keratin', 'anti-dandruff',
      'شامبو', 'بلسم', 'شعر', 'فروة', 'قشرة', 'كيراتين', 'زيت الشعر', 'تساقط',
    ],
  },
  {
    bucket: 'makeup',
    words: [
      'makeup', 'lipstick', 'mascara', 'foundation', 'perfume', 'fragrance', 'nail', 'eyeliner',
      'مكياج', 'أحمر شفاه', 'احمر شفاه', 'ماسكارا', 'كحل', 'عطر', 'عطور', 'أظافر', 'اظافر', 'مناكير',
    ],
  },
  {
    bucket: 'syrups',
    words: [
      'syrup', 'suspension', 'solution', 'drops', 'elixir', 'oral liquid',
      'شراب', 'معلق', 'محلول', 'قطرة', 'قطرات', 'نقط',
    ],
  },
  {
    bucket: 'skincare',
    words: [
      'cream', 'ointment', 'gel', 'lotion', 'serum', 'sunscreen', 'derma', 'cosmetic',
      'cleanser', 'moisturizer', 'toner', 'micellar', 'spf', 'peeling',
      'كريم', 'مرهم', 'جل', 'لوشن', 'سيروم', 'واقي', 'بشرة', 'تجميل', 'عناية',
      'غسول', 'مرطب', 'تونر', 'ميسيلار', 'تفتيح', 'تقشير', 'حب الشباب',
    ],
  },
  {
    bucket: 'vitamins',
    words: [
      'vitamin', 'supplement', 'mineral', 'omega', 'zinc', 'iron', 'calcium', 'probiotic',
      'فيتامين', 'مكمل', 'مكملات', 'معادن', 'أوميغا', 'زنك', 'حديد', 'كالسيوم',
    ],
  },
  {
    bucket: 'baby',
    words: [
      'baby', 'infant', 'pediatric', 'diaper', 'formula', 'maternity', 'wipes',
      'أطفال', 'طفل', 'رضع', 'حفاض', 'حفاضات', 'حليب', 'الأم', 'حوامل', 'حامل', 'مناديل',
    ],
  },
  {
    bucket: 'devices',
    words: [
      'device', 'thermometer', 'monitor', 'nebulizer', 'glucometer', 'mask', 'bandage',
      'جهاز', 'أجهزة', 'ميزان', 'قياس', 'ضغط', 'سكر', 'كمامة', 'ضمادة',
    ],
  },
  {
    bucket: 'tablets',
    words: [
      'tablet', 'capsule', 'caplet', 'pill', 'sachet', 'powder', 'antibiotic',
      'حبوب', 'أقراص', 'اقراص', 'قرص', 'كبسول', 'كبسولة', 'أكياس', 'مضاد حيوي', 'مسكن',
    ],
  },
]

/** Simple stable hash so a given product always gets the same photo. */
function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

export interface ImageResolvable {
  id?: string | null
  name_ar?: string | null
  name_en?: string | null
  brand?: string | null
  generic_name?: string | null
  dosage_form?: string | null
  category_id?: string | null
  image_url?: string | null
  primary_image_url?: string | null
}

export function resolveBucket(p: ImageResolvable): ProductImageBucket {
  const haystack = [
    p.name_ar, p.name_en, p.brand, p.generic_name, p.dosage_form,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const o of NAME_OVERRIDES) {
    if (o.match.some((m) => haystack.includes(m.toLowerCase()))) return o.bucket
  }
  for (const k of BUCKET_KEYWORDS) {
    if (k.words.some((w) => haystack.includes(w.toLowerCase()))) return k.bucket
  }
  return 'general'
}

/** Resolve the best available real photo for a product. */
export function resolveProductImage(p: ImageResolvable): string {
  const direct = p.primary_image_url || p.image_url
  if (direct && /^https?:\/\//i.test(direct)) return direct

  const bucket = resolveBucket(p)
  const pool = IMAGE_POOLS[bucket]
  const seed = hash(String(p.id ?? p.name_ar ?? p.name_en ?? bucket))
  return pool[seed % pool.length] as string
}

/** Gradient used by the graceful fallback packaging card. */
export function bucketGradient(bucket: ProductImageBucket): string {
  switch (bucket) {
    case 'vials':
      return 'from-sky-500/25 via-cyan-400/20 to-teal-500/25'
    case 'tablets':
      return 'from-emerald-500/25 via-teal-400/20 to-lime-500/20'
    case 'syrups':
      return 'from-amber-500/25 via-orange-400/20 to-rose-400/20'
    case 'skincare':
      return 'from-fuchsia-500/20 via-pink-400/20 to-rose-400/25'
    case 'haircare':
      return 'from-violet-500/20 via-purple-400/20 to-indigo-400/25'
    case 'makeup':
      return 'from-rose-500/25 via-pink-400/20 to-fuchsia-400/25'
    case 'vitamins':
      return 'from-orange-400/25 via-amber-400/20 to-yellow-400/25'
    case 'baby':
      return 'from-pink-400/20 via-sky-300/20 to-indigo-300/25'
    case 'devices':
      return 'from-slate-400/25 via-sky-400/20 to-indigo-400/20'
    default:
      return 'from-emerald-500/20 via-teal-400/20 to-cyan-500/20'
  }
}
