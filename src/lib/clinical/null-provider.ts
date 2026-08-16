// Default provider used until an external knowledge base is wired in.
// Returns zero warnings — the framework must never invent clinical rules.

import type { DrugKnowledgeProvider } from '@/domain/clinical/types'

const empty = { async check() { return [] } }

export const nullProvider: DrugKnowledgeProvider = {
  id: 'null',
  displayName: 'No Provider (advisory disabled)',
  allergy: empty,
  interaction: empty,
  dose: empty,
  contraindication: empty,
  pregnancy: empty,
  renal: empty,
  hepatic: empty,
}
