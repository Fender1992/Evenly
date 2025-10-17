/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@server/lib/supabase';

// GET /api/settlements?household_id=...
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

    // Fetch settlements for household
    const { data: settlements, error } = await supabase
      .from('settlement')
      .select('*')
      .eq('household_id', householdId)
      .order('settled_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch user profiles to populate names
    const userIds = new Set<string>();
    settlements?.forEach((s: any) => {
      userIds.add(s.from_user_id);
      userIds.add(s.to_user_id);
    });

    const { data: profiles } = await supabase.auth.admin.listUsers();
    const userMap = new Map();
    profiles.users.forEach((u: any) => {
      if (userIds.has(u.id)) {
        userMap.set(u.id, {
          id: u.id,
          email: u.email,
          user_metadata: u.user_metadata,
        });
      }
    });

    // Enhance settlements with user data
    const enrichedSettlements = settlements?.map((s: any) => ({
      ...s,
      from_user: userMap.get(s.from_user_id),
      to_user: userMap.get(s.to_user_id),
    }));

    return NextResponse.json({ settlements: enrichedSettlements });
  } catch (error: any) {
    console.error('[Settlements GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settlements', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/settlements
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
      to_user_id,
      amount,
      method,
      reference,
      note,
    } = body;

    if (!household_id || !to_user_id || !amount || !method) {
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

    // Verify to_user is also a member
    const { data: toMembership } = await supabase
      .from('membership')
      .select('*')
      .eq('household_id', household_id)
      .eq('user_id', to_user_id)
      .single();

    if (!toMembership) {
      return NextResponse.json(
        { error: 'Recipient not a member of this household' },
        { status: 400 }
      );
    }

    // Create settlement
    const { data: settlement, error } = await supabase
      .from('settlement')
      .insert({
        household_id,
        from_user_id: user.id,
        to_user_id,
        amount,
        method,
        reference,
        note,
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
      action: 'settlement.created',
      subject_type: 'settlement',
      subject_id: settlement.id,
      meta_json: { amount, method, to_user_id },
    });

    return NextResponse.json({ settlement }, { status: 201 });
  } catch (error: any) {
    console.error('[Settlements POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create settlement', details: error.message },
      { status: 500 }
    );
  }
}
