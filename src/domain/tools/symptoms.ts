// Self-care triage tree for the symptom wizard. Advisory only — every leaf
// carries an explicit escalation note when red flags are present.

export type SymptomOption = {
  label: string
  next?: string
  outcome?: string
}

export type SymptomNode = {
  id: string
  question: string
  hint?: string
  options: SymptomOption[]
}

export type SymptomOutcome = {
  id: string
  title: string
  tone: 'safe' | 'caution' | 'urgent'
  advice: string[]
  /** search term used to deep-link into the catalog */
  shopTerm?: string
  shopLabel?: string
}

export const SYMPTOM_ROOT = 'root'

export const SYMPTOM_NODES: Record<string, SymptomNode> = {
  root: {
    id: 'root',
    question: 'ما هي الشكوى الأساسية اليوم؟',
    hint: 'اختر الأقرب لحالتك، ويمكنك العودة للخلف في أي خطوة.',
    options: [
      { label: 'حرارة أو أعراض برد', next: 'fever' },
      { label: 'ألم في الرأس', next: 'headache' },
      { label: 'اضطراب في المعدة', next: 'gi' },
      { label: 'سعال أو التهاب حلق', next: 'cough' },
    ],
  },
  fever: {
    id: 'fever',
    question: 'كم درجة الحرارة تقريباً ومنذ متى؟',
    options: [
      { label: 'أقل من 38.5° ومنذ أقل من 3 أيام', outcome: 'fever-mild' },
      { label: '38.5° أو أعلى، أو أكثر من 3 أيام', outcome: 'fever-red' },
      { label: 'مصحوبة بضيق تنفس أو تصلب رقبة', outcome: 'emergency' },
    ],
  },
  headache: {
    id: 'headache',
    question: 'كيف تصف الألم؟',
    options: [
      { label: 'ألم خفيف/متوسط معتاد', outcome: 'headache-mild' },
      { label: 'ألم نصفي مع حساسية للضوء', outcome: 'migraine' },
      { label: 'أشد صداع في حياتي أو مفاجئ جداً', outcome: 'emergency' },
    ],
  },
  gi: {
    id: 'gi',
    question: 'ما الذي يزعجك أكثر؟',
    options: [
      { label: 'حموضة أو حرقة معدة', outcome: 'reflux' },
      { label: 'إسهال بسيط بدون دم', outcome: 'diarrhea' },
      { label: 'قيء متواصل أو دم في البراز', outcome: 'emergency' },
    ],
  },
  cough: {
    id: 'cough',
    question: 'ما نوع السعال؟',
    options: [
      { label: 'سعال جاف مزعج', outcome: 'dry-cough' },
      { label: 'سعال مع بلغم', outcome: 'wet-cough' },
      { label: 'صعوبة تنفس أو صفير شديد', outcome: 'emergency' },
    ],
  },
}

export const SYMPTOM_OUTCOMES: Record<string, SymptomOutcome> = {
  'fever-mild': {
    id: 'fever-mild',
    title: 'حرارة بسيطة — رعاية منزلية',
    tone: 'safe',
    advice: [
      'أكثر من شرب السوائل والراحة.',
      'خافض حرارة مناسب للوزن والعمر عند الحاجة.',
      'راجع الصيدلية إذا استمرت الحرارة أكثر من 3 أيام.',
    ],
    shopTerm: 'باراسيتامول',
    shopLabel: 'خافضات الحرارة المتوفرة',
  },
  'fever-red': {
    id: 'fever-red',
    title: 'حرارة تحتاج تقييماً',
    tone: 'caution',
    advice: [
      'يفضل تقييم طبي خلال 24 ساعة.',
      'راقب علامات الجفاف والخمول.',
      'لا تستخدم مضاداً حيوياً بدون وصفة.',
    ],
    shopTerm: 'محلول معالجة الجفاف',
    shopLabel: 'دعم الترطيب',
  },
  'headache-mild': {
    id: 'headache-mild',
    title: 'صداع بسيط',
    tone: 'safe',
    advice: ['راحة في مكان هادئ وترطيب جيد.', 'مسكن بسيط عند الحاجة ولمدة قصيرة.'],
    shopTerm: 'مسكن',
    shopLabel: 'مسكنات الألم',
  },
  migraine: {
    id: 'migraine',
    title: 'نمط شبيه بالشقيقة',
    tone: 'caution',
    advice: [
      'تجنب الضوء الساطع والمحفزات المعروفة.',
      'سجّل نوبات الصداع لعرضها على الطبيب.',
      'استشر الصيدلي قبل استخدام أدوية الشقيقة.',
    ],
    shopTerm: 'شقيقة',
    shopLabel: 'منتجات ذات صلة',
  },
  reflux: {
    id: 'reflux',
    title: 'أعراض حموضة',
    tone: 'safe',
    advice: [
      'تجنب الوجبات الدسمة والاستلقاء بعد الأكل مباشرة.',
      'مضادات الحموضة قد تخفف الأعراض قصيرة المدى.',
    ],
    shopTerm: 'مضاد حموضة',
    shopLabel: 'مضادات الحموضة',
  },
  diarrhea: {
    id: 'diarrhea',
    title: 'إسهال بسيط',
    tone: 'safe',
    advice: ['التعويض بالسوائل ومحاليل الجفاف هو الأهم.', 'راجعنا إذا استمر أكثر من يومين.'],
    shopTerm: 'محلول معالجة الجفاف',
    shopLabel: 'محاليل الجفاف',
  },
  'dry-cough': {
    id: 'dry-cough',
    title: 'سعال جاف',
    tone: 'safe',
    advice: ['سوائل دافئة وترطيب الهواء.', 'مهدئ سعال عند إزعاج النوم.'],
    shopTerm: 'شراب سعال',
    shopLabel: 'أدوية السعال',
  },
  'wet-cough': {
    id: 'wet-cough',
    title: 'سعال مع بلغم',
    tone: 'caution',
    advice: ['طارد بلغم وسوائل كافية.', 'راجع الطبيب إذا صاحبه حرارة مستمرة أو ضيق نفس.'],
    shopTerm: 'طارد للبلغم',
    shopLabel: 'أدوية البلغم',
  },
  emergency: {
    id: 'emergency',
    title: 'علامات تستدعي رعاية عاجلة',
    tone: 'urgent',
    advice: [
      'توجه لأقرب طوارئ أو اتصل بالإسعاف فوراً.',
      'لا تعتمد على العلاج المنزلي في هذه الحالة.',
    ],
  },
}
