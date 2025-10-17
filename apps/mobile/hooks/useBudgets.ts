/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export interface Budget {
  id: string;
  household_id: string;
  category_id: string;
  category?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  };
  amount_limit: number;
  period_start: string;
  period_end: string;
  created_at: string;
  spent?: number;
  remaining?: number;
  percentage?: number;
}

export function useBudgets(householdId: string | null, month?: string) {
  return useQuery({
    queryKey: ['budgets', householdId, month],
    queryFn: async (): Promise<Budget[]> => {
      if (!householdId) {
        throw new Error('No household ID provided');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      let url = `${API_BASE_URL}/api/budgets?household_id=${householdId}`;
      if (month) {
        url += `&month=${month}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch budgets');
      }

      const data = await response.json();
      return data.budgets;
    },
    enabled: !!householdId,
    staleTime: 30000, // 30 seconds
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      household_id: string;
      category_id: string;
      amount_limit: number;
      period_start: string;
      period_end: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/budgets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create budget');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate budgets query
      queryClient.invalidateQueries({ queryKey: ['budgets', variables.household_id] });
      // Invalidate household summary (budgets are displayed there)
      queryClient.invalidateQueries({ queryKey: ['household-summary', variables.household_id] });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      budget_id: string;
      household_id: string;
      amount_limit?: number;
      period_start?: string;
      period_end?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { budget_id, household_id, ...updates } = params;

      const response = await fetch(`${API_BASE_URL}/api/budgets/${budget_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update budget');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate budgets query
      queryClient.invalidateQueries({ queryKey: ['budgets', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['household-summary', variables.household_id] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      budget_id: string;
      household_id: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/budgets/${params.budget_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete budget');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate budgets query
      queryClient.invalidateQueries({ queryKey: ['budgets', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['household-summary', variables.household_id] });
    },
  });
}
