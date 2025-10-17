/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeTransactionSplits, type HouseholdMember, type SplitConfig } from '@evenly/split-engine';

// POST /api/splits/recompute
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

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
    const { household_id, transaction_id } = body;

    if (!household_id) {
      return NextResponse.json({ error: 'Missing household_id' }, { status: 400 });
    }

    // Verify user is admin of household
    const { data: membership } = await supabase
      .from('membership')
      .select('*')
      .eq('household_id', household_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Must be household admin to recompute splits' },
        { status: 403 }
      );
    }

    let transactionsToRecompute: any[] = [];

    if (transaction_id) {
      // Recompute single transaction
      const { data: transaction } = await supabase
        .from('transaction')
        .select('*, account:account_id(*)')
        .eq('id', transaction_id)
        .single();

      if (!transaction || transaction.account.household_id !== household_id) {
        return NextResponse.json(
          { error: 'Transaction not found or not in household' },
          { status: 404 }
        );
      }

      transactionsToRecompute = [transaction];
    } else {
      // Recompute all transactions in household
      const { data: accounts } = await supabase
        .from('account')
        .select('id')
        .eq('household_id', household_id);

      const accountIds = accounts?.map((a) => a.id) || [];

      const { data: transactions } = await supabase
        .from('transaction')
        .select('*, account:account_id(*)')
        .in('account_id', accountIds)
        .eq('is_pending', false);

      transactionsToRecompute = transactions || [];
    }

    // Get household members
    const { data: members } = await supabase
      .from('membership')
      .select('user_id, income_monthly, weight')
      .eq('household_id', household_id);

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'No members found' }, { status: 400 });
    }

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

    let recomputedCount = 0;

    for (const tx of transactionsToRecompute) {
      // Delete existing splits for this transaction
      await supabase
        .from('split_ledger')
        .delete()
        .eq('transaction_id', tx.id);

      // Skip if pending, transfer, or personal
      if (tx.is_pending || tx.is_transfer || tx.is_personal) {
        continue;
      }

      // Compute new splits
      const splits = computeTransactionSplits({
        transaction: {
          id: tx.id,
          amount: tx.amount,
          categoryId: tx.category_id || undefined,
          isPending: tx.is_pending,
          isTransfer: tx.is_transfer,
          isPersonal: tx.is_personal,
        },
        payerId: tx.account.owner_user_id,
        householdMembers,
        config,
      });

      // Insert new splits
      for (const split of splits) {
        await supabase.from('split_ledger').insert({
          household_id,
          transaction_id: tx.id,
          payer_user_id: split.payer,
          payee_user_id: split.payee,
          amount: split.amount,
          rationale: split.rationale,
        });
      }

      recomputedCount++;
    }

    // Log audit event
    await supabase.from('audit_log').insert({
      user_id: user.id,
      household_id,
      action: 'splits.recomputed',
      subject_type: 'household',
      subject_id: household_id,
      meta_json: {
        transaction_id,
        recomputed_count: recomputedCount,
      },
    });

    return NextResponse.json({
      success: true,
      recomputed_count: recomputedCount,
    });
  } catch (error: any) {
    console.error('[Splits Recompute Error]:', error);
    return NextResponse.json(
      { error: 'Failed to recompute splits', details: error.message },
      { status: 500 }
    );
  }
}
