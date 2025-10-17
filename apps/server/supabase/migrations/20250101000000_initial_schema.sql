/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

-- Initial schema for Evenly
-- Requires pgcrypto extension for UUID generation

-- Enable necessary extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Household table
create table household (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Membership table (users in households)
create table membership (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  income_monthly numeric(12,2),
  weight numeric(6,3) default 1.0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (household_id, user_id)
);

-- Account table (bank accounts via Plaid)
create table account (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  owner_user_id uuid not null,
  plaid_item_id text,                   -- encrypted app-side
  plaid_access_token_encrypted text,    -- encrypted plaid access token
  institution text,
  mask text,
  account_name text,
  account_type text,
  account_subtype text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Category table (expense categories)
create table category (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references category(id) on delete set null,
  is_system boolean default false,
  icon text,
  created_at timestamptz default now()
);

-- Transaction table (bank transactions from Plaid)
create table transaction (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references account(id) on delete cascade,
  posted_at timestamptz not null,
  amount numeric(12,2) not null,        -- negative = debit, positive = credit
  currency text default 'USD',
  merchant_raw text,
  merchant_norm text,
  category_id uuid references category(id) on delete set null,
  is_pending boolean default false,
  is_transfer boolean default false,
  is_personal boolean default false,    -- marked as personal (not shared)
  memo text,
  external_id text,                     -- plaid transaction id
  plaid_category jsonb,                 -- plaid's category array
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (account_id, external_id)
);

-- Rule table (auto-categorization and split rules)
create table rule (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  name text,
  match_vendor_ilike text,              -- e.g. '%UBER%'
  match_category_id uuid references category(id) on delete set null,
  category_id uuid references category(id) on delete set null,
  split_override_json jsonb,            -- { "mode":"even" | "weighted" | "custom", "weights": {userId:0.6,...} }
  mark_as_personal boolean default false,
  priority int default 100,
  is_active boolean default true,
  created_by uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Budget table (spending limits per category)
create table budget (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  category_id uuid references category(id) on delete set null,
  period_start date not null,
  period_end date not null,
  amount_cap numeric(12,2) not null,
  is_hard_limit boolean default false,  -- true = hard limit, false = soft warning
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Goal table (savings goals)
create table goal (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null,
  current_amount numeric(12,2) default 0,
  target_date date,
  envelope_category_id uuid references category(id) on delete set null,
  contributions_auto_bool boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Split ledger table (who owes whom)
create table split_ledger (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  transaction_id uuid references transaction(id) on delete cascade,
  payer_user_id uuid not null,
  payee_user_id uuid not null,
  amount numeric(12,2) not null,  -- amount payee owes payer (positive)
  rationale text,
  created_at timestamptz default now()
);

-- Settlement table (when users settle up)
create table settlement (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  from_user_id uuid not null,
  to_user_id uuid not null,
  amount numeric(12,2) not null,
  method text not null check (method in ('venmo', 'zelle', 'cashapp', 'cash', 'other')),
  reference text,
  note text,
  settled_at timestamptz default now()
);

-- Webhook event table (Plaid, Stripe webhooks)
create table webhook_event (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('plaid', 'stripe')),
  event_type text not null,
  payload_json jsonb not null,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz default now()
);

-- Audit log table (track important actions)
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  household_id uuid references household(id) on delete cascade,
  action text not null,
  subject_type text,
  subject_id uuid,
  meta_json jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Membership indexes
create index idx_membership_household on membership(household_id);
create index idx_membership_user on membership(user_id);

-- Account indexes
create index idx_account_household on account(household_id);
create index idx_account_owner on account(owner_user_id);

-- Transaction indexes
create index idx_transaction_account on transaction(account_id);
create index idx_transaction_posted_at on transaction(posted_at desc);
create index idx_transaction_external_id on transaction(external_id);
create index idx_transaction_category on transaction(category_id);

-- Rule indexes
create index idx_rule_household on rule(household_id);
create index idx_rule_priority on rule(priority desc) where is_active = true;

-- Budget indexes
create index idx_budget_household on budget(household_id);
create index idx_budget_period on budget(period_start, period_end);

-- Goal indexes
create index idx_goal_household on goal(household_id) where is_active = true;

-- Split ledger indexes
create index idx_split_ledger_household on split_ledger(household_id);
create index idx_split_ledger_transaction on split_ledger(transaction_id);
create index idx_split_ledger_payer on split_ledger(payer_user_id);
create index idx_split_ledger_payee on split_ledger(payee_user_id);

-- Settlement indexes
create index idx_settlement_household on settlement(household_id);
create index idx_settlement_from_user on settlement(from_user_id);
create index idx_settlement_to_user on settlement(to_user_id);

-- Webhook indexes
create index idx_webhook_source on webhook_event(source);
create index idx_webhook_processed on webhook_event(processed_at);

-- Audit log indexes
create index idx_audit_log_household on audit_log(household_id);
create index idx_audit_log_user on audit_log(user_id);
create index idx_audit_log_created_at on audit_log(created_at desc);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger household_updated_at before update on household
  for each row execute function update_updated_at_column();

create trigger membership_updated_at before update on membership
  for each row execute function update_updated_at_column();

create trigger account_updated_at before update on account
  for each row execute function update_updated_at_column();

create trigger transaction_updated_at before update on transaction
  for each row execute function update_updated_at_column();

create trigger rule_updated_at before update on rule
  for each row execute function update_updated_at_column();

create trigger budget_updated_at before update on budget
  for each row execute function update_updated_at_column();

create trigger goal_updated_at before update on goal
  for each row execute function update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table household is 'Households contain multiple users who share expenses';
comment on table membership is 'User membership in households with split weights';
comment on table account is 'Bank accounts connected via Plaid';
comment on table transaction is 'Financial transactions from bank accounts';
comment on table category is 'Expense categories for transactions';
comment on table rule is 'Auto-categorization and split rules';
comment on table budget is 'Budget limits per category';
comment on table goal is 'Savings goals for households';
comment on table split_ledger is 'Ledger of who owes whom';
comment on table settlement is 'Record of settlements between users';
comment on table webhook_event is 'Webhook events from external services';
comment on table audit_log is 'Audit trail of important actions';
