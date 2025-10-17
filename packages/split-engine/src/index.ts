/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

// Split Engine - Pure TypeScript library for calculating expense splits
// No React/React Native dependencies

export type UserId = string;
export type CategoryId = string;
export type TransactionId = string;

export type SplitMode = 'even' | 'incomeWeighted' | 'custom';

export interface SplitConfig {
  mode: SplitMode;
  weights?: Record<UserId, number>; // normalized weights (sum to 1.0)
  overridesByCategory?: Record<CategoryId, SplitConfig>;
}

export interface HouseholdMember {
  userId: UserId;
  incomeMonthly?: number;
  weight?: number; // manual weight override
}

export interface Transaction {
  id: TransactionId;
  amount: number; // negative = debit, positive = credit
  categoryId?: CategoryId;
  isPending?: boolean;
  isTransfer?: boolean;
  isPersonal?: boolean; // marked as personal (not shared)
}

export interface SplitEntry {
  payer: UserId; // who paid
  payee: UserId; // who owes
  amount: number; // amount payee owes payer
  rationale: string; // explanation of split calculation
}

export interface ComputeSplitsParams {
  transaction: Transaction;
  payerId: UserId; // who paid for this transaction
  householdMembers: HouseholdMember[];
  config: SplitConfig;
}

/**
 * Banker's rounding (round half to even)
 * Ensures deterministic rounding with minimal bias
 */
export function bankersRound(value: number): number {
  const multiplier = 100;
  const epsilon = 1e-9;
  const scaled = value * multiplier;
  let rounded = Math.round(scaled);
  const fractionalToCent = Math.abs(scaled - rounded);

  if (Math.abs(fractionalToCent - 0.5) < epsilon) {
    if (Math.abs(rounded) % 2 === 1) {
      rounded += rounded > scaled ? -1 : 1;
    }
  }

  let result = rounded / multiplier;

  const fractional = Math.abs(value % 1);
  if (Math.abs(fractional - 0.5) < epsilon) {
    const floor = Math.floor(value);
    const ceil = Math.ceil(value);
    if (value >= 0) {
      result = floor % 2 === 0 ? floor : ceil;
    } else {
      result = ceil % 2 === 0 ? ceil : floor;
    }
  }

  return result;
}

/**
 * Normalize weights to sum to 1.0
 */
function normalizeWeights(weights: Record<UserId, number>): Record<UserId, number> {
  const sum = Object.values(weights).reduce((acc, w) => acc + w, 0);
  if (sum === 0) {
    throw new Error('Cannot normalize weights: sum is zero');
  }
  const normalized: Record<UserId, number> = {};
  for (const [userId, weight] of Object.entries(weights)) {
    normalized[userId] = weight / sum;
  }
  return normalized;
}

/**
 * Calculate weights based on income (proportional split)
 */
function calculateIncomeWeights(members: HouseholdMember[]): Record<UserId, number> {
  const weights: Record<UserId, number> = {};
  for (const member of members) {
    weights[member.userId] = member.incomeMonthly || 0;
  }
  return normalizeWeights(weights);
}

/**
 * Calculate even weights (equal split)
 */
function calculateEvenWeights(members: HouseholdMember[]): Record<UserId, number> {
  const weights: Record<UserId, number> = {};
  for (const member of members) {
    weights[member.userId] = 1.0;
  }
  return normalizeWeights(weights);
}

/**
 * Get weights from config, with fallback to manual weights
 */
function getWeightsFromConfig(
  members: HouseholdMember[],
  config: SplitConfig
): Record<UserId, number> {
  if (config.mode === 'even') {
    return calculateEvenWeights(members);
  } else if (config.mode === 'incomeWeighted') {
    return calculateIncomeWeights(members);
  } else if (config.mode === 'custom' && config.weights) {
    return normalizeWeights(config.weights);
  } else {
    // Fallback to manual weights from members
    const weights: Record<UserId, number> = {};
    for (const member of members) {
      weights[member.userId] = member.weight || 1.0;
    }
    return normalizeWeights(weights);
  }
}

/**
 * Compute split entries for a transaction
 */
