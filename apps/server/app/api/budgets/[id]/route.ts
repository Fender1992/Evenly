/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@server/lib/supabase';

// PATCH /api/budgets/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const budgetId = params.id;
    const body = await request.json();

    // Get budget to verify ownership
    const { data: budget } = await supabase
      .from('budget')
      .select('household_id')
      .eq('id', budgetId)
      .single();

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    // Verify user is member of household
    const { data: membership } = await supabase
      .from('membership')
      .select('*')
      .eq('household_id', budget.household_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Update budget
    const updates: any = {};
    if (body.amount_limit !== undefined) updates.amount_limit = body.amount_limit;
    if (body.period_start !== undefined) updates.period_start = body.period_start;
    if (body.period_end !== undefined) updates.period_end = body.period_end;

    const { data: updatedBudget, error } = await supabase
      .from('budget')
      .update(updates)
      .eq('id', budgetId)
      .select('*, category:category_id(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit event
    await supabase.from('audit_log').insert({
      user_id: user.id,
      household_id: budget.household_id,
      action: 'budget.updated',
      subject_type: 'budget',
      subject_id: budgetId,
      meta_json: { updates },
    });

    return NextResponse.json({ budget: updatedBudget });
  } catch (error: any) {
    console.error('[Budget PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update budget', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/budgets/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const budgetId = params.id;

    // Get budget to verify ownership
    const { data: budget } = await supabase
      .from('budget')
      .select('household_id')
      .eq('id', budgetId)
      .single();

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    // Verify user is member of household
    const { data: membership } = await supabase
      .from('membership')
      .select('*')
      .eq('household_id', budget.household_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Delete budget
    const { error } = await supabase
      .from('budget')
      .delete()
      .eq('id', budgetId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit event
    await supabase.from('audit_log').insert({
      user_id: user.id,
      household_id: budget.household_id,
      action: 'budget.deleted',
      subject_type: 'budget',
      subject_id: budgetId,
      meta_json: {},
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Budget DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Failed to delete budget', details: error.message },
      { status: 500 }
    );
  }
}
