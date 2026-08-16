/**
 * Academic clinical pharmacology reference tree.
 *
 * System → Class → Mechanism, mapped from active-ingredient / generic-name
 * keywords so any catalogue product can surface a short academic summary
 * without a database round-trip. Presentation-only reference data.
 */

export interface PharmacologyEntry {
  /** Body system, Arabic. */
  system: string
  /** Pharmacological class, Arabic. */
  drugClass: string
  /** Mechanism of action, Arabic (short academic phrasing). */
  mechanism: string
  /** Common therapeutic uses. */
  uses: string[]
  /** Key cautions / notable adverse effects. */
  cautions: string[]
  /** Matching keywords (Arabic + English, lowercase). */
  keywords: string[]
}

export const PHARMACOLOGY_TREE: PharmacologyEntry[] = [
  {
    system: 'الجهاز العصبي — مسكنات وخافضات حرارة',
    drugClass: 'مسكن مركزي / خافض للحرارة (Analgesic–Antipyretic)',
    mechanism:
      'تثبيط ضعيف لإنزيم COX مركزياً في الجهاز العصبي، مما يقلل تخليق البروستاجلاندينات المسؤولة عن الألم ورفع نقطة ضبط الحرارة.',
    uses: ['الألم الخفيف إلى المتوسط', 'خفض الحرارة', 'الصداع وآلام الأسنان'],
    cautions: ['تجاوز 4 غم يومياً يسبب سمّية كبدية', 'الحذر في أمراض الكبد وتناول الكحول'],
    keywords: ['paracetamol', 'acetaminophen', 'باراسيتامول', 'بانادول', 'panadol', 'أسيتامينوفين'],
  },
  {
    system: 'الجهاز العضلي الهيكلي — الالتهاب',
    drugClass: 'مضاد التهاب غير ستيرويدي (NSAID)',
    mechanism:
      'تثبيط إنزيمي COX-1 وCOX-2 فيقلّ إنتاج البروستاجلاندينات، فتنخفض علامات الالتهاب والألم والحرارة.',
    uses: ['آلام المفاصل والعضلات', 'الالتهابات الروماتيزمية', 'آلام الدورة الشهرية'],
    cautions: ['تهيّج وقرحة المعدة', 'الحذر في القصور الكلوي والربو وارتفاع الضغط'],
    keywords: [
      'ibuprofen', 'diclofenac', 'naproxen', 'ketoprofen', 'meloxicam', 'nsaid',
      'ايبوبروفين', 'إيبوبروفين', 'ديكلوفيناك', 'نابروكسين', 'مضاد التهاب',
    ],
  },
  {
    system: 'مكافحة العدوى — البكتيريا',
    drugClass: 'مضاد حيوي بيتا-لاكتام (Beta-lactam)',
    mechanism:
      'الارتباط ببروتينات ربط البنسلين (PBPs) وتثبيط بناء جدار الببتيدوغليكان، مما يؤدي إلى انحلال الخلية البكتيرية.',
    uses: ['التهابات الجهاز التنفسي', 'التهابات الجلد والأنسجة الرخوة', 'التهابات المسالك البولية'],
    cautions: ['فرط الحساسية للبنسلين', 'إكمال الكورس كاملاً لمنع المقاومة'],
    keywords: [
      'amoxicillin', 'ampicillin', 'penicillin', 'cephalexin', 'ceftriaxone', 'cefixime', 'augmentin',
      'أموكسيسيلين', 'أموكسيل', 'أمبيسيلين', 'بنسلين', 'سيفترياكسون', 'سيفيكسيم', 'سيفالكسين', 'روسيفلكس',
    ],
  },
  {
    system: 'مكافحة العدوى — البكتيريا',
    drugClass: 'مضاد حيوي فلوروكينولون (Fluoroquinolone)',
    mechanism:
      'تثبيط إنزيمي DNA gyrase وTopoisomerase IV فيتوقف تضاعف الحمض النووي البكتيري.',
    uses: ['التهابات المسالك البولية', 'التهابات الجهاز الهضمي', 'التهابات تنفسية مقاومة'],
    cautions: ['خطر التهاب/تمزق الأوتار', 'غير مفضل للأطفال والحوامل', 'تجنّب مع مضادات الحموضة'],
    keywords: [
      'ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'norfloxacin',
      'سيبروفلوكساسين', 'سيبروفلكس', 'ليفوفلوكساسين', 'موكسيفلوكساسين',
    ],
  },
  {
    system: 'مكافحة العدوى — البكتيريا',
    drugClass: 'مضاد حيوي ماكروليد (Macrolide)',
    mechanism: 'الارتباط بالوحدة الريبوسومية 50S وتثبيط تخليق البروتين البكتيري.',
    uses: ['التهابات تنفسية', 'بدائل لمن لديهم حساسية البنسلين'],
    cautions: ['اضطرابات هضمية', 'تداخلات دوائية عبر إنزيم CYP3A4'],
    keywords: ['azithromycin', 'clarithromycin', 'erythromycin', 'أزيثرومايسين', 'كلاريثرومايسين', 'إريثرومايسين'],
  },
  {
    system: 'الجهاز الهضمي',
    drugClass: 'مثبط مضخة البروتون (PPI)',
    mechanism: 'تثبيط لا رجعي لمضخة H+/K+-ATPase في الخلايا الجدارية فيقل إفراز حمض المعدة.',
    uses: ['الارتجاع المعدي المريئي', 'قرحة المعدة والاثني عشر', 'الوقاية مع مضادات الالتهاب'],
    cautions: ['نقص B12 والمغنيسيوم عند الاستخدام الطويل', 'يؤخذ قبل الطعام بـ30 دقيقة'],
    keywords: ['omeprazole', 'esomeprazole', 'pantoprazole', 'lansoprazole', 'أوميبرازول', 'إيزوميبرازول', 'بانتوبرازول'],
  },
  {
    system: 'القلب والأوعية الدموية',
    drugClass: 'مثبط الإنزيم المحول للأنجيوتنسين (ACE inhibitor)',
    mechanism: 'منع تحوّل الأنجيوتنسين I إلى II فيقل التضيّق الوعائي وإفراز الألدوستيرون.',
    uses: ['ارتفاع ضغط الدم', 'قصور القلب', 'حماية الكلى في السكري'],
    cautions: ['السعال الجاف', 'ارتفاع البوتاسيوم', 'ممنوع في الحمل'],
    keywords: ['enalapril', 'lisinopril', 'captopril', 'ramipril', 'إنالابريل', 'ليزينوبريل', 'كابتوبريل', 'راميبريل'],
  },
  {
    system: 'القلب والأوعية الدموية',
    drugClass: 'حاصرات مستقبلات بيتا (Beta-blocker)',
    mechanism: 'حصر مستقبلات β الأدرينالية فيقل معدل ضربات القلب والناتج القلبي واستهلاك الأكسجين.',
    uses: ['ارتفاع الضغط', 'الذبحة الصدرية', 'اضطراب النظم', 'بعد الجلطة القلبية'],
    cautions: ['الحذر في الربو', 'عدم الإيقاف المفاجئ', 'قد يخفي أعراض هبوط السكر'],
    keywords: ['atenolol', 'bisoprolol', 'metoprolol', 'propranolol', 'أتينولول', 'بيسوبرولول', 'ميتوبرولول', 'بروبرانولول'],
  },
  {
    system: 'الغدد الصماء — السكري',
    drugClass: 'بيغوانيد (Biguanide)',
    mechanism: 'تقليل إنتاج الجلوكوز الكبدي وزيادة حساسية الأنسجة للإنسولين.',
    uses: ['السكري من النوع الثاني', 'متلازمة تكيس المبايض'],
    cautions: ['اضطرابات هضمية', 'يوقف قبل صبغة الأشعة', 'الحذر في القصور الكلوي'],
    keywords: ['metformin', 'ميتفورمين', 'جلوكوفاج', 'glucophage'],
  },
  {
    system: 'الجهاز التنفسي والحساسية',
    drugClass: 'مضاد هيستامين (H1 antagonist)',
    mechanism: 'حصر مستقبلات H1 فتقل أعراض الحساسية من حكة وعطاس واحتقان.',
    uses: ['حساسية الأنف', 'الشرى والحكة الجلدية', 'حساسية العين'],
    cautions: ['نعاس مع الأجيال القديمة', 'تجنّب القيادة عند الشعور بالخمول'],
    keywords: ['cetirizine', 'loratadine', 'chlorpheniramine', 'desloratadine', 'سيتريزين', 'لوراتادين', 'كلورفينيرامين'],
  },
  {
    system: 'الجلدية والتجميل',
    drugClass: 'مستحضر موضعي / عناية بالبشرة (Topical–Dermocosmetic)',
    mechanism:
      'يعمل موضعياً على طبقات البشرة: ترطيب وإصلاح حاجز الجلد، أو تقشير لطيف، أو حماية من الأشعة فوق البنفسجية بحسب المكوّن الفعّال.',
    uses: ['ترطيب البشرة', 'علاج حب الشباب والتصبغات', 'الحماية من الشمس'],
    cautions: ['اختبار حساسية على منطقة صغيرة أولاً', 'تجنّب ملامسة العين'],
    keywords: [
      'cream', 'lotion', 'serum', 'sunscreen', 'spf', 'retinol', 'niacinamide', 'hyaluronic',
      'كريم', 'مرطب', 'سيروم', 'واقي شمس', 'ريتينول', 'نياسيناميد', 'هيالورونيك', 'غسول', 'بشرة',
    ],
  },
  {
    system: 'التغذية والمكملات',
    drugClass: 'مكمل غذائي / فيتامينات ومعادن',
    mechanism:
      'تعويض نقص العناصر الدقيقة اللازمة كعوامل مساعدة إنزيمية في مسارات الأيض وتكوين الدم والمناعة.',
    uses: ['نقص الفيتامينات والمعادن', 'دعم المناعة', 'فترة الحمل والرضاعة'],
    cautions: ['تجنّب الجرعات الزائدة من الفيتامينات الذائبة في الدهون', 'الحديد يقلل امتصاص بعض المضادات الحيوية'],
    keywords: [
      'vitamin', 'zinc', 'iron', 'calcium', 'folic', 'omega', 'supplement',
      'فيتامين', 'زنك', 'حديد', 'كالسيوم', 'فوليك', 'أوميغا', 'مكمل',
    ],
  },
]

export interface PharmacologyResolvable {
  name_ar?: string | null
  name_en?: string | null
  brand?: string | null
  generic_name?: string | null
  active_ingredients?: string | null
  dosage_form?: string | null
}

/** Best-effort academic classification for a catalogue product. */
export function classifyProduct(p: PharmacologyResolvable): PharmacologyEntry | null {
  const haystack = [
    p.active_ingredients,
    p.generic_name,
    p.name_en,
    p.name_ar,
    p.brand,
    p.dosage_form,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!haystack) return null
  return (
    PHARMACOLOGY_TREE.find((e) => e.keywords.some((k) => haystack.includes(k.toLowerCase()))) ?? null
  )
}
