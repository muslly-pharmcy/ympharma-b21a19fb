import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'

const TESTIMONIALS = [
  {
    name: 'أم عبدالله',
    city: 'كريتر — عدن',
    rating: 5,
    text: 'خدمة ممتازة وسرعة في التوصيل، وصلني الدواء خلال ساعة والصيدلي أجاب على أسئلتي بكل احترام.',
  },
  {
    name: 'د. خالد الحبيشي',
    city: 'المعلا',
    rating: 5,
    text: 'أعتمد على صيدلية المصلي لصرف وصفات مرضاي — الأصناف أصلية والتسعير شفاف ومطابق للنشرة.',
  },
  {
    name: 'محمد سالم',
    city: 'التواهي',
    rating: 5,
    text: 'ميزة الاستشارة الذكية رائعة! سألت عن جرعة دواء الأطفال وجاء الرد فوري ودقيق.',
  },
  {
    name: 'سارة عبدالرحمن',
    city: 'خور مكسر',
    rating: 4,
    text: 'التطبيق سهل والبحث عن الأدوية ممتاز. أتمنى إضافة المزيد من منتجات العناية بالبشرة.',
  },
  {
    name: 'أبو ياسر',
    city: 'المنصورة',
    rating: 5,
    text: 'أفضل صيدلية في عدن، الأسعار مناسبة والفريق دائماً متعاون خصوصاً في حالات الطوارئ.',
  },
  {
    name: 'رانيا محمد',
    city: 'الشيخ عثمان',
    rating: 5,
    text: 'خدمة التوصيل إلى المنزل غيّرت حياتي — لا حاجة للوقوف في الازدحام مع طفلي.',
  },
]

export default function TestimonialsSection() {
  return (
    <motion.section
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-4 flex items-end justify-between">
        <div className="flex items-center gap-3">
          <Star className="h-5 w-5 fill-gold text-gold" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">آراء عملائنا</h2>
            <p className="text-xs text-gray-500">تجارب حقيقية من عملاء صيدلية المصلي في عدن</p>
          </div>
        </div>
        <Link
          to="/contact"
          className="hidden text-sm font-semibold text-primary hover:underline sm:inline"
        >
          شارك تجربتك ←
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <motion.article
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="relative rounded-2xl border border-primary/10 bg-white/80 p-5 shadow-sm backdrop-blur"
          >
            <Quote className="absolute top-3 left-3 h-6 w-6 text-primary/15" />
            <div className="mb-3 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, s) => (
                <Star
                  key={s}
                  className={
                    s < t.rating
                      ? 'h-4 w-4 fill-gold text-gold'
                      : 'h-4 w-4 text-gray-300'
                  }
                />
              ))}
            </div>
            <p className="mb-4 text-sm leading-relaxed text-gray-700">"{t.text}"</p>
            <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {t.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">{t.city}</p>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </motion.section>
  )
}
