# Supabase Database Setup

This directory contains database migrations, Row Level Security (RLS) policies, and seed data for the Evenly app.

## Directory Structure

```
supabase/
├── migrations/
│   ├── 20250101000000_initial_schema.sql    # Tables, indexes, functions
│   └── 20250101000001_rls_policies.sql      # RLS policies
├── seed/
│   ├── seed.sql                              # Test data
│   └── test_rls.sql                          # RLS validation tests
└── README.md                                 # This file
```

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the database to be provisioned
4. Copy your project URL and API keys to `.env`

### 2. Run Migrations

You have two options to run migrations:

#### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Or apply migrations manually
psql -h db.your-project-ref.supabase.co -U postgres -d postgres -f migrations/20250101000000_initial_schema.sql
psql -h db.your-project-ref.supabase.co -U postgres -d postgres -f migrations/20250101000001_rls_policies.sql
```

#### Option B: Using Supabase Dashboard

1. Open your project in Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `migrations/20250101000000_initial_schema.sql`
4. Run the query
5. Repeat for `migrations/20250101000001_rls_policies.sql`

### 3. Create Test Users (for seed data)

Before running the seed script, create these test users in Supabase Auth:

1. Go to **Authentication** > **Users** in Supabase Dashboard
2. Click **Add user** → **Create new user**
3. Create two users:
   - **alice@example.com** (use UUID: `22222222-2222-2222-2222-222222222222`)
   - **bob@example.com** (use UUID: `33333333-3333-3333-3333-333333333333`)

**Note:** To use custom UUIDs, you'll need to insert directly into auth.users table via SQL:

```sql
-- Run in Supabase SQL Editor
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
values
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'alice@example.com', crypt('password123', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'bob@example.com', crypt('password123', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated');
```

### 4. Run Seed Script

```bash
psql -h db.your-project-ref.supabase.co -U postgres -d postgres -f seed/seed.sql
```

Or via Supabase Dashboard SQL Editor:
1. Copy contents of `seed/seed.sql`
2. Paste and run in SQL Editor

### 5. Validate RLS Policies

```bash
psql -h db.your-project-ref.supabase.co -U postgres -d postgres -f seed/test_rls.sql
```

Or via Supabase Dashboard SQL Editor:
1. Copy contents of `seed/test_rls.sql`
2. Paste and run in SQL Editor
3. Check the output for all tests passing

## Database Schema

### Tables

1. **household** - Households containing multiple users
2. **membership** - User membership in households with split weights
3. **account** - Bank accounts connected via Plaid
4. **transaction** - Financial transactions from bank accounts
5. **category** - Expense categories
6. **rule** - Auto-categorization and split rules
7. **budget** - Budget limits per category
8. **goal** - Savings goals
9. **split_ledger** - Ledger of who owes whom
10. **settlement** - Record of settlements between users
11. **webhook_event** - Webhook events from Plaid/Stripe
12. **audit_log** - Audit trail of important actions

### Row Level Security (RLS)

All tables have RLS enabled. Key policies:

- Users can only see data from households they are members of
- Users can only modify data in their own households
- Household admins have additional permissions
- Cross-household access is completely blocked

## Test Data

After running the seed script, you'll have:

- **2 users**: Alice (owner) and Bob (member)
- **1 household**: "Alice & Bob's Household"
- **2 memberships**: Alice (60% weight, $4k income) and Bob (40% weight, $2k income)
- **2 bank accounts**: Chase (Alice) and Wells Fargo (Bob)
- **10 transactions**: Mixed between Alice and Bob's accounts
- **4 split ledger entries**: Computed splits based on income weights
- **1 settlement**: Bob paid Alice $200 via Venmo
- **System categories**: Groceries, Dining, Transport, Utilities, etc.
- **Budget tracking**: Monthly budgets for groceries and dining
- **Goals**: Vacation fund and emergency fund

**Net Balance**: Bob owes Alice $361.08 after settlement

## Verification Queries

```sql
-- Check household setup
select * from household;
select * from membership;

-- Check transactions
select
  t.posted_at,
  t.merchant_norm,
  t.amount,
  c.name as category,
  a.owner_user_id
from transaction t
join account a on t.account_id = a.id
left join category c on t.category_id = c.id
order by t.posted_at desc;

-- Check split ledger
select
  sl.payer_user_id,
  sl.payee_user_id,
  sl.amount,
  sl.rationale
from split_ledger sl
order by sl.created_at;

-- Calculate current balance
select
  'Bob owes Alice: $' ||
  round(
    (select coalesce(sum(amount), 0) from split_ledger
     where payer_user_id = '22222222-2222-2222-2222-222222222222')
    -
    (select coalesce(sum(amount), 0) from split_ledger
     where payer_user_id = '33333333-3333-3333-3333-333333333333')
    -
    (select coalesce(sum(amount), 0) from settlement
     where from_user_id = '33333333-3333-3333-3333-333333333333')
  , 2) as balance;
```

## Troubleshooting

### Error: relation "auth.users" does not exist

You're likely running migrations on a non-Supabase Postgres. Supabase automatically creates the `auth` schema.

### Error: permission denied for schema auth

Use the service role key or run migrations as the postgres superuser.

### RLS tests failing

Make sure:
1. RLS is enabled on all tables (`alter table X enable row level security;`)
2. Policies are created correctly
3. Test users exist in `auth.users`

### Cannot insert test users

Use the SQL snippet in step 3 above to insert users directly with custom UUIDs.

## Next Steps

After Phase 1 is complete:

- **Phase 2**: Implement the split engine with tests
- **Phase 3**: Build server APIs to interact with this database
- **Phase 4**: Build mobile UI to display this data

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
