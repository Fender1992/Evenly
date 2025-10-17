/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@server/lib/supabase';

// GET /api/budgets?household_id=...&month=YYYY-MM
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('household_id');
    const month = searchParams.get('month');

    if (!householdId) {
      return NextResponse.json({ error: 'Missing household_id' }, { status: 400 });
    }

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

    // Build query
    let query = supabase
      .from('budget')
      .select('*, category:category_id(*)')
      .eq('household_id', householdId);

    // Filter by month if provided
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const periodStart = new Date(year, monthNum - 1, 1).toISOString();
      const periodEnd = new Date(year, monthNum, 0, 23, 59, 59).toISOString();

      query = query
        .lte('period_start', periodEnd)
        .gte('period_end', periodStart);
    }

    const { data: budgets } = await query.order('created_at', { ascending: false });

    // Calculate spending for each budget
    const budgetsWithSpending = await Promise.all((budgets || []).map(async (budget) => {
      // Get all accounts for household
      const { data: accounts } = await supabase
        .from('account')
        .select('id')
        .eq('household_id', householdId);

      const accountIds = accounts?.map(a => a.id) || [];

      // Get spending in this category for this period
      const { data: transactions } = await supabase
        .from('transaction')
        .select('amount')
        .in('account_id', accountIds)
        .eq('category_id', budget.category_id)
        .gte('posted_at', budget.period_start)
        .lte('posted_at', budget.period_end)
        .eq('is_pending', false);

      const spent = transactions?.reduce((sum, tx) => {
        if (tx.amount < 0) {
          return sum + Math.abs(tx.amount);
        }
        return sum;
      }, 0) || 0;

      return {
        ...budget,
        spent,
        remaining: budget.amount_limit - spent,
        percentage: (spent / budget.amount_limit) * 100,
      };
    }));

    return NextResponse.json({ budgets: budgetsWithSpending });
  } catch (error: any) {
    console.error('[Budgets GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to get budgets', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/budgets
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
    const { household_id, category_id, amount_limit, period_start, period_end } = body;

    if (!household_id || !category_id || !amount_limit || !period_start || !period_end) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Create budget
    const { data: budget, error } = await supabase
      .from('budget')
      .insert({
        household_id,
        category_id,
        amount_limit,
        period_start,
        period_end,
      })
      .select('*, category:category_id(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit event
    await supabase.from('audit_log').insert({
      user_id: user.id,
      household_id,
      action: 'budget.created',
      subject_type: 'budget',
      subject_id: budget.id,
      meta_json: { category_id, amount_limit },
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error: any) {
    console.error('[Budgets POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create budget', details: error.message },
      { status: 500 }
    );
  }
}
