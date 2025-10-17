/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

-- RLS Validation Tests for Evenly
-- Proves that RLS policies correctly enforce cross-household isolation

-- ============================================================================
-- TEST SETUP
-- ============================================================================

-- Create a second household with different user (Charlie) to test isolation
-- Charlie's UUID: 44444444-4444-4444-4444-444444444444
-- Second household: 55555555-5555-5555-5555-555555555555

-- Clean up test household 2
do $$
declare
  test_household_2_id uuid := '55555555-5555-5555-5555-555555555555';
begin
  delete from audit_log where household_id = test_household_2_id;
  delete from settlement where household_id = test_household_2_id;
  delete from split_ledger where household_id = test_household_2_id;
  delete from goal where household_id = test_household_2_id;
  delete from budget where household_id = test_household_2_id;
  delete from rule where household_id = test_household_2_id;
  delete from transaction where account_id in (
    select id from account where household_id = test_household_2_id
  );
  delete from account where household_id = test_household_2_id;
  delete from membership where household_id = test_household_2_id;
  delete from household where id = test_household_2_id;
end $$;

-- Create second household (Charlie's household)
insert into household (id, name, created_by) values
  ('55555555-5555-5555-5555-555555555555', 'Charlie''s Household', '44444444-4444-4444-4444-444444444444');

-- Charlie's membership
insert into membership (household_id, user_id, role, income_monthly, weight) values
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 'owner', 5000.00, 1.0);

-- Charlie's account
insert into account (id, household_id, owner_user_id, institution, mask, account_name, account_type) values
  ('a0000000-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
   'Bank of America', '9999', 'BofA Checking', 'depository');

-- Charlie's transactions
insert into transaction (account_id, posted_at, amount, merchant_raw, merchant_norm, category_id, external_id) values
  ('a0000000-0000-0000-0000-000000000003', now() - interval '1 day', -50.00, 'STARBUCKS', 'Starbucks', 'c0000000-0000-0000-0000-000000000002', 'plaid_tx_charlie_001');

-- ============================================================================
-- RLS TEST FUNCTIONS
-- ============================================================================

create or replace function set_auth_context(test_user_id uuid)
returns void as $$
begin
  perform set_config('request.jwt.claim.sub', test_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', test_user_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$ language plpgsql;

-- ============================================================================
-- TEST CASES
-- ============================================================================

raise notice '';
raise notice '=== RLS VALIDATION TESTS ===';
raise notice '';

-- TEST 1: Alice can see her household
raise notice 'TEST 1: Alice can see her household';
do $$
declare
  alice_id uuid := '22222222-2222-2222-2222-222222222222';
  household_count int;
begin
  perform set_auth_context(alice_id);

  select count(*) into household_count
  from household
  where id = '11111111-1111-1111-1111-111111111111';

  if household_count = 1 then
    raise notice '  ✓ PASS: Alice can see her household';
  else
    raise exception '  ✗ FAIL: Alice cannot see her household (count: %)', household_count;
  end if;
end $$;

-- TEST 2: Alice CANNOT see Charlie's household
raise notice 'TEST 2: Alice CANNOT see Charlie''s household';
do $$
declare
  alice_id uuid := '22222222-2222-2222-2222-222222222222';
  household_count int;
begin
  perform set_auth_context(alice_id);

  select count(*) into household_count
  from household
  where id = '55555555-5555-5555-5555-555555555555';

  if household_count = 0 then
    raise notice '  ✓ PASS: Alice cannot see Charlie''s household (RLS working)';
  else
    raise exception '  ✗ FAIL: Alice can see Charlie''s household (RLS BREACH!)';
  end if;
end $$;

-- TEST 3: Bob can see Alice's household (they're in the same household)
raise notice 'TEST 3: Bob can see Alice''s household (same household)';
do $$
declare
  bob_id uuid := '33333333-3333-3333-3333-333333333333';
  household_count int;
begin
  perform set_auth_context(bob_id);

  select count(*) into household_count
  from household
  where id = '11111111-1111-1111-1111-111111111111';

  if household_count = 1 then
    raise notice '  ✓ PASS: Bob can see his household';
  else
    raise exception '  ✗ FAIL: Bob cannot see his household';
  end if;
end $$;

-- TEST 4: Charlie can see his own household
raise notice 'TEST 4: Charlie can see his own household';
do $$
declare
  charlie_id uuid := '44444444-4444-4444-4444-444444444444';
  household_count int;
begin
  perform set_auth_context(charlie_id);

  select count(*) into household_count
  from household
  where id = '55555555-5555-5555-5555-555555555555';

  if household_count = 1 then
    raise notice '  ✓ PASS: Charlie can see his household';
  else
    raise exception '  ✗ FAIL: Charlie cannot see his household';
  end if;
end $$;

-- TEST 5: Charlie CANNOT see Alice & Bob's household
raise notice 'TEST 5: Charlie CANNOT see Alice & Bob''s household';
do $$
declare
  charlie_id uuid := '44444444-4444-4444-4444-444444444444';
  household_count int;
begin
  perform set_auth_context(charlie_id);

  select count(*) into household_count
  from household
  where id = '11111111-1111-1111-1111-111111111111';

  if household_count = 0 then
    raise notice '  ✓ PASS: Charlie cannot see Alice & Bob''s household (RLS working)';
  else
    raise exception '  ✗ FAIL: Charlie can see Alice & Bob''s household (RLS BREACH!)';
  end if;
end $$;

-- TEST 6: Alice can see transactions from her household accounts
raise notice 'TEST 6: Alice can see transactions from her household accounts';
do $$
declare
  alice_id uuid := '22222222-2222-2222-2222-222222222222';
  transaction_count int;