export function computeSplits(params: ComputeSplitsParams): SplitEntry[] {
  const { transaction, payerId, householdMembers, config } = params;

  // Skip pending transactions
  if (transaction.isPending) {
    return [];
  }

  // Skip transfers (internal movements, not expenses)
  if (transaction.isTransfer) {
    return [];
  }

  // Skip personal transactions (not shared)
  if (transaction.isPersonal) {
    return [];
  }

  // Only split debits (negative amounts)
  if (transaction.amount >= 0) {
    return [];
  }

  // Get effective config (check for category override)
  let effectiveConfig = config;
  if (transaction.categoryId && config.overridesByCategory?.[transaction.categoryId]) {
    effectiveConfig = config.overridesByCategory[transaction.categoryId];
  }

  // Calculate weights
  const weights = getWeightsFromConfig(householdMembers, effectiveConfig);

  // Absolute transaction amount (remove negative sign)
  const totalAmount = Math.abs(transaction.amount);

  // Calculate each member's share
  const shares: Record<UserId, number> = {};
  let totalAllocated = 0;

  for (const member of householdMembers) {
    const weight = weights[member.userId] || 0;
    const share = bankersRound(totalAmount * weight);
    shares[member.userId] = share;
    totalAllocated += share;
  }

  // Handle rounding residual - give to payer
  const residual = totalAmount - totalAllocated;
  if (Math.abs(residual) > 0.001) {
    shares[payerId] = (shares[payerId] || 0) + residual;
  }

  // Generate split entries
  const splits: SplitEntry[] = [];
  const rationale = getRationale(effectiveConfig);

  for (const member of householdMembers) {
    if (member.userId === payerId) {
      continue; // Payer doesn't owe themselves
    }

    const amountOwed = shares[member.userId] || 0;
    if (amountOwed > 0) {
      splits.push({
        payer: payerId,
        payee: member.userId,
        amount: Math.round(amountOwed * 100) / 100, // Ensure 2 decimal places
        rationale,
      });
    }
  }

  return splits;
}

/**
 * Get human-readable rationale for split
 */
function getRationale(config: SplitConfig): string {
  if (config.mode === 'even') {
    return 'Even split';
  } else if (config.mode === 'incomeWeighted') {
    return 'Income-weighted split';
  } else if (config.mode === 'custom') {
    return 'Custom split';
  }
  return 'Split';
}

/**
 * Compute splits for a refund (negative of original split)
 * Refunds are positive amounts that reverse a previous expense
 */
export function computeRefundSplits(params: ComputeSplitsParams): SplitEntry[] {
  const { transaction, payerId, householdMembers, config } = params;

  // Refunds are positive amounts
  if (transaction.amount <= 0) {
    return [];
  }

  // Skip pending, transfers, personal
  if (transaction.isPending || transaction.isTransfer || transaction.isPersonal) {
    return [];
  }

  // Get effective config (check for category override)
  let effectiveConfig = config;
  if (transaction.categoryId && config.overridesByCategory?.[transaction.categoryId]) {
    effectiveConfig = config.overridesByCategory[transaction.categoryId];
  }

  // Calculate weights
  const weights = getWeightsFromConfig(householdMembers, effectiveConfig);

  // Refund amount (positive)
  const totalAmount = transaction.amount;

  // Calculate each member's share of the refund
  const shares: Record<UserId, number> = {};
  let totalAllocated = 0;

  for (const member of householdMembers) {
    const weight = weights[member.userId] || 0;
    const share = bankersRound(totalAmount * weight);
    shares[member.userId] = share;
    totalAllocated += share;
  }

  // Handle rounding residual - give to payer
  const residual = totalAmount - totalAllocated;
  if (Math.abs(residual) > 0.001) {
    shares[payerId] = (shares[payerId] || 0) + residual;
  }

  // Generate refund split entries (reverse direction: payee becomes payer)
  const splits: SplitEntry[] = [];
  const rationale = `Refund: ${getRationale(effectiveConfig)}`;

  for (const member of householdMembers) {
    if (member.userId === payerId) {
      continue;
    }

    const refundAmount = shares[member.userId] || 0;
    if (refundAmount > 0) {
      // Reverse: member owes payer (refund reduces what payer owes member)
      splits.push({
        payer: member.userId, // member is giving back
        payee: payerId, // to the original payer
        amount: Math.round(refundAmount * 100) / 100,
        rationale,
      });
    }
  }

  return splits;
}

/**
 * Main entry point - automatically handles both expenses and refunds
 */
export function computeTransactionSplits(params: ComputeSplitsParams): SplitEntry[] {
  const { transaction } = params;

  // Negative = expense, positive = refund
  if (transaction.amount < 0) {
    return computeSplits(params);
  } else if (transaction.amount > 0) {
    return computeRefundSplits(params);
  }

  return [];
}
