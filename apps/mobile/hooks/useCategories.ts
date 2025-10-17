/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  household_id: string | null;
  is_personal_default: boolean;
  created_at: string;
}

export function useCategories(householdId: string | null) {
  return useQuery({
    queryKey: ['categories', householdId],
    queryFn: async (): Promise<Category[]> => {
      if (!householdId) {
        throw new Error('No household ID provided');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/categories?household_id=${householdId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch categories');
      }

      const data = await response.json();
      return data.categories;
    },
    enabled: !!householdId,
    staleTime: 60000, // 1 minute
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      household_id: string;
      name: string;
      icon?: string;
      color?: string;
      is_personal_default?: boolean;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create category');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate categories query
      queryClient.invalidateQueries({ queryKey: ['categories', variables.household_id] });
    },
  });
}
