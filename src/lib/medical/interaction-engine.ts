/**
 * Offline clinical safety matrix — drug↔drug, drug↔food, and pregnancy /
 * pediatric cautions. Pure typed data + pure functions so it works with zero
 * network cost on weak connections and inside the service worker cache.
 *
 * Clinical scope note: this is a *screening* aid for patients, not a
 * substitute for the pharmacist's review. Every result carries an explicit
 * Arabic recommendation.
 */

export type Severity = 'info' | 'low' | 'moderate' | 'high' | 'critical'

export interface InteractionHit {
  severity: Severity
  kind: 'drug-drug' | 'drug-food' | 'condition'
  title: string
  detail: string
  advice: string
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'خطر حرج',
  high: 'خطورة عالية',
  moderate: 'خطورة متوسطة',
  low: 'خطورة منخفضة',
  info: 'معلومة',
}

export const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-red-50 text-red-600 border-red-200',
  moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  high: 4,
  moderate: 3,
  low: 2,
  info: 1,
}

/** Normalise Arabic/Latin free text to a comparable token. */
export function normalizeTerm(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Canonical ingredient keys with their Arabic + brand synonyms. */
export const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  warfarin: ['warfarin', 'وارفارين', 'مارevan', 'ماريفان'],
  aspirin: ['aspirin', 'asa', 'اسبرين', 'اسبيرين', 'حمض الساليسيليك'],
  ibuprofen: ['ibuprofen', 'ايبوبروفين', 'بروفين', 'brufen', 'advil'],
  diclofenac: ['diclofenac', 'ديكلوفيناك', 'فولتارين', 'voltaren'],
  paracetamol: ['paracetamol', 'acetaminophen', 'باراسيتامول', 'بنادول', 'panadol', 'adol'],
  metformin: ['metformin', 'ميتفورمين', 'جلوكوفاج', 'glucophage'],
  ciprofloxacin: ['ciprofloxacin', 'سيبروفلوكساسين', 'سيبرو', 'cipro'],
  levofloxacin: ['levofloxacin', 'ليفوفلوكساسين', 'ليفوكسين'],
  doxycycline: ['doxycycline', 'دوكسيسيكلين', 'دوكسي'],
  tetracycline: ['tetracycline', 'تتراسيكلين'],
  amoxicillin: ['amoxicillin', 'اموكسيسيلين', 'اموكسيل', 'amoxil'],
  azithromycin: ['azithromycin', 'ازيثرومايسين', 'زيثروماكس', 'zithromax'],
  simvastatin: ['simvastatin', 'سيمفاستاتين', 'زوكور'],
  atorvastatin: ['atorvastatin', 'اتورفاستاتين', 'ليبيتور', 'lipitor'],
  amlodipine: ['amlodipine', 'املوديبين', 'نورفاسك'],
  lisinopril: ['lisinopril', 'ليزينوبريل', 'كابتوبريل', 'captopril', 'enalapril'],
  losartan: ['losartan', 'لوسارتان', 'كوزار'],
  spironolactone: ['spironolactone', 'سبيرونولاكتون', 'الداكتون', 'aldactone'],
  digoxin: ['digoxin', 'ديجوكسين', 'لانوكسين'],
  levothyroxine: ['levothyroxine', 'ليفوثيروكسين', 'الثيروكسين', 'eltroxin'],
  omeprazole: ['omeprazole', 'اوميبرازول', 'لوسيك', 'esomeprazole', 'ايزوميبرازول'],
  clopidogrel: ['clopidogrel', 'كلوبيدوجريل', 'بلافيكس', 'plavix'],
  tramadol: ['tramadol', 'ترامادول'],
  codeine: ['codeine', 'كودايين', 'كودئين'],
  sertraline: ['sertraline', 'سيرترالين', 'زولوفت'],
  fluoxetine: ['fluoxetine', 'فلوكستين', 'بروزاك'],
  alprazolam: ['alprazolam', 'البرازولام', 'زاناكس', 'diazepam', 'ديازيبام'],
  prednisolone: ['prednisolone', 'بريدنيزولون', 'كورتيزون', 'dexamethasone', 'ديكساميثازون'],
  salbutamol: ['salbutamol', 'سالبوتامول', 'فنتولين', 'ventolin', 'albuterol'],
  insulin: ['insulin', 'انسولين'],
  iron: ['ferrous', 'iron', 'حديد', 'فيروز'],
  calcium: ['calcium', 'كالسيوم'],
  isotretinoin: ['isotretinoin', 'ايزوتريتينوين', 'روكتان', 'roaccutane'],
}

