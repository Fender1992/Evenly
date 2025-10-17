/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface PlaidLinkTokenResponse {
  link_token: string;
  expiration: string;
}

interface PlaidExchangeRequest {
  public_token: string;
  household_id: string;
}

export function usePlaidLinkToken() {
  return useMutation({
    mutationFn: async (): Promise<PlaidLinkTokenResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/plaid/link-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create link token');
      }

      return response.json();
    },
  });
}

export function usePlaidExchange() {
  return useMutation({
    mutationFn: async ({ public_token, household_id }: PlaidExchangeRequest) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/plaid/exchange`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ public_token, household_id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to exchange token');
      }

      return response.json();
    },
  });
}
