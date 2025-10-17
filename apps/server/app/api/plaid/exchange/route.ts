/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@server/lib/plaid';
import { getSupabaseAdmin } from '@server/lib/supabase';
import { encryptString } from '@server/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { public_token, household_id } = body;

    if (!public_token || !household_id) {
      return NextResponse.json(
        { error: 'Missing public_token or household_id' },
        { status: 400 }
      );
    }

    // Verify user is member of household
    const { data: membership } = await supabase
      .from('membership')
      .select('*')
      .eq('household_id', household_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get account information
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accounts = accountsResponse.data.accounts;
    const institution = accountsResponse.data.item.institution_id;

    const encryptedToken = encryptString(accessToken);

    for (const account of accounts) {
      await supabase.from('account').insert({
        household_id,
        owner_user_id: user.id,
        plaid_item_id: itemId,
        plaid_access_token_encrypted: encryptedToken,
        institution: institution || 'Unknown',
        mask: account.mask || '',
        account_name: account.name,
        account_type: account.type,
        account_subtype: account.subtype || null,
      });
    }

    // Log audit event
    await supabase.from('audit_log').insert({
      user_id: user.id,
      household_id,
      action: 'account.connected',
      subject_type: 'plaid_item',
      subject_id: itemId,
      meta_json: {
        institution,
        accounts_count: accounts.length,
      },
    });

    return NextResponse.json({
      success: true,
      item_id: itemId,
      accounts: accounts.length,
    });
  } catch (error: any) {
    console.error('[Plaid Exchange Error]:', error);
    return NextResponse.json(
      { error: 'Failed to exchange token', details: error.message },
      { status: 500 }
    );
  }
}