/** Map a free-text medicine/ingredient string to a canonical key, if known. */
export function canonicalIngredient(raw: string): string | null {
  const term = normalizeTerm(raw)
  if (!term) return null
  for (const [key, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
    if (synonyms.some((s) => term.includes(normalizeTerm(s)))) return key
  }
  return null
}

interface PairRule {
  a: string
  b: string
  severity: Severity
  detail: string
  advice: string
}

const DRUG_DRUG: PairRule[] = [
  {
    a: 'warfarin', b: 'aspirin', severity: 'critical',
    detail: 'الجمع بين الوارفارين والأسبرين يضاعف خطر النزيف الحاد.',
    advice: 'لا تجمع بينهما إلا بأمر طبيب مع مراقبة INR — راجع الصيدلي فوراً.',
  },
  {
    a: 'warfarin', b: 'ibuprofen', severity: 'critical',
    detail: 'مضادات الالتهاب غير الستيرويدية ترفع خطر نزيف المعدة مع الوارفارين.',
    advice: 'استبدل المسكّن بالباراسيتامول واستشر الصيدلي.',
  },
  {
    a: 'warfarin', b: 'azithromycin', severity: 'high',
    detail: 'المضادات الحيوية الماكروليدية قد ترفع تأثير الوارفارين وقيمة INR.',
    advice: 'راقب علامات النزيف واطلب فحص INR خلال أيام.',
  },
  {
    a: 'aspirin', b: 'ibuprofen', severity: 'moderate',
    detail: 'الإيبوبروفين يقلّل التأثير الوقائي للأسبرين على القلب ويزيد تهيّج المعدة.',
    advice: 'افصل بين الجرعتين ساعتين على الأقل أو استبدل بالباراسيتامول.',
  },
  {
    a: 'ibuprofen', b: 'diclofenac', severity: 'high',
    detail: 'جمع مضادّي التهاب غير ستيرويديين يرفع خطر القرحة والفشل الكلوي.',
    advice: 'استخدم دواءً واحداً فقط من هذه المجموعة.',
  },
  {
    a: 'ibuprofen', b: 'lisinopril', severity: 'moderate',
    detail: 'مضادات الالتهاب تضعف مفعول أدوية الضغط وقد ترفع الكرياتينين.',
    advice: 'راقب الضغط، واستخدم الباراسيتامول عند الحاجة للمسكّن.',
  },
  {
    a: 'simvastatin', b: 'azithromycin', severity: 'high',
    detail: 'خطر ارتفاع تركيز الستاتين وحدوث اعتلال عضلي (Rhabdomyolysis).',
    advice: 'أبلغ الطبيب عن أي ألم عضلي شديد أو بول داكن.',
  },
  {
    a: 'ciprofloxacin', b: 'calcium', severity: 'moderate',
    detail: 'الكالسيوم يرتبط بالسيبروفلوكساسين ويمنع امتصاصه.',
    advice: 'افصل بينهما ساعتين قبل أو ٦ ساعات بعد المضاد الحيوي.',
  },
  {
    a: 'ciprofloxacin', b: 'iron', severity: 'moderate',
    detail: 'الحديد يقلّل امتصاص الكينولونات بشكل كبير.',
    advice: 'افصل بين الجرعتين ساعتين على الأقل.',
  },
  {
    a: 'doxycycline', b: 'calcium', severity: 'moderate',
    detail: 'الكالسيوم والحليب يقلّلان امتصاص التتراسيكلينات.',
    advice: 'تناول الدواء على معدة فارغة بعيداً عن الألبان.',
  },
  {
    a: 'levothyroxine', b: 'iron', severity: 'moderate',
    detail: 'الحديد يمنع امتصاص هرمون الغدة الدرقية.',
    advice: 'خذ الثيروكسين صباحاً على الريق واترك ٤ ساعات قبل الحديد.',
  },
  {
    a: 'levothyroxine', b: 'omeprazole', severity: 'low',
    detail: 'تقليل حموضة المعدة قد يقلّل امتصاص الثيروكسين.',
    advice: 'حافظ على توقيت ثابت وراقب نتائج TSH.',
  },
  {
    a: 'metformin', b: 'prednisolone', severity: 'moderate',
    detail: 'الكورتيزون يرفع سكر الدم ويضعف السيطرة عليه.',
    advice: 'راقب السكر يومياً خلال فترة الكورتيزون.',
  },
  {
    a: 'digoxin', b: 'spironolactone', severity: 'high',
    detail: 'ارتفاع تركيز الديجوكسين وخطر اضطراب النظم.',
    advice: 'يلزم متابعة مستوى الديجوكسين والبوتاسيوم.',
  },
  {
    a: 'lisinopril', b: 'spironolactone', severity: 'high',
    detail: 'خطر ارتفاع البوتاسيوم (فرط بوتاسيوم الدم).',
    advice: 'افحص البوتاسيوم دورياً وتجنّب بدائل الملح.',
  },
  {
    a: 'tramadol', b: 'sertraline', severity: 'high',
    detail: 'خطر متلازمة السيروتونين (رجفة، تشوّش، تسارع نبض).',
    advice: 'أبلغ الطبيب فوراً عند ظهور الأعراض.',
  },
  {
    a: 'tramadol', b: 'alprazolam', severity: 'critical',
    detail: 'جمع مهدّئ مع مسكّن أفيوني يثبّط التنفس.',
    advice: 'لا يُستخدم معاً إلا بإشراف طبي مباشر.',
  },
  {
    a: 'fluoxetine', b: 'aspirin', severity: 'moderate',
    detail: 'مضادات الاكتئاب SSRI مع الأسبرين ترفع خطر نزيف الجهاز الهضمي.',
    advice: 'ناقش وقاية المعدة مع الصيدلي.',
  },
  {
    a: 'clopidogrel', b: 'omeprazole', severity: 'moderate',
    detail: 'الأوميبرازول يقلّل تفعيل الكلوبيدوجريل.',
    advice: 'يُفضَّل استخدام بانتوبرازول بديلاً.',
  },
  {
    a: 'isotretinoin', b: 'doxycycline', severity: 'high',
    detail: 'خطر ارتفاع الضغط داخل الجمجمة (Pseudotumor cerebri).',
    advice: 'لا تجمع بينهما — راجع طبيب الجلدية.',
  },
]

interface FoodRule {
  drug: string
  severity: Severity
  food: string
  detail: string
  advice: string
}

const DRUG_FOOD: FoodRule[] = [
  { drug: 'simvastatin', food: 'الجريب فروت', severity: 'high',
    detail: 'الجريب فروت يرفع تركيز الستاتين في الدم بشكل خطير.', advice: 'امتنع عن الجريب فروت طوال فترة العلاج.' },
  { drug: 'atorvastatin', food: 'الجريب فروت', severity: 'moderate',
    detail: 'قد يرفع تركيز الدواء وأعراض الألم العضلي.', advice: 'قلّل الجريب فروت واستبدله بحمضيات أخرى.' },
  { drug: 'amlodipine', food: 'الجريب فروت', severity: 'moderate',
    detail: 'قد يزيد انخفاض الضغط والدوخة.', advice: 'تجنّب عصير الجريب فروت.' },
  { drug: 'doxycycline', food: 'الألبان', severity: 'moderate',
    detail: 'الكالسيوم في الحليب يمنع امتصاص الدواء.', advice: 'تناوله قبل الأكل بساعة أو بعده بساعتين بلا ألبان.' },
  { drug: 'tetracycline', food: 'الألبان', severity: 'moderate',
    detail: 'ارتباط بالكالسيوم يقلّل الفاعلية.', advice: 'ابتعد عن الحليب والزبادي حول موعد الجرعة.' },
  { drug: 'ciprofloxacin', food: 'الألبان', severity: 'moderate',
    detail: 'منتجات الألبان تقلّل امتصاص الكينولونات.', advice: 'افصل ساعتين قبل أو ٦ ساعات بعد.' },
  { drug: 'levothyroxine', food: 'الطعام عموماً / القهوة', severity: 'moderate',
    detail: 'الطعام والقهوة يقلّلان امتصاص هرمون الغدة.', advice: 'خذه على الريق قبل الفطور بـ٣٠–٦٠ دقيقة.' },
  { drug: 'warfarin', food: 'الخضروات الورقية (فيتامين K)', severity: 'high',
    detail: 'تغيّر كمية فيتامين K يغيّر فاعلية الوارفارين.', advice: 'حافظ على كمية ثابتة يومياً ولا تكثر فجأة.' },
  { drug: 'metformin', food: 'الصيام الطويل', severity: 'moderate',
    detail: 'الصيام مع الميتفورمين قد يسبب اضطراباً هضمياً وهبوط سكر عند الجمع مع أدوية أخرى.', advice: 'تناوله مع وجبة الإفطار أو السحور.' },
  { drug: 'insulin', food: 'الصيام', severity: 'high',
    detail: 'خطر هبوط السكر الحاد أثناء الصيام.', advice: 'لا تعدّل الجرعة ذاتياً — راجع الطبيب قبل الصيام.' },
  { drug: 'ibuprofen', food: 'المعدة الفارغة', severity: 'moderate',
    detail: 'يزيد تهيّج المعدة والقرحة.', advice: 'تناوله دائماً بعد الأكل.' },
  { drug: 'aspirin', food: 'المعدة الفارغة', severity: 'moderate',
    detail: 'خطر نزيف وتهيّج المعدة.', advice: 'تناوله بعد الطعام مع كوب ماء كامل.' },
  { drug: 'iron', food: 'الشاي والقهوة', severity: 'low',
    detail: 'التانين يقلّل امتصاص الحديد.', advice: 'خذ الحديد مع فيتامين C وابتعد عن الشاي ساعتين.' },
  { drug: 'alprazolam', food: 'الكحول', severity: 'critical',
    detail: 'تثبيط شديد للجهاز العصبي والتنفس.', advice: 'ممنوع تماماً.' },
  { drug: 'tramadol', food: 'الكحول', severity: 'critical',
    detail: 'خطر توقف التنفس.', advice: 'ممنوع تماماً.' },
]

interface ConditionRule {
  drug: string
  condition: string[]
  severity: Severity
  detail: string
  advice: string
}

const DRUG_CONDITION: ConditionRule[] = [
  { drug: 'ibuprofen', condition: ['قرحة', 'معده', 'معدة', 'كلى', 'كلي', 'ضغط'], severity: 'high',
    detail: 'مضادات الالتهاب غير مناسبة لمرضى القرحة أو الكلى أو الضغط غير المنضبط.',
    advice: 'استخدم الباراسيتامول بدلاً منه.' },
  { drug: 'diclofenac', condition: ['قلب', 'جلطه', 'جلطة', 'كلى', 'كلي'], severity: 'high',
    detail: 'يرفع خطر الأحداث القلبية الوعائية.', advice: 'راجع الطبيب قبل الاستخدام.' },
  { drug: 'salbutamol', condition: ['قلب', 'رجفان', 'غده', 'غدة'], severity: 'moderate',
    detail: 'قد يسبب تسارع نبض ورجفة.', advice: 'استخدم أقل جرعة فعّالة وراقب النبض.' },
  { drug: 'prednisolone', condition: ['سكر', 'سكري', 'ضغط', 'هشاشة'], severity: 'high',
    detail: 'الكورتيزون يرفع السكر والضغط ويُضعف العظام.', advice: 'مراقبة دقيقة وعدم إيقافه فجأة.' },
  { drug: 'metformin', condition: ['كلى', 'كلي', 'فشل كلوي'], severity: 'high',
    detail: 'خطر الحماض اللبني عند ضعف وظائف الكلى.', advice: 'يلزم تقييم وظائف الكلى قبل الاستخدام.' },
  { drug: 'isotretinoin', condition: ['حمل', 'حامل'], severity: 'critical',
    detail: 'مشوّه شديد للأجنة — ممنوع أثناء الحمل.', advice: 'يلزم وسيلة منع حمل مؤكدة وإشراف طبي.' },
  { drug: 'doxycycline', condition: ['حمل', 'حامل', 'رضاعه', 'رضاعة'], severity: 'high',
    detail: 'غير مناسب للحوامل والأطفال دون ٨ سنوات.', advice: 'اطلب بديلاً آمناً من الصيدلي.' },
  { drug: 'aspirin', condition: ['ربو', 'قرحة', 'قرحه'], severity: 'high',
    detail: 'قد يحرّض نوبة ربو أو نزيفاً هضمياً.', advice: 'تجنّبه واستشر الصيدلي.' },
]

function pairKey(a: string, b: string) {
  return [a, b].sort().join('|')
}

export interface SafetyContext {
  /** Medicine / ingredient names the patient is taking or buying. */
  medicines: string[]
  /** Free-text chronic conditions from the family health profile. */
  conditions?: string[]
  /** Free-text allergies from the family health profile. */
  allergies?: string[]
}

/** Run the full offline safety matrix. Results are sorted worst-first. */
export function screenSafety(ctx: SafetyContext): InteractionHit[] {
  const canon = Array.from(
    new Set(ctx.medicines.map(canonicalIngredient).filter((v): v is string => Boolean(v))),
  )
  const hits: InteractionHit[] = []
  const seen = new Set<string>()

  // drug ↔ drug
  for (const rule of DRUG_DRUG) {
    if (canon.includes(rule.a) && canon.includes(rule.b)) {
      const key = `dd:${pairKey(rule.a, rule.b)}`
      if (seen.has(key)) continue
      seen.add(key)
      hits.push({
        severity: rule.severity,
        kind: 'drug-drug',
        title: `${labelOf(rule.a)} + ${labelOf(rule.b)}`,
        detail: rule.detail,
        advice: rule.advice,
      })
    }
  }

  // drug ↔ food
  for (const rule of DRUG_FOOD) {
    if (!canon.includes(rule.drug)) continue
    const key = `df:${rule.drug}:${rule.food}`
    if (seen.has(key)) continue
    seen.add(key)
    hits.push({
      severity: rule.severity,
      kind: 'drug-food',
      title: `${labelOf(rule.drug)} مع ${rule.food}`,
      detail: rule.detail,
      advice: rule.advice,
    })
  }

  // drug ↔ chronic condition / allergy
  const profileTerms = [...(ctx.conditions ?? []), ...(ctx.allergies ?? [])].map(normalizeTerm)
  for (const rule of DRUG_CONDITION) {
    if (!canon.includes(rule.drug)) continue
    const matched = rule.condition.find((c) => profileTerms.some((t) => t.includes(normalizeTerm(c))))
    if (!matched) continue
    hits.push({
      severity: rule.severity,
      kind: 'condition',
      title: `${labelOf(rule.drug)} مع حالة: ${matched}`,
      detail: rule.detail,
      advice: rule.advice,
    })
  }

  // direct allergy match against the medicine list
  for (const allergy of ctx.allergies ?? []) {
    const a = normalizeTerm(allergy)
    if (!a) continue
    const clash = ctx.medicines.find((m) => normalizeTerm(m).includes(a))
    if (clash) {
      hits.push({
        severity: 'critical',
        kind: 'condition',
        title: `تحسّس مسجّل: ${allergy}`,
        detail: `المنتج «${clash}» يطابق حساسية مسجّلة في الملف الصحي.`,
        advice: 'لا تستخدمه — تواصل مع الصيدلي لبديل آمن.',
      })
    }
  }

  return hits.sort((x, y) => SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity])
}

