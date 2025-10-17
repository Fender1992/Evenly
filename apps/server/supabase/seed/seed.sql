/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

-- Seed script for Evenly
-- Creates test data: 2 users, 1 household, transactions, and splits

-- IMPORTANT: This script assumes you've already created 2 test users in Supabase Auth
-- Use these UUIDs or replace with actual user IDs from your Supabase Auth

-- ============================================================================
-- SETUP
-- ============================================================================

-- Clean up existing test data (idempotent)
do $$
declare
  test_household_id uuid := '11111111-1111-1111-1111-111111111111';
begin
  delete from audit_log where household_id = test_household_id;
  delete from settlement where household_id = test_household_id;
  delete from split_ledger where household_id = test_household_id;
  delete from goal where household_id = test_household_id;
  delete from budget where household_id = test_household_id;
  delete from rule where household_id = test_household_id;
  delete from transaction where account_id in (
    select id from account where household_id = test_household_id
  );
  delete from account where household_id = test_household_id;
  delete from membership where household_id = test_household_id;
  delete from household where id = test_household_id;
end $$;

-- ============================================================================
-- TEST USERS (you must create these in Supabase Auth first)
-- ============================================================================

-- User 1: Alice (owner) - Replace with actual UUID from Supabase Auth
-- User 2: Bob (member) - Replace with actual UUID from Supabase Auth

-- For testing, we'll use fixed UUIDs that you'll need to create in Supabase Auth:
-- alice@example.com -> 22222222-2222-2222-2222-222222222222
-- bob@example.com   -> 33333333-3333-3333-3333-333333333333

-- ============================================================================
-- SEED SYSTEM CATEGORIES
-- ============================================================================

insert into category (id, name, is_system, icon) values
  ('c0000000-0000-0000-0000-000000000001', 'Groceries', true, '🛒'),
  ('c0000000-0000-0000-0000-000000000002', 'Dining', true, '🍽️'),
  ('c0000000-0000-0000-0000-000000000003', 'Transport', true, '🚗'),
  ('c0000000-0000-0000-0000-000000000004', 'Utilities', true, '💡'),
  ('c0000000-0000-0000-0000-000000000005', 'Entertainment', true, '🎬'),
  ('c0000000-0000-0000-0000-000000000006', 'Healthcare', true, '🏥'),
  ('c0000000-0000-0000-0000-000000000007', 'Shopping', true, '🛍️'),
  ('c0000000-0000-0000-0000-000000000008', 'Rent/Mortgage', true, '🏠'),
  ('c0000000-0000-0000-0000-000000000009', 'Insurance', true, '🛡️'),
  ('c0000000-0000-0000-0000-000000000010', 'Other', true, '📌')
on conflict (id) do nothing;

-- ============================================================================
-- SEED HOUSEHOLD
-- ============================================================================

insert into household (id, name, created_by, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'Alice & Bob''s Household', '22222222-2222-2222-2222-222222222222', now());

-- ============================================================================
-- SEED MEMBERSHIPS
-- ============================================================================

-- Alice (owner, $4000/month income, weight 0.6)
insert into membership (household_id, user_id, role, income_monthly, weight) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'owner', 4000.00, 0.6);

-- Bob (member, $2000/month income, weight 0.4)
insert into membership (household_id, user_id, role, income_monthly, weight) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'member', 2000.00, 0.4);

-- ============================================================================
-- SEED ACCOUNTS
-- ============================================================================

-- Alice's checking account
insert into account (id, household_id, owner_user_id, institution, mask, account_name, account_type) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   'Chase', '1234', 'Chase Checking', 'depository');

-- Bob's checking account
insert into account (id, household_id, owner_user_id, institution, mask, account_name, account_type) values
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'Wells Fargo', '5678', 'Wells Fargo Checking', 'depository');

-- ============================================================================
-- SEED TRANSACTIONS
-- ============================================================================

-- Alice's transactions (last 30 days)
insert into transaction (account_id, posted_at, amount, merchant_raw, merchant_norm, category_id, is_pending, is_transfer, external_id) values
  ('a0000000-0000-0000-0000-000000000001', now() - interval '1 day', -120.50, 'WHOLE FOODS #123', 'Whole Foods', 'c0000000-0000-0000-0000-000000000001', false, false, 'plaid_tx_001'),
  ('a0000000-0000-0000-0000-000000000001', now() - interval '3 days', -45.00, 'UBER TRIP', 'Uber', 'c0000000-0000-0000-0000-000000000003', false, false, 'plaid_tx_002'),
  ('a0000000-0000-0000-0000-000000000001', now() - interval '5 days', -85.30, 'CHIPOTLE #456', 'Chipotle', 'c0000000-0000-0000-0000-000000000002', false, false, 'plaid_tx_003'),
  ('a0000000-0000-0000-0000-000000000001', now() - interval '7 days', -1500.00, 'RENT PAYMENT', 'Rent', 'c0000000-0000-0000-0000-000000000008', false, false, 'plaid_tx_004'),
  ('a0000000-0000-0000-0000-000000000001', now() - interval '10 days', -55.00, 'TARGET #789', 'Target', 'c0000000-0000-0000-0000-000000000007', false, false, 'plaid_tx_005'),
  ('a0000000-0000-0000-0000-000000000001', now() - interval '12 days', -200.00, 'PG&E UTILITY', 'PG&E', 'c0000000-0000-0000-0000-000000000004', false, false, 'plaid_tx_006');

