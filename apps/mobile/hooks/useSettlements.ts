/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export interface Settlement {
  id: string;
  household_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  method: 'venmo' | 'zelle' | 'cashapp' | 'cash' | 'other';
  reference?: string;
  note?: string;
  settled_at: string;
  from_user?: {
    id: string;
    email: string;
    user_metadata?: any;
  };
  to_user?: {
    id: string;
    email: string;
    user_metadata?: any;
  };
}

export function useSettlements(householdId: string | null) {
  return useQuery({
    queryKey: ['settlements', householdId],
    queryFn: async (): Promise<Settlement[]> => {
      if (!householdId) {
        throw new Error('No household ID provided');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/settlements?household_id=${householdId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch settlements');
      }

      const data = await response.json();
      return data.settlements;
    },
    enabled: !!householdId,
    staleTime: 30000, // 30 seconds
  });
}

export function useCreateSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      household_id: string;
      to_user_id: string;
      amount: number;
      method: 'venmo' | 'zelle' | 'cashapp' | 'cash' | 'other';
      reference?: string;
      note?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/settlements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create settlement');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate settlements query
      queryClient.invalidateQueries({ queryKey: ['settlements', variables.household_id] });
      // Invalidate household summary (balances will update)
      queryClient.invalidateQueries({ queryKey: ['household-summary', variables.household_id] });
    },
  });
}
