/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@server/lib/plaid';
import { getSupabaseAdmin } from '@server/lib/supabase';
import { decryptString } from '@server/lib/crypto';
import { computeTransactionSplits, type HouseholdMember, type SplitConfig } from '@evenly/split-engine';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const body = await request.json();
    const { webhook_type, webhook_code, item_id } = body;

    // Log webhook event
    await supabase.from('webhook_event').insert({
      source: 'plaid',
      event_type: `${webhook_type}.${webhook_code}`,
      payload_json: body,
    });

    // Handle transactions update webhook
    if (webhook_type === 'TRANSACTIONS' && webhook_code === 'DEFAULT_UPDATE') {
      // Get account by plaid_item_id
      const { data: account } = await supabase
        .from('account')
        .select('*, household:household_id(*)')
        .eq('plaid_item_id', item_id)
        .single();

      if (!account) {
        console.error('[Webhook] Account not found for item_id:', item_id);
        return NextResponse.json({ received: true });
      }

      let accessToken: string;
      try {
        accessToken = decryptString(account.plaid_access_token_encrypted);
      } catch (decryptError: any) {
        console.error('[Webhook] Failed to decrypt Plaid token:', decryptError);
        return NextResponse.json({ received: true });
      }

      // Fetch full transaction details from Plaid
      const transactionsResponse = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
      });

      const transactions = transactionsResponse.data.transactions;

      // Insert/update transactions in database
      for (const tx of transactions) {
        // Normalize merchant name (basic for now)
        const merchantNorm = tx.merchant_name || tx.name || 'Unknown';

        // Insert transaction (upsert on external_id)
        const { data: insertedTx } = await supabase
          .from('transaction')
          .upsert({
            account_id: account.id,
            external_id: tx.transaction_id,
            posted_at: tx.date,
            amount: -tx.amount, // Plaid uses positive for debits, we use negative
            currency: tx.iso_currency_code || 'USD',
            merchant_raw: tx.name,
            merchant_norm: merchantNorm,
            is_pending: tx.pending,
            plaid_category: tx.category,
            memo: tx.original_description,
          }, {
            onConflict: 'account_id,external_id',
          })
          .select()
          .single();

        if (!insertedTx) continue;

        // Skip if pending, transfer, or already has splits
        if (insertedTx.is_pending || insertedTx.is_transfer || insertedTx.is_personal) {
          continue;
        }

        // Check if splits already computed
        const { data: existingSplits } = await supabase
          .from('split_ledger')
          .select('id')
          .eq('transaction_id', insertedTx.id)
          .limit(1);

        if (existingSplits && existingSplits.length > 0) {
          continue; // Already has splits
        }

        // Get household members and config
        const { data: members } = await supabase
          .from('membership')
          .select('user_id, income_monthly, weight')
          .eq('household_id', account.household_id);

        if (!members || members.length === 0) continue;

        const householdMembers: HouseholdMember[] = members.map((m) => ({
          userId: m.user_id,
          incomeMonthly: m.income_monthly || undefined,
          weight: m.weight || undefined,
        }));

        // Get split config (default to income-weighted)
        // TODO: Get from household settings
        const config: SplitConfig = {
          mode: 'incomeWeighted',
        };

        // Compute splits
        const splits = computeTransactionSplits({
          transaction: {
            id: insertedTx.id,
            amount: insertedTx.amount,
            categoryId: insertedTx.category_id || undefined,
            isPending: insertedTx.is_pending,
            isTransfer: insertedTx.is_transfer,
            isPersonal: insertedTx.is_personal,
          },
          payerId: account.owner_user_id,
          householdMembers,
          config,
        });

        // Insert split ledger entries
        for (const split of splits) {
          await supabase.from('split_ledger').insert({
            household_id: account.household_id,
            transaction_id: insertedTx.id,
            payer_user_id: split.payer,
            payee_user_id: split.payee,
            amount: split.amount,
            rationale: split.rationale,
          });
        }
      }

      // Mark webhook as processed
      await supabase
        .from('webhook_event')
        .update({ processed_at: new Date().toISOString() })
        .eq('source', 'plaid')
        .eq('event_type', `${webhook_type}.${webhook_code}`)
        .order('created_at', { ascending: false })
        .limit(1);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Plaid Webhook Error]:', error);

    // Log error but still return 200 to avoid Plaid retries
    return NextResponse.json({ received: true, error: error.message });
  }
}
