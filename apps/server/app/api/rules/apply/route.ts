/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@server/lib/supabase';

function ilikeMatch(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regexPattern = escaped.replace(/%/g, '.*').replace(/_/g, '.');
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(value);
}

// POST /api/rules/apply
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
    const { household_id, transaction_id } = body;

    if (!household_id) {
      return NextResponse.json({ error: 'Missing household_id' }, { status: 400 });
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

    // Get active rules for household
    const { data: rules } = await supabase
      .from('rule')
      .select('*')
      .eq('household_id', household_id)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (!rules || rules.length === 0) {
      return NextResponse.json({ applied_count: 0 });
    }

    // Get transactions to apply rules to
    let query = supabase
      .from('transaction')
      .select('*, account:account_id(household_id)')
      .eq('account.household_id', household_id);

    if (transaction_id) {
      query = query.eq('id', transaction_id);
    }

    const { data: transactions } = await query;

    if (!transactions) {
      return NextResponse.json({ applied_count: 0 });
    }

    let appliedCount = 0;

    for (const transaction of transactions) {
      // Skip if already categorized (unless transaction_id specified)
      if (transaction.category_id && !transaction_id) {
        continue;
      }

      // Try to match rules in priority order
      for (const rule of rules) {
        let matched = false;

        // Check vendor match
        if (rule.match_vendor_ilike) {
          const merchant = transaction.merchant_norm || '';
          if (ilikeMatch(merchant, rule.match_vendor_ilike)) {
            matched = true;
          }
        }

        if (matched) {
          // Apply rule
          const updates: any = {};
          if (rule.category_id) updates.category_id = rule.category_id;
          if (rule.mark_as_personal !== null) updates.is_personal = rule.mark_as_personal;

          await supabase
            .from('transaction')
            .update(updates)
            .eq('id', transaction.id);

          appliedCount++;
          break; // Apply only first matching rule
        }
      }
    }

    // Log audit event
    await supabase.from('audit_log').insert({
      user_id: user.id,
      household_id,
      action: 'rules.applied',
      subject_type: 'household',
      subject_id: household_id,
      meta_json: { applied_count: appliedCount, transaction_id },
    });

    return NextResponse.json({ applied_count: appliedCount });
  } catch (error: any) {
    console.error('[Rules Apply Error]:', error);
    return NextResponse.json(
      { error: 'Failed to apply rules', details: error.message },
      { status: 500 }
    );
  }
}
