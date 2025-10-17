# @evenly/split-engine

Pure TypeScript library for calculating expense splits in the Evenly app.

## Features

- **Zero dependencies** - Pure TypeScript, no React/React Native
- **Multiple split modes**:
  - `even` - Equal split among all members
  - `incomeWeighted` - Split proportional to income
  - `custom` - Custom weights per user
- **Category overrides** - Different split rules per expense category
- **Edge case handling**:
  - Skip pending transactions
  - Skip transfers (internal movements)
  - Skip personal expenses (not shared)
  - Handle refunds (reverse splits)
- **Deterministic rounding** - Banker's rounding to minimize bias
- **Residual allocation** - Any rounding cents go to the payer

## Installation

```bash
npm install @evenly/split-engine
```

## Usage

```typescript
import { computeSplits, type SplitConfig, type HouseholdMember, type Transaction } from '@evenly/split-engine';

// Define household members
const members: HouseholdMember[] = [
  { userId: 'alice', incomeMonthly: 4000 },
  { userId: 'bob', incomeMonthly: 2000 },
];

// Configure split mode
const config: SplitConfig = {
  mode: 'incomeWeighted', // Split proportional to income
};

// Define transaction
const transaction: Transaction = {
  id: 'tx1',
  amount: -120, // $120 expense (negative)
};

// Compute splits
const splits = computeSplits({
  transaction,
  payerId: 'alice', // Alice paid
  householdMembers: members,
  config,
});

console.log(splits);
// [{ payer: 'alice', payee: 'bob', amount: 40, rationale: 'Income-weighted split' }]
// Bob owes Alice $40 (33.33% of $120)
```

## API

### `computeSplits(params)`

Computes split entries for a single transaction.

**Parameters:**
- `transaction: Transaction` - The transaction to split
- `payerId: UserId` - Who paid for this transaction
- `householdMembers: HouseholdMember[]` - All household members
- `config: SplitConfig` - Split configuration

**Returns:** `SplitEntry[]` - Array of split entries (who owes whom)

**Example:**
```typescript
const splits = computeSplits({
  transaction: { id: 'tx1', amount: -100 },
  payerId: 'alice',
  householdMembers: [alice, bob],
  config: { mode: 'even' },
});
```

### `computeRefundSplits(params)`

Computes split entries for a refund (positive amount).

**Example:**
```typescript
const refundSplits = computeRefundSplits({
  transaction: { id: 'tx2', amount: 50 }, // Positive = refund
  payerId: 'alice',
  householdMembers: [alice, bob],
  config: { mode: 'even' },
});
// [{ payer: 'bob', payee: 'alice', amount: 25, rationale: 'Refund: Even split' }]
```

### `computeTransactionSplits(params)`

Auto-detects whether transaction is an expense or refund and calls the appropriate function.

**Example:**
```typescript
const splits = computeTransactionSplits({
  transaction: { id: 'tx3', amount: -100 }, // Negative = expense
  payerId: 'alice',
  householdMembers: [alice, bob],
  config: { mode: 'even' },
});
```

### `bankersRound(value)`

Rounds a number using banker's rounding (round half to even).

**Example:**
```typescript
bankersRound(1.5); // 2 (rounds to nearest even)
bankersRound(2.5); // 2 (rounds to nearest even)
bankersRound(1.23); // 1.23 (normal rounding)
```

## Types

### `SplitMode`

```typescript
type SplitMode = 'even' | 'incomeWeighted' | 'custom';
```

### `SplitConfig`

```typescript
interface SplitConfig {
  mode: SplitMode;
  weights?: Record<UserId, number>; // For custom mode
  overridesByCategory?: Record<CategoryId, SplitConfig>; // Category-specific rules
}
```

### `HouseholdMember`

```typescript
interface HouseholdMember {
  userId: UserId;
  incomeMonthly?: number; // For incomeWeighted mode
  weight?: number; // For custom mode
}
```

### `Transaction`

```typescript
interface Transaction {
  id: TransactionId;
  amount: number; // Negative = expense, positive = refund
  categoryId?: CategoryId;
  isPending?: boolean; // If true, skip splitting
  isTransfer?: boolean; // If true, skip splitting
  isPersonal?: boolean; // If true, skip splitting
}
```

### `SplitEntry`

```typescript
interface SplitEntry {
  payer: UserId; // Who paid
  payee: UserId; // Who owes
  amount: number; // Amount payee owes payer
  rationale: string; // Human-readable explanation
}
```

## Examples

### Even Split (50/50)

```typescript
const config: SplitConfig = { mode: 'even' };
const splits = computeSplits({
  transaction: { id: 'tx1', amount: -100 },
  payerId: 'alice',
  householdMembers: [alice, bob],
  config,
});
// Bob owes Alice $50
```

### Income-Weighted Split

```typescript
const config: SplitConfig = { mode: 'incomeWeighted' };
const members = [
  { userId: 'alice', incomeMonthly: 6000 },
  { userId: 'bob', incomeMonthly: 3000 },
];
const splits = computeSplits({
  transaction: { id: 'tx2', amount: -90 },
  payerId: 'alice',
  householdMembers: members,
  config,
});
// Alice: 66.67%, Bob: 33.33%
// Bob owes Alice $30
```

### Custom Weights

```typescript
const config: SplitConfig = {
  mode: 'custom',
  weights: { alice: 0.7, bob: 0.3 },
};
const splits = computeSplits({
  transaction: { id: 'tx3', amount: -100 },
  payerId: 'alice',
  householdMembers: [alice, bob],
  config,
});
// Bob owes Alice $30 (30%)
```

### Category Override

```typescript
const config: SplitConfig = {
  mode: 'even', // Default 50/50
  overridesByCategory: {
    dining: {
      mode: 'custom',
      weights: { alice: 0.7, bob: 0.3 },
    },
  },
};

// Dining transaction uses 70/30 split
const splits = computeSplits({
  transaction: { id: 'tx4', amount: -60, categoryId: 'dining' },
  payerId: 'bob',
  householdMembers: [alice, bob],
  config,
});
// Alice owes Bob $42 (70%)

// Other transactions use default 50/50
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm test -- --coverage
```

## Edge Cases Handled

1. **Pending transactions** - Skipped (not finalized yet)
2. **Transfers** - Skipped (internal movements, not expenses)
3. **Personal expenses** - Skipped (marked as not shared)
4. **Zero amounts** - Skipped
5. **Positive amounts** - Treated as refunds (use `computeRefundSplits` or `computeTransactionSplits`)
6. **Rounding residuals** - Allocated to the payer

## Banker's Rounding

The split engine uses banker's rounding (round half to even) to minimize bias in rounding. This ensures deterministic results and fair distribution of cents.

**Example:**
- `$100.50 / 2 = $50.25 each` → rounds to `$50.00` (even)
- `$101.50 / 2 = $50.75 each` → rounds to `$51.00` (even)

Any residual cents after rounding are allocated to the payer.

## License

Private - Part of Evenly monorepo
