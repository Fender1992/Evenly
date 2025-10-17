/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export interface Rule {
  id: string;
  household_id: string;
  name: string | null;
  match_vendor_ilike: string | null;
  category_id: string | null;
  category?: {
    id: string;
    name: string;
  };
  split_override_json: any;
  mark_as_personal: boolean | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

export function useRules(householdId: string | null) {
  return useQuery({
    queryKey: ['rules', householdId],
    queryFn: async (): Promise<Rule[]> => {
      if (!householdId) {
        throw new Error('No household ID provided');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/rules?household_id=${householdId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch rules');
      }

      const data = await response.json();
      return data.rules;
    },
    enabled: !!householdId,
    staleTime: 30000, // 30 seconds
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      household_id: string;
      name?: string;
      match_vendor_ilike?: string;
      category_id?: string;
      mark_as_personal?: boolean;
      priority?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/rules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create rule');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate rules query
      queryClient.invalidateQueries({ queryKey: ['rules', variables.household_id] });
    },
  });
}

export function useApplyRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      household_id: string;
      transaction_id?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/rules/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to apply rules');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate household summary to refresh transactions
      queryClient.invalidateQueries({ queryKey: ['household-summary', variables.household_id] });
    },
  });
}
