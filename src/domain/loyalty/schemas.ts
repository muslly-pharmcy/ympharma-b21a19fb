export type LoyaltyTxnKind = 'earn' | 'redeem' | 'reverse' | 'expire' | 'adjust' | 'bonus'
export type LoyaltyAccountStatus = 'active' | 'frozen' | 'closed'
export type LoyaltyRuleKind =
  | 'spend_earn'
  | 'birthday_bonus'
  | 'category_bonus'
  | 'first_purchase_bonus'
  | 'double_points_window'
export type RewardRedemptionStatus = 'issued' | 'fulfilled' | 'cancelled'

export interface LoyaltyTier {
  id: string
  organization_id: string
  code: string
  name: string
  min_lifetime_points: number
  multiplier: number
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LoyaltyAccount {
  id: string
  organization_id: string
  customer_id: string
  points_balance: number
  points_lifetime_earned: number
  current_tier_id: string | null
  status: LoyaltyAccountStatus
  created_at: string
  updated_at: string
}

export interface LoyaltyTransaction {
  id: string
  organization_id: string
  account_id: string
  customer_id: string
  kind: LoyaltyTxnKind
  points: number
  reason: string | null
  source_ref: string | null
  correlation_id: string | null
  created_by: string | null
  created_at: string
}

export interface LoyaltyRule {
  id: string
  organization_id: string
  key: string
  name: string
  kind: LoyaltyRuleKind
  config: Record<string, string | number | boolean | null>
  priority: number
  is_active: boolean
  valid_from: string | null
  valid_to: string | null
  created_at: string
  updated_at: string
}

export interface Reward {
  id: string
  organization_id: string
  code: string
  name: string
  description: string | null
  points_cost: number
  stock: number | null
  is_active: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface RewardRedemption {
  id: string
  organization_id: string
  reward_id: string
  account_id: string
  customer_id: string
  transaction_id: string
  points_spent: number
  status: RewardRedemptionStatus
  created_at: string
  updated_at: string
}