const ARABIC_LABELS: Record<string, string> = {
  warfarin: 'وارفارين', aspirin: 'أسبرين', ibuprofen: 'إيبوبروفين', diclofenac: 'ديكلوفيناك',
  paracetamol: 'باراسيتامول', metformin: 'ميتفورمين', ciprofloxacin: 'سيبروفلوكساسين',
  levofloxacin: 'ليفوفلوكساسين', doxycycline: 'دوكسيسيكلين', tetracycline: 'تتراسيكلين',
  amoxicillin: 'أموكسيسيلين', azithromycin: 'أزيثرومايسين', simvastatin: 'سيمفاستاتين',
  atorvastatin: 'أتورفاستاتين', amlodipine: 'أملوديبين', lisinopril: 'مثبطات الإنزيم المحوّل',
  losartan: 'لوسارتان', spironolactone: 'سبيرونولاكتون', digoxin: 'ديجوكسين',
  levothyroxine: 'ليفوثيروكسين', omeprazole: 'أوميبرازول', clopidogrel: 'كلوبيدوجريل',
  tramadol: 'ترامادول', codeine: 'كودايين', sertraline: 'سيرترالين', fluoxetine: 'فلوكستين',
  alprazolam: 'مهدّئات البنزوديازيبين', prednisolone: 'كورتيزون', salbutamol: 'سالبوتامول',
  insulin: 'إنسولين', iron: 'حديد', calcium: 'كالسيوم', isotretinoin: 'أيزوتريتينوين',
}

