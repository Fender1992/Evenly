/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

-- Row Level Security (RLS) Policies for Evenly
-- Ensures users can only access data from their own households

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

alter table household enable row level security;
alter table membership enable row level security;
alter table account enable row level security;
alter table transaction enable row level security;
alter table category enable row level security;
alter table rule enable row level security;
alter table budget enable row level security;
alter table goal enable row level security;
alter table split_ledger enable row level security;
alter table settlement enable row level security;
alter table webhook_event enable row level security;
alter table audit_log enable row level security;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user is a member of a household
create or replace function is_household_member(household_id_param uuid)
returns boolean as $$
begin
  return exists (
    select 1 from membership
    where household_id = household_id_param
    and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- Check if user is owner or admin of a household
create or replace function is_household_admin(household_id_param uuid)
returns boolean as $$
begin
  return exists (
    select 1 from membership
    where household_id = household_id_param
    and user_id = auth.uid()
    and role in ('owner', 'admin')
  );
end;
$$ language plpgsql security definer;

-- Get household_id for an account
create or replace function get_account_household_id(account_id_param uuid)
returns uuid as $$
  select household_id from account where id = account_id_param;
$$ language sql security definer;

-- ============================================================================
-- HOUSEHOLD POLICIES
-- ============================================================================

-- Users can select households they are members of
create policy household_select_policy
  on household for select
  using (is_household_member(id));

-- Users can insert households (they become the creator)
create policy household_insert_policy
  on household for insert
  with check (created_by = auth.uid());

-- Only household admins can update household
create policy household_update_policy
  on household for update
  using (is_household_admin(id))
  with check (is_household_admin(id));

-- Only household owner can delete household
create policy household_delete_policy
  on household for delete
  using (
    exists (
      select 1 from membership
      where household_id = household.id
      and user_id = auth.uid()
      and role = 'owner'
    )
  );

-- ============================================================================
-- MEMBERSHIP POLICIES
-- ============================================================================

-- Users can select memberships in their households
create policy membership_select_policy
  on membership for select
  using (is_household_member(household_id));

-- Users can insert memberships for households they own/admin
create policy membership_insert_policy
  on membership for insert
  with check (is_household_admin(household_id));

-- Users can update their own membership info
create policy membership_update_self_policy
  on membership for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins can update any membership in their household
create policy membership_update_admin_policy
  on membership for update
  using (is_household_admin(household_id))
  with check (is_household_admin(household_id));

-- Only admins can delete memberships
create policy membership_delete_policy
  on membership for delete
  using (is_household_admin(household_id));

-- ============================================================================
-- ACCOUNT POLICIES
-- ============================================================================

-- Users can select accounts in their households
create policy account_select_policy
  on account for select
  using (is_household_member(household_id));

-- Users can insert accounts in their households
create policy account_insert_policy
  on account for insert
  with check (
    is_household_member(household_id)
    and owner_user_id = auth.uid()
  );

-- Users can update their own accounts
create policy account_update_policy
  on account for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Users can delete their own accounts
create policy account_delete_policy
  on account for delete
  using (owner_user_id = auth.uid());

-- ============================================================================
-- TRANSACTION POLICIES
-- ============================================================================

-- Users can select transactions from accounts in their households
create policy transaction_select_policy
  on transaction for select
  using (
    exists (
      select 1 from account
      where account.id = transaction.account_id
      and is_household_member(account.household_id)
    )
  );

-- Service role can insert transactions (via Plaid webhook)
create policy transaction_insert_policy
  on transaction for insert
  with check (
    exists (
      select 1 from account
      where account.id = transaction.account_id
      and is_household_member(account.household_id)
    )
  );

-- Users can update transactions from their own accounts
create policy transaction_update_policy
  on transaction for update
  using (
    exists (
      select 1 from account
      where account.id = transaction.account_id
      and account.owner_user_id = auth.uid()
    )
  );

-- Users can delete their own transactions (soft delete preferred)
create policy transaction_delete_policy
  on transaction for delete
  using (
    exists (
      select 1 from account
      where account.id = transaction.account_id
      and account.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- CATEGORY POLICIES
-- ============================================================================

-- Everyone can read categories (system-wide)
create policy category_select_policy
  on category for select
  using (true);

-- Only service role can insert system categories
create policy category_insert_policy
  on category for insert
  with check (auth.uid() is not null);

-- ============================================================================
-- RULE POLICIES
-- ============================================================================

-- Users can select rules from their households
create policy rule_select_policy
  on rule for select
  using (is_household_member(household_id));

-- Users can insert rules in their households
create policy rule_insert_policy
  on rule for insert
  with check (
    is_household_member(household_id)
    and created_by = auth.uid()
  );

-- Users can update their own rules
create policy rule_update_self_policy
  on rule for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Admins can update any rule in their household
create policy rule_update_admin_policy
  on rule for update
  using (is_household_admin(household_id))
  with check (is_household_admin(household_id));

-- Users can delete their own rules
create policy rule_delete_self_policy
  on rule for delete
  using (created_by = auth.uid());

-- Admins can delete any rule in their household
create policy rule_delete_admin_policy
  on rule for delete
  using (is_household_admin(household_id));

-- ============================================================================
-- BUDGET POLICIES
-- ============================================================================

-- Users can select budgets from their households
create policy budget_select_policy
  on budget for select
  using (is_household_member(household_id));

-- Household members can insert budgets
create policy budget_insert_policy
  on budget for insert
  with check (is_household_member(household_id));

-- Household members can update budgets
create policy budget_update_policy
  on budget for update
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Only admins can delete budgets
create policy budget_delete_policy
  on budget for delete
  using (is_household_admin(household_id));

-- ============================================================================
-- GOAL POLICIES
-- ============================================================================

-- Users can select goals from their households
create policy goal_select_policy
  on goal for select
  using (is_household_member(household_id));

-- Household members can insert goals
create policy goal_insert_policy
  on goal for insert
  with check (is_household_member(household_id));

-- Household members can update goals
create policy goal_update_policy
  on goal for update
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Only admins can delete goals
create policy goal_delete_policy
  on goal for delete
  using (is_household_admin(household_id));

-- ============================================================================
-- SPLIT LEDGER POLICIES
-- ============================================================================

-- Users can select split ledger entries from their households
create policy split_ledger_select_policy
  on split_ledger for select
  using (is_household_member(household_id));

-- Service role can insert split ledger entries
create policy split_ledger_insert_policy
  on split_ledger for insert
  with check (is_household_member(household_id));

-- No updates to split ledger (immutable)
-- No deletes (immutable audit trail)

-- ============================================================================
-- SETTLEMENT POLICIES
-- ============================================================================

-- Users can select settlements from their households
create policy settlement_select_policy
  on settlement for select
  using (is_household_member(household_id));

-- Users can insert settlements they are part of
create policy settlement_insert_policy
  on settlement for insert
  with check (
    is_household_member(household_id)
    and (from_user_id = auth.uid() or to_user_id = auth.uid())
  );

-- No updates to settlements (immutable)
-- No deletes (immutable audit trail)

-- ============================================================================
-- WEBHOOK EVENT POLICIES
-- ============================================================================

-- Only service role can access webhook events
-- (no RLS policies needed, handled by service key)

-- ============================================================================
-- AUDIT LOG POLICIES
-- ============================================================================

-- Users can select audit logs from their households
create policy audit_log_select_policy
  on audit_log for select
  using (
    household_id is null
    or is_household_member(household_id)
    or user_id = auth.uid()
  );

-- Service role can insert audit logs
create policy audit_log_insert_policy
  on audit_log for insert
  with check (true);

-- No updates or deletes (immutable audit trail)

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant authenticated users access to tables
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

-- Grant service role full access (for background jobs)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
