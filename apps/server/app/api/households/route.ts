/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@server/lib/supabase';

const createHouseholdSchema = z.object({
  name: z.string().min(1, 'Household name is required'),
  incomeMonthly: z.number().nonnegative().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestBody = await request.json();
    const { name, incomeMonthly } = createHouseholdSchema.parse(requestBody);

    // Ensure the user is not already part of a household
    const { data: existingMembership, error: membershipError } = await supabase
      .from('membership')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError && membershipError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Failed to verify household membership', details: membershipError.message },
        { status: 500 }
      );
    }

    if (existingMembership?.household_id) {
      return NextResponse.json(
        { error: 'User already belongs to a household' },
        { status: 400 }
      );
    }

    const { data: household, error: householdError } = await supabase
      .from('household')
      .insert({
        name,
        created_by: user.id,
      })
      .select()
      .single();

    if (householdError || !household) {
      return NextResponse.json(
        { error: 'Failed to create household', details: householdError?.message },
        { status: 500 }
      );
    }

    const { error: membershipInsertError } = await supabase.from('membership').insert({
      household_id: household.id,
      user_id: user.id,
      role: 'owner',
      income_monthly: incomeMonthly ?? null,
      weight: 1.0,
    });

    if (membershipInsertError) {
      return NextResponse.json(
        { error: 'Failed to create membership', details: membershipInsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        household,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Household Create Error]:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create household', details: error.message },
      { status: 500 }
    );
  }
}