export function labelOf(key: string): string {
  return ARABIC_LABELS[key] ?? key
}

/* -------------------------------------------------------------------------- */
/* Pediatric dosing                                                            */
/* -------------------------------------------------------------------------- */

export interface PediatricDrug {
  key: string
  labelAr: string
  /** mg per kg per single dose. */
  mgPerKgDose: number
  maxSingleMg: number
  maxDailyMgPerKg: number
  everyHours: number
  /** Common syrup concentrations: mg per 5 mL. */
  concentrations: Array<{ label: string; mgPer5ml: number }>
  minAgeMonths: number
  note: string
}

export const PEDIATRIC_DRUGS: PediatricDrug[] = [
  {
    key: 'paracetamol',
    labelAr: 'باراسيتامول (خافض حرارة ومسكّن)',
    mgPerKgDose: 15,
    maxSingleMg: 1000,
    maxDailyMgPerKg: 60,
    everyHours: 6,
    concentrations: [
      { label: 'شراب 120 مغ / 5 مل', mgPer5ml: 120 },
      { label: 'شراب 250 مغ / 5 مل', mgPer5ml: 250 },
    ],
    minAgeMonths: 2,
    note: 'لا تتجاوز ٤ جرعات في اليوم، ولا تجمعه مع أدوية زكام تحتوي الباراسيتامول.',
  },
  {
    key: 'ibuprofen',
    labelAr: 'إيبوبروفين (خافض حرارة ومضاد التهاب)',
    mgPerKgDose: 10,
    maxSingleMg: 400,
    maxDailyMgPerKg: 40,
    everyHours: 8,
    concentrations: [
      { label: 'شراب 100 مغ / 5 مل', mgPer5ml: 100 },
      { label: 'شراب 200 مغ / 5 مل', mgPer5ml: 200 },
    ],
    minAgeMonths: 6,
    note: 'يُعطى بعد الأكل، ويُتجنّب مع الجفاف أو القيء الشديد.',
  },
  {
    key: 'amoxicillin',
    labelAr: 'أموكسيسيلين (مضاد حيوي — بوصفة)',
    mgPerKgDose: 15,
    maxSingleMg: 1000,
    maxDailyMgPerKg: 45,
    everyHours: 8,
    concentrations: [
      { label: 'معلق 125 مغ / 5 مل', mgPer5ml: 125 },
      { label: 'معلق 250 مغ / 5 مل', mgPer5ml: 250 },
    ],
    minAgeMonths: 1,
    note: 'يلزم وصفة طبية — أكمل مدة العلاج كاملة حتى مع تحسّن الأعراض.',
  },
  {
    key: 'cetirizine',
    labelAr: 'سيتريزين (مضاد هيستامين)',
    mgPerKgDose: 0.25,
    maxSingleMg: 10,
    maxDailyMgPerKg: 0.5,
    everyHours: 24,
    concentrations: [{ label: 'شراب 5 مغ / 5 مل', mgPer5ml: 5 }],
    minAgeMonths: 12,
    note: 'يُعطى مرة يومياً مساءً، وقد يسبب نعاساً خفيفاً.',
  },
]

