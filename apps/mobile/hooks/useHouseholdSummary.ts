/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export interface HouseholdSummary {
  household: {
    id: string;
    name: string;
    created_at: string;
  };
  members: Array<{
    user_id: string;
    role: string;
    income_monthly: number | null;
    weight: number | null;
  }>;
  month: string;
  summary: {
    totalSpent: number;
    personalSpent: number;
    sharedSpent: number;
    youOwe: number;
    owedToYou: number;
    netBalance: number;
  };
  transactions: Array<any>;
  budgets: Array<any>;
  goals: Array<any>;
  balances: Record<string, Record<string, number>>;
}

export function useHouseholdSummary(householdId: string | null, month?: string) {
  return useQuery({
    queryKey: ['household-summary', householdId, month],
    queryFn: async (): Promise<HouseholdSummary> => {
      if (!householdId) {
        throw new Error('No household ID provided');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const url = month
        ? `${API_BASE_URL}/api/household/${householdId}/summary?m=${month}`
        : `${API_BASE_URL}/api/household/${householdId}/summary`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch household summary');
      }

      return response.json();
    },
    enabled: !!householdId,
    staleTime: 30000, // 30 seconds
  });
}
