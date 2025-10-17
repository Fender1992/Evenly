/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@server/lib/supabase';

// GET /api/rules?household_id=...
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

    // Get rules
    const { data: rules } = await supabase
      .from('rule')
      .select('*, category:category_id(*)')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    return NextResponse.json({ rules: rules || [] });
  } catch (error: any) {
    console.error('[Rules GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to get rules', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/rules
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
    const {
      household_id,
      name,
      match_vendor_ilike,
      category_id,
      split_override_json,
      mark_as_personal,
      priority,
    } = body;

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

    // Create rule
    const { data: rule, error } = await supabase
      .from('rule')
      .insert({
        household_id,
        name,
        match_vendor_ilike,
        category_id,
        split_override_json,
        mark_as_personal,
        priority: priority || 100,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit event
    await supabase.from('audit_log').insert({
      user_id: user.id,
      household_id,
      action: 'rule.created',
      subject_type: 'rule',
      subject_id: rule.id,
      meta_json: { name, match_vendor_ilike },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error: any) {
    console.error('[Rules POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create rule', details: error.message },
      { status: 500 }
    );
  }
}
