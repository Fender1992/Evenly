/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// PATCH /api/transactions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const transactionId = params.id;
    const body = await request.json();

    // Get transaction with account info
    const { data: transaction } = await supabase
      .from('transaction')
      .select('*, account:account_id(household_id)')
      .eq('id', transactionId)
      .single();

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify user is member of household
    const { data: membership } = await supabase
      .from('membership')
      .select('*')
      .eq('household_id', transaction.account.household_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Update transaction
    const updates: any = {};
    if (body.category_id !== undefined) updates.category_id = body.category_id;
    if (body.is_personal !== undefined) updates.is_personal = body.is_personal;
    if (body.memo !== undefined) updates.memo = body.memo;

    const { data: updatedTransaction, error } = await supabase
      .from('transaction')
      .update(updates)
      .eq('id', transactionId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit event
    await supabase.from('audit_log').insert({
      user_id: user.id,
      household_id: transaction.account.household_id,
      action: 'transaction.updated',
      subject_type: 'transaction',
      subject_id: transactionId,
      meta_json: { updates },
    });

    return NextResponse.json({ transaction: updatedTransaction });
  } catch (error: any) {
    console.error('[Transaction PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction', details: error.message },
      { status: 500 }
    );
  }
}
