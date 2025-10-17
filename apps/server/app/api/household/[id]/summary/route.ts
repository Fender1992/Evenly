/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const householdId = params.id;

    // Verify user is member of household
    const { data: membership } = await supabase
      .from('membership')
      .select('*')
      .eq('household_id', householdId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Get household info
    const { data: household } = await supabase
      .from('household')
      .select('*')
      .eq('id', householdId)
      .single();

    // Get all members
    const { data: members } = await supabase
      .from('membership')
      .select('*')
      .eq('household_id', householdId);

    // Get month parameter (default to current month)
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('m') || new Date().toISOString().slice(0, 7);
    const [year, monthNum] = month.split('-').map(Number);
    const periodStart = new Date(year, monthNum - 1, 1);
    const periodEnd = new Date(year, monthNum, 0, 23, 59, 59);

    // Get transactions for the month
    const { data: accounts } = await supabase
      .from('account')
      .select('id')
      .eq('household_id', householdId);

    const accountIds = accounts?.map((a) => a.id) || [];

    const { data: transactions } = await supabase
      .from('transaction')
      .select('*')
      .in('account_id', accountIds)
      .gte('posted_at', periodStart.toISOString())
      .lte('posted_at', periodEnd.toISOString())
      .eq('is_pending', false)
      .order('posted_at', { ascending: false });

    // Calculate totals
    const totalSpent = transactions?.reduce((sum, tx) => {
      if (tx.amount < 0 && !tx.is_personal) {
        return sum + Math.abs(tx.amount);
      }
      return sum;
    }, 0) || 0;

    const personalSpent = transactions?.reduce((sum, tx) => {
      if (tx.amount < 0 && tx.is_personal) {
        return sum + Math.abs(tx.amount);
      }
      return sum;
    }, 0) || 0;

    // Get split ledger balances
    const { data: splits } = await supabase
      .from('split_ledger')
      .select('*')
      .eq('household_id', householdId);

    // Calculate balances (who owes whom)
    const balances: Record<string, Record<string, number>> = {};

    for (const split of splits || []) {
      if (!balances[split.payer_user_id]) {
        balances[split.payer_user_id] = {};
      }
      if (!balances[split.payer_user_id][split.payee_user_id]) {
        balances[split.payer_user_id][split.payee_user_id] = 0;
      }
      balances[split.payer_user_id][split.payee_user_id] += split.amount;
    }

    // Get settlements to subtract from balances
    const { data: settlements } = await supabase
      .from('settlement')
      .select('*')
      .eq('household_id', householdId);

    for (const settlement of settlements || []) {
      if (!balances[settlement.to_user_id]) {
        balances[settlement.to_user_id] = {};
      }
      if (!balances[settlement.to_user_id][settlement.from_user_id]) {
        balances[settlement.to_user_id][settlement.from_user_id] = 0;
      }
      balances[settlement.to_user_id][settlement.from_user_id] -= settlement.amount;
    }

    // Simplify balances for current user
    let youOwe = 0;
    let owedToYou = 0;

    for (const [payer, payees] of Object.entries(balances)) {
      for (const [payee, amount] of Object.entries(payees)) {
        if (payer === user.id && amount > 0) {
          owedToYou += amount;
        } else if (payee === user.id && amount > 0) {
          youOwe += amount;
        }
      }
    }

    // Get budgets
    const { data: budgets } = await supabase
      .from('budget')
      .select('*, category:category_id(*)')
      .eq('household_id', householdId)
      .gte('period_end', periodStart.toISOString())
      .lte('period_start', periodEnd.toISOString());

    // Get goals
    const { data: goals } = await supabase
      .from('goal')
      .select('*')
      .eq('household_id', householdId)
      .eq('is_active', true);

    return NextResponse.json({
      household,
      members,
      month,
      summary: {
        totalSpent,
        personalSpent,
        sharedSpent: totalSpent,
        youOwe,
        owedToYou,
        netBalance: owedToYou - youOwe,
      },
      transactions: transactions?.slice(0, 20) || [], // Latest 20 for feed
      budgets: budgets || [],
      goals: goals || [],
      balances,
    });
  } catch (error: any) {
    console.error('[Household Summary Error]:', error);
    return NextResponse.json(
      { error: 'Failed to get household summary', details: error.message },
      { status: 500 }
    );
  }
}
