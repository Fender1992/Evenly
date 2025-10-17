/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { describe, it, expect } from 'vitest';
import {
  computeSplits,
  computeRefundSplits,
  computeTransactionSplits,
  bankersRound,
  type HouseholdMember,
  type SplitConfig,
  type Transaction,
} from './index';

describe('Split Engine', () => {
  // Test household members
  const alice: HouseholdMember = {
    userId: 'alice',
    incomeMonthly: 4000,
  };

  const bob: HouseholdMember = {
    userId: 'bob',
    incomeMonthly: 2000,
  };

  const members = [alice, bob];

  describe('bankersRound', () => {
    it('should round normally for non-.5 values', () => {
      expect(bankersRound(1.23)).toBe(1.23);
      expect(bankersRound(1.26)).toBe(1.26);
      expect(bankersRound(1.24)).toBe(1.24);
      expect(bankersRound(1.27)).toBe(1.27);
    });

    it('should round half to even', () => {
      // 1.5 -> 2 (even)
      expect(bankersRound(1.5)).toBe(2);
      // 2.5 -> 2 (even)
      expect(bankersRound(2.5)).toBe(2);
      // 3.5 -> 4 (even)
      expect(bankersRound(3.5)).toBe(4);
      // 4.5 -> 4 (even)
      expect(bankersRound(4.5)).toBe(4);
    });
  });

  describe('Even Split (50/50)', () => {
    const config: SplitConfig = {
      mode: 'even',
    };

    it('should split $100 evenly between two people', () => {
      const transaction: Transaction = {
        id: 'tx1',
        amount: -100,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      expect(splits[0]).toEqual({
        payer: 'alice',
        payee: 'bob',
        amount: 50,
        rationale: 'Even split',
      });
    });

    it('should handle odd amounts with residual going to payer', () => {
      const transaction: Transaction = {
        id: 'tx2',
        amount: -100.01, // Odd amount
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      // Bob owes exactly 50, Alice absorbs the extra 0.01
      expect(splits[0].amount).toBe(50);
    });
  });

  describe('Income-Weighted Split (60/40)', () => {
    const config: SplitConfig = {
      mode: 'incomeWeighted',
    };

    it('should split $100 based on income weights', () => {
      const transaction: Transaction = {
        id: 'tx3',
        amount: -100,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      // Alice makes $4k, Bob makes $2k
      // Alice's share: 4k/6k = 66.67%, Bob's share: 2k/6k = 33.33%
      // Bob owes Alice: $33.33
      expect(splits[0]).toEqual({
        payer: 'alice',
        payee: 'bob',
        amount: 33.33,
        rationale: 'Income-weighted split',
      });
    });

    it('should handle Bob paying', () => {
      const transaction: Transaction = {
        id: 'tx4',
        amount: -150,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'bob',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      // Alice's share: 66.67% of $150 = $100
      // Alice owes Bob $100
      expect(splits[0]).toEqual({
        payer: 'bob',
        payee: 'alice',
        amount: 100,
        rationale: 'Income-weighted split',
      });
    });
  });

  describe('Custom Weights', () => {
    const config: SplitConfig = {
      mode: 'custom',
      weights: {
        alice: 0.7,
        bob: 0.3,
      },
    };

    it('should split based on custom weights', () => {
      const transaction: Transaction = {
        id: 'tx5',
        amount: -100,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      // Bob owes 30% = $30
      expect(splits[0]).toEqual({
        payer: 'alice',
        payee: 'bob',
        amount: 30,
        rationale: 'Custom split',
      });
    });
  });

  describe('Category Override', () => {
    const diningCategoryId = 'cat_dining';

    const config: SplitConfig = {
      mode: 'even', // Default 50/50
      overridesByCategory: {
        [diningCategoryId]: {
          mode: 'custom',
          weights: {
            alice: 0.7,
            bob: 0.3,
          },
        },
      },
    };

    it('should use category override for dining', () => {
      const transaction: Transaction = {
        id: 'tx6',
        amount: -60,
        categoryId: diningCategoryId,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'bob',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      // Dining override: Alice 70%, Bob 30%
      // Alice owes Bob: 70% of $60 = $42
      expect(splits[0]).toEqual({
        payer: 'bob',
        payee: 'alice',
        amount: 42,
        rationale: 'Custom split',
      });
    });

    it('should use default config for non-dining', () => {
      const transaction: Transaction = {
        id: 'tx7',
        amount: -100,
        categoryId: 'cat_groceries',
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      // Default even split: 50/50
      expect(splits[0].amount).toBe(50);
      expect(splits[0].rationale).toBe('Even split');
    });
  });

  describe('Edge Cases', () => {
    const config: SplitConfig = {
      mode: 'even',
    };

    it('should skip pending transactions', () => {
      const transaction: Transaction = {
        id: 'tx8',
        amount: -100,
        isPending: true,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(0);
    });

    it('should skip transfers', () => {
      const transaction: Transaction = {
        id: 'tx9',
        amount: -100,
        isTransfer: true,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(0);
    });

    it('should skip personal transactions', () => {
      const transaction: Transaction = {
        id: 'tx10',
        amount: -100,
        isPersonal: true,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(0);
    });

    it('should skip positive amounts (refunds handled separately)', () => {
      const transaction: Transaction = {
        id: 'tx11',
        amount: 50, // Positive amount
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(0);
    });

    it('should skip zero amounts', () => {
      const transaction: Transaction = {
        id: 'tx12',
        amount: 0,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(0);
    });
  });

  describe('Refunds', () => {
    const config: SplitConfig = {
      mode: 'even',
    };

    it('should handle refunds (reverse split)', () => {
      const transaction: Transaction = {
        id: 'tx13',
        amount: 50, // Positive = refund
      };

      const splits = computeRefundSplits({
        transaction,
        payerId: 'alice', // Alice received the refund
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      // Bob gets 50% of refund back = $25
      // Direction reverses: Bob (payer) gets from Alice (payee)
      expect(splits[0]).toEqual({
        payer: 'bob',
        payee: 'alice',
        amount: 25,
        rationale: 'Refund: Even split',
      });
    });

    it('should handle income-weighted refunds', () => {
      const config: SplitConfig = {
        mode: 'incomeWeighted',
      };

      const transaction: Transaction = {
        id: 'tx14',
        amount: 60, // Refund
      };

      const splits = computeRefundSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      // Bob's share of refund: 33.33% of $60 = $20
      expect(splits[0]).toEqual({
        payer: 'bob',
        payee: 'alice',
        amount: 20,
        rationale: 'Refund: Income-weighted split',
      });
    });

    it('should skip pending refunds', () => {
      const transaction: Transaction = {
        id: 'tx15',
        amount: 50,
        isPending: true,
      };

      const splits = computeRefundSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(0);
    });
  });

  describe('computeTransactionSplits (auto-detect)', () => {
    const config: SplitConfig = {
      mode: 'even',
    };

    it('should handle expenses (negative amounts)', () => {
      const transaction: Transaction = {
        id: 'tx16',
        amount: -100,
      };

      const splits = computeTransactionSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      expect(splits[0].amount).toBe(50);
      expect(splits[0].rationale).toBe('Even split');
    });

    it('should handle refunds (positive amounts)', () => {
      const transaction: Transaction = {
        id: 'tx17',
        amount: 50,
      };

      const splits = computeTransactionSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      expect(splits[0].payer).toBe('bob'); // Reversed
      expect(splits[0].payee).toBe('alice'); // Reversed
      expect(splits[0].amount).toBe(25);
      expect(splits[0].rationale).toBe('Refund: Even split');
    });
  });

  describe('Rounding Edge Cases', () => {
    const config: SplitConfig = {
      mode: 'even',
    };

    it('should handle amounts that do not divide evenly', () => {
      const transaction: Transaction = {
        id: 'tx18',
        amount: -10.01,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      // Each person's share: $5.005, rounds to $5.00 (banker's rounding)
      // Total allocated: $10.00, residual $0.01 goes to payer (Alice)
      // Bob owes: $5.00
      expect(splits[0].amount).toBe(5);
    });

    it('should allocate residual cents to payer', () => {
      const transaction: Transaction = {
        id: 'tx19',
        amount: -100.33,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: members,
        config,
      });

      expect(splits).toHaveLength(1);
      // Each person: $50.165 -> banker's round
      // Bob owes close to $50.16 or $50.17, residual goes to Alice
      const bobOwes = splits[0].amount;
      expect(bobOwes).toBeCloseTo(50.16, 2);
    });
  });

  describe('Three-person household', () => {
    const charlie: HouseholdMember = {
      userId: 'charlie',
      incomeMonthly: 3000,
    };

    const threeMembers = [alice, bob, charlie];

    it('should split evenly among three people', () => {
      const config: SplitConfig = {
        mode: 'even',
      };

      const transaction: Transaction = {
        id: 'tx20',
        amount: -90,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: threeMembers,
        config,
      });

      expect(splits).toHaveLength(2);
      // Each person pays $30
      // Alice paid, so Bob and Charlie each owe $30
      const bobSplit = splits.find((s) => s.payee === 'bob');
      const charlieSplit = splits.find((s) => s.payee === 'charlie');

      expect(bobSplit?.amount).toBe(30);
      expect(charlieSplit?.amount).toBe(30);
    });

    it('should split by income weights among three people', () => {
      const config: SplitConfig = {
        mode: 'incomeWeighted',
      };

      const transaction: Transaction = {
        id: 'tx21',
        amount: -90,
      };

      const splits = computeSplits({
        transaction,
        payerId: 'alice',
        householdMembers: threeMembers,
        config,
      });

      expect(splits).toHaveLength(2);
      // Total income: $4k + $2k + $3k = $9k
      // Alice: 4/9 = 44.44% = $40
      // Bob: 2/9 = 22.22% = $20
      // Charlie: 3/9 = 33.33% = $30
      const bobSplit = splits.find((s) => s.payee === 'bob');
      const charlieSplit = splits.find((s) => s.payee === 'charlie');

      expect(bobSplit?.amount).toBeCloseTo(20, 0);
      expect(charlieSplit?.amount).toBeCloseTo(30, 0);
    });
  });
});
