/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      transaction_id: string;
      household_id: string;
      category_id?: string | null;
      is_personal?: boolean;
      memo?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { transaction_id, household_id, ...updates } = params;

      const response = await fetch(`${API_BASE_URL}/api/transactions/${transaction_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update transaction');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate household summary to refresh transactions
      queryClient.invalidateQueries({ queryKey: ['household-summary', variables.household_id] });
    },
  });
}
