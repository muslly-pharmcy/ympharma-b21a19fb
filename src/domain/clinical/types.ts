// Clinical Validation Framework — types & provider interfaces.
// This layer is advisory only. It never blocks writes.
// All rules must come from external DrugKnowledgeProviders — no hand-authored clinical logic.

export type ClinicalSeverity = 'info' | 'low' | 'moderate' | 'high' | 'critical'

export type ClinicalCategory =
  | 'allergy'
  | 'interaction'
  | 'dose'
  | 'contraindication'
  | 'pregnancy'
  | 'renal'
  | 'hepatic'

export interface ClinicalWarning {
  category: ClinicalCategory
  severity: ClinicalSeverity
  code: string           // provider-specific stable code
  message: string        // human-readable, localized by provider or fallback
  subjectItemIds?: string[]  // prescription item ids the warning refers to
  source: string         // provider id (e.g. 'null', 'firstdatabank', 'openfda')
  evidenceUrl?: string | null
}

// --- Inputs handed to adapters -------------------------------------------------

export interface ClinicalDrugRef {
  itemId: string
  productId: string | null
  code: string | null   // ATC / RxNorm / local code
  name: string
  dose?: string | null
  frequency?: string | null
  route?: string | null
}

export interface ClinicalPatientContext {
  patientId: string
  ageYears?: number | null
  sex?: 'male' | 'female' | 'other' | null
  weightKg?: number | null
  pregnant?: boolean | null
  breastfeeding?: boolean | null
  renalFunctionEgfr?: number | null   // mL/min/1.73m²
  hepaticImpairment?: 'none' | 'mild' | 'moderate' | 'severe' | null
  knownAllergies: Array<{ substance: string; code?: string | null }>
  activeConditions: Array<{ label: string; code?: string | null }>
}

export interface ClinicalCheckInput {
  patient: ClinicalPatientContext
  drugs: ClinicalDrugRef[]
}

// --- Adapter surface ----------------------------------------------------------

export interface AllergyAdapter        { check(input: ClinicalCheckInput): Promise<ClinicalWarning[]> }
export interface InteractionAdapter    { check(input: ClinicalCheckInput): Promise<ClinicalWarning[]> }
export interface DoseAdapter           { check(input: ClinicalCheckInput): Promise<ClinicalWarning[]> }
export interface ContraindicationAdapter { check(input: ClinicalCheckInput): Promise<ClinicalWarning[]> }
export interface PregnancyAdapter      { check(input: ClinicalCheckInput): Promise<ClinicalWarning[]> }
export interface RenalAdapter          { check(input: ClinicalCheckInput): Promise<ClinicalWarning[]> }
export interface HepaticAdapter        { check(input: ClinicalCheckInput): Promise<ClinicalWarning[]> }

export interface DrugKnowledgeProvider {
  readonly id: string
  readonly displayName: string
  allergy: AllergyAdapter
  interaction: InteractionAdapter
  dose: DoseAdapter
  contraindication: ContraindicationAdapter
  pregnancy: PregnancyAdapter
  renal: RenalAdapter
  hepatic: HepaticAdapter
}