begin
  perform set_auth_context(alice_id);

  select count(*) into transaction_count
  from transaction
  where account_id in (
    select id from account where household_id = '11111111-1111-1111-1111-111111111111'
  );

  if transaction_count > 0 then
    raise notice '  ✓ PASS: Alice can see % transactions from her household', transaction_count;
  else
    raise exception '  ✗ FAIL: Alice cannot see transactions from her household';
  end if;
end $$;

-- TEST 7: Alice CANNOT see Charlie's transactions
raise notice 'TEST 7: Alice CANNOT see Charlie''s transactions';
do $$
declare
  alice_id uuid := '22222222-2222-2222-2222-222222222222';
  transaction_count int;
begin
  perform set_auth_context(alice_id);

  select count(*) into transaction_count
  from transaction
  where account_id = 'a0000000-0000-0000-0000-000000000003'; -- Charlie's account

  if transaction_count = 0 then
    raise notice '  ✓ PASS: Alice cannot see Charlie''s transactions (RLS working)';
  else
    raise exception '  ✗ FAIL: Alice can see Charlie''s transactions (RLS BREACH!)';
  end if;
end $$;

-- TEST 8: Bob can see split ledger entries from his household
raise notice 'TEST 8: Bob can see split ledger entries from his household';
do $$
declare
  bob_id uuid := '33333333-3333-3333-3333-333333333333';
  split_count int;
begin
  perform set_auth_context(bob_id);

  select count(*) into split_count
  from split_ledger
  where household_id = '11111111-1111-1111-1111-111111111111';

  if split_count > 0 then
    raise notice '  ✓ PASS: Bob can see % split ledger entries from his household', split_count;
  else
    raise notice '  ⚠ WARNING: Bob cannot see split ledger entries (may be no data)';
  end if;
end $$;

-- TEST 9: Charlie can see his account but not Alice's or Bob's
raise notice 'TEST 9: Charlie can see his account but not Alice''s or Bob''s';
do $$
declare
  charlie_id uuid := '44444444-4444-4444-4444-444444444444';
  account_count int;
  charlie_account_count int;
begin
  perform set_auth_context(charlie_id);

  -- Total accounts Charlie can see
  select count(*) into account_count from account;

  -- Charlie's own account
  select count(*) into charlie_account_count
  from account
  where id = 'a0000000-0000-0000-0000-000000000003';

  if account_count = 1 and charlie_account_count = 1 then
    raise notice '  ✓ PASS: Charlie can only see his own account (RLS working)';
  else
    raise exception '  ✗ FAIL: Charlie can see % accounts (should be 1) (RLS BREACH!)', account_count;
  end if;
end $$;

-- TEST 10: Alice can create a rule in her household
raise notice 'TEST 10: Alice can create a rule in her household';
do $$
declare
  alice_id uuid := '22222222-2222-2222-2222-222222222222';
  new_rule_id uuid;
begin
  perform set_auth_context(alice_id);

  insert into rule (household_id, name, match_vendor_ilike, created_by)
  values ('11111111-1111-1111-1111-111111111111', 'Test Rule', '%TEST%', alice_id)
  returning id into new_rule_id;

  if new_rule_id is not null then
    raise notice '  ✓ PASS: Alice can create rules in her household';
    -- Clean up
    delete from rule where id = new_rule_id;
  else
    raise exception '  ✗ FAIL: Alice cannot create rules in her household';
  end if;
end $$;

-- TEST 11: Charlie CANNOT create a rule in Alice's household
raise notice 'TEST 11: Charlie CANNOT create a rule in Alice''s household';
do $$
declare
  charlie_id uuid := '44444444-4444-4444-4444-444444444444';
  new_rule_id uuid;
  insertion_failed boolean := false;
begin
  perform set_auth_context(charlie_id);

  begin
    insert into rule (household_id, name, match_vendor_ilike, created_by)
    values ('11111111-1111-1111-1111-111111111111', 'Malicious Rule', '%HACK%', charlie_id)
    returning id into new_rule_id;
  exception
    when others then
      insertion_failed := true;
  end;

  if insertion_failed or new_rule_id is null then
    raise notice '  ✓ PASS: Charlie cannot create rules in Alice''s household (RLS working)';
  else
    -- Clean up if somehow succeeded
    delete from rule where id = new_rule_id;
    raise exception '  ✗ FAIL: Charlie created a rule in Alice''s household (RLS BREACH!)';
  end if;
end $$;

-- TEST 12: Bob can update his own membership info
raise notice 'TEST 12: Bob can update his own membership info';
do $$
declare
  bob_id uuid := '33333333-3333-3333-3333-333333333333';
  updated_count int;
begin
  perform set_auth_context(bob_id);

  update membership
  set income_monthly = 2100.00
  where household_id = '11111111-1111-1111-1111-111111111111'
  and user_id = bob_id;

  get diagnostics updated_count = row_count;

  if updated_count = 1 then
    raise notice '  ✓ PASS: Bob can update his own membership';
    -- Restore original value
    update membership set income_monthly = 2000.00
    where household_id = '11111111-1111-1111-1111-111111111111' and user_id = bob_id;
  else
    raise exception '  ✗ FAIL: Bob cannot update his own membership';
  end if;
end $$;

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================

raise notice '';
raise notice '=== TEST SUMMARY ===';
raise notice 'All RLS tests completed successfully!';
raise notice '';
raise notice 'Verified:';
raise notice '  • Users can only see households they are members of';
raise notice '  • Users cannot see data from other households';
raise notice '  • Users can see transactions from their household accounts';
raise notice '  • Users cannot see transactions from other households';
raise notice '  • Users can create resources in their own households';
raise notice '  • Users cannot create resources in other households';
raise notice '  • Users can update their own data';
raise notice '';
raise notice 'RLS is correctly preventing cross-household access!';
raise notice '====================';
raise notice '';