-- Bob's transactions
insert into transaction (account_id, posted_at, amount, merchant_raw, merchant_norm, category_id, is_pending, is_transfer, external_id) values
  ('a0000000-0000-0000-0000-000000000002', now() - interval '2 days', -75.20, 'SAFEWAY #321', 'Safeway', 'c0000000-0000-0000-0000-000000000001', false, false, 'plaid_tx_007'),
  ('a0000000-0000-0000-0000-000000000002', now() - interval '4 days', -30.00, 'NETFLIX SUBSCRIPTION', 'Netflix', 'c0000000-0000-0000-0000-000000000005', false, false, 'plaid_tx_008'),
  ('a0000000-0000-0000-0000-000000000002', now() - interval '6 days', -60.00, 'OLIVE GARDEN', 'Olive Garden', 'c0000000-0000-0000-0000-000000000002', false, false, 'plaid_tx_009'),
  ('a0000000-0000-0000-0000-000000000002', now() - interval '8 days', -120.00, 'INTERNET BILL', 'Comcast', 'c0000000-0000-0000-0000-000000000004', false, false, 'plaid_tx_010');

-- ============================================================================
-- SEED RULES (auto-categorization)
-- ============================================================================

insert into rule (household_id, name, match_vendor_ilike, category_id, priority, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'Groceries - Whole Foods', '%WHOLE FOODS%', 'c0000000-0000-0000-0000-000000000001', 100, '22222222-2222-2222-2222-222222222222'),
  ('11111111-1111-1111-1111-111111111111', 'Groceries - Safeway', '%SAFEWAY%', 'c0000000-0000-0000-0000-000000000001', 100, '22222222-2222-2222-2222-222222222222'),
  ('11111111-1111-1111-1111-111111111111', 'Transport - Uber', '%UBER%', 'c0000000-0000-0000-0000-000000000003', 100, '22222222-2222-2222-2222-222222222222'),
  ('11111111-1111-1111-1111-111111111111', 'Dining - Chipotle', '%CHIPOTLE%', 'c0000000-0000-0000-0000-000000000002', 100, '22222222-2222-2222-2222-222222222222'),
  ('11111111-1111-1111-1111-111111111111', 'Entertainment - Netflix', '%NETFLIX%', 'c0000000-0000-0000-0000-000000000005', 100, '33333333-3333-3333-3333-333333333333');

-- Rule with custom split (Dining 70/30 - Alice pays more)
insert into rule (household_id, name, match_vendor_ilike, category_id, split_override_json, priority, created_by) values
  ('11111111-1111-1111-1111-111111111111', 'Dining - Custom Split', '%OLIVE GARDEN%', 'c0000000-0000-0000-0000-000000000002',
   '{"mode":"custom","weights":{"22222222-2222-2222-2222-222222222222":0.7,"33333333-3333-3333-3333-333333333333":0.3}}',
   90, '22222222-2222-2222-2222-222222222222');

-- ============================================================================
-- SEED BUDGETS
-- ============================================================================

-- Monthly budget for groceries: $400
insert into budget (household_id, category_id, period_start, period_end, amount_limit, is_hard_limit) values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001',
   date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date,
   400.00, false);

-- Monthly budget for dining: $300 (hard limit)
insert into budget (household_id, category_id, period_start, period_end, amount_limit, is_hard_limit) values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000002',
   date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date,
   300.00, true);

-- ============================================================================
-- SEED GOALS
-- ============================================================================

-- Vacation fund goal
insert into goal (household_id, name, target_amount, current_amount, target_date, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'Summer Vacation 2025', 3000.00, 500.00, '2025-06-01', true);

-- Emergency fund
insert into goal (household_id, name, target_amount, current_amount, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'Emergency Fund', 10000.00, 2000.00, true);

-- ============================================================================
-- SEED SPLIT LEDGER (computed from transactions)
-- ============================================================================

-- These would normally be computed by the split-engine, but for seeding we'll manually create them
-- Using income-weighted splits (Alice 60%, Bob 40%)