export interface PediatricDoseResult {
  singleDoseMg: number
  maxDailyMg: number
  dosesPerDay: number
  volumes: Array<{ label: string; ml: number }>
  warnings: string[]
}

export function calculatePediatricDose(
  drug: PediatricDrug,
  weightKg: number,
  ageMonths: number,
): PediatricDoseResult {
  const warnings: string[] = []
  const safeWeight = Math.max(0, weightKg)
  const raw = safeWeight * drug.mgPerKgDose
  const singleDoseMg = Math.min(raw, drug.maxSingleMg)
  if (raw > drug.maxSingleMg) warnings.push('الجرعة المحسوبة تجاوزت الحد الأقصى للبالغين — تم تحديدها عند الحد الأعلى.')
  if (ageMonths < drug.minAgeMonths) {
    warnings.push(`هذا الدواء غير موصى به تحت عمر ${drug.minAgeMonths} شهراً — راجع الطبيب.`)
  }
  if (safeWeight <= 0) warnings.push('أدخل وزناً صحيحاً بالكيلوغرام.')

  const dosesPerDay = Math.floor(24 / drug.everyHours)
  const maxDailyMg = Math.min(safeWeight * drug.maxDailyMgPerKg, drug.maxSingleMg * dosesPerDay)

  return {
    singleDoseMg: Math.round(singleDoseMg * 10) / 10,
    maxDailyMg: Math.round(maxDailyMg * 10) / 10,
    dosesPerDay,
    volumes: drug.concentrations.map((c) => ({
      label: c.label,
      ml: Math.round(((singleDoseMg / c.mgPer5ml) * 5) * 10) / 10,
    })),
    warnings,
  }
}