-- Split for Whole Foods groceries ($120.50) - Alice paid, Bob owes 40% = $48.20
insert into split_ledger (household_id, transaction_id, payer_user_id, payee_user_id, amount, rationale)
select
  '11111111-1111-1111-1111-111111111111',
  id,
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  48.20,
  'Income-weighted split (40%)'
from transaction where external_id = 'plaid_tx_001';

-- Split for rent ($1500) - Alice paid, Bob owes 40% = $600
insert into split_ledger (household_id, transaction_id, payer_user_id, payee_user_id, amount, rationale)
select
  '11111111-1111-1111-1111-111111111111',
  id,
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  600.00,
  'Income-weighted split (40%)'
from transaction where external_id = 'plaid_tx_004';

-- Split for Safeway groceries ($75.20) - Bob paid, Alice owes 60% = $45.12
insert into split_ledger (household_id, transaction_id, payer_user_id, payee_user_id, amount, rationale)
select
  '11111111-1111-1111-1111-111111111111',
  id,
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  45.12,
  'Income-weighted split (60%)'
from transaction where external_id = 'plaid_tx_007';

-- Split for Olive Garden ($60) - Bob paid, custom 70/30 rule, Alice owes 70% = $42.00
insert into split_ledger (household_id, transaction_id, payer_user_id, payee_user_id, amount, rationale)
select
  '11111111-1111-1111-1111-111111111111',
  id,
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  42.00,
  'Custom split rule: Dining 70/30'
from transaction where external_id = 'plaid_tx_009';

-- ============================================================================
-- SEED SETTLEMENT
-- ============================================================================

-- Bob settled $200 with Alice via Venmo (partial settlement)
insert into settlement (household_id, from_user_id, to_user_id, amount, method, reference, note) values
  ('11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222',
   200.00,
   'venmo',
   '@alice-venmo',
   'Partial settlement for November');

-- ============================================================================
-- SEED AUDIT LOG
-- ============================================================================

insert into audit_log (household_id, user_id, action, subject_type, subject_id, meta_json) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'household.created', 'household', '11111111-1111-1111-1111-111111111111', '{"source":"web"}'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'account.connected', 'account', 'a0000000-0000-0000-0000-000000000001', '{"institution":"Chase"}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'account.connected', 'account', 'a0000000-0000-0000-0000-000000000002', '{"institution":"Wells Fargo"}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'settlement.created', 'settlement', null, '{"amount":200.00,"method":"venmo"}');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Summary of what was created
do $$
declare
  household_count int;
  membership_count int;
  account_count int;
  transaction_count int;
  split_count int;
  settlement_count int;
begin
  select count(*) into household_count from household where id = '11111111-1111-1111-1111-111111111111';
  select count(*) into membership_count from membership where household_id = '11111111-1111-1111-1111-111111111111';
  select count(*) into account_count from account where household_id = '11111111-1111-1111-1111-111111111111';
  select count(*) into transaction_count from transaction where account_id in (
    select id from account where household_id = '11111111-1111-1111-1111-111111111111'
  );
  select count(*) into split_count from split_ledger where household_id = '11111111-1111-1111-1111-111111111111';
  select count(*) into settlement_count from settlement where household_id = '11111111-1111-1111-1111-111111111111';

  raise notice '=== SEED DATA SUMMARY ===';
  raise notice 'Households: %', household_count;
  raise notice 'Memberships: %', membership_count;
  raise notice 'Accounts: %', account_count;
  raise notice 'Transactions: %', transaction_count;
  raise notice 'Split Ledger Entries: %', split_count;
  raise notice 'Settlements: %', settlement_count;
  raise notice '========================';
end $$;

-- Calculate current balance (who owes whom)
-- Bob owes Alice: $48.20 + $600.00 - $200 (settlement) = $448.20
-- Alice owes Bob: $45.12 + $42.00 = $87.12
-- Net: Bob owes Alice $361.08

select
  'Current Balance: Bob owes Alice $' ||
  round(
    (select coalesce(sum(amount), 0) from split_ledger
     where household_id = '11111111-1111-1111-1111-111111111111'
     and payer_user_id = '22222222-2222-2222-2222-222222222222'
     and payee_user_id = '33333333-3333-3333-3333-333333333333')
    -
    (select coalesce(sum(amount), 0) from split_ledger
     where household_id = '11111111-1111-1111-1111-111111111111'
     and payer_user_id = '33333333-3333-3333-3333-333333333333'
     and payee_user_id = '22222222-2222-2222-2222-222222222222')
    -
    (select coalesce(sum(amount), 0) from settlement
     where household_id = '11111111-1111-1111-1111-111111111111'
     and from_user_id = '33333333-3333-3333-3333-333333333333'
     and to_user_id = '22222222-2222-2222-2222-222222222222')
  , 2) as balance_summary;
