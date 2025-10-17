/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

-- Extend category table to support household-specific categories

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'category'
      and column_name = 'household_id'
  ) then
    alter table category
      add column household_id uuid references household(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'category'
      and column_name = 'color'
  ) then
    alter table category
      add column color text;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'category'
      and column_name = 'is_personal_default'
  ) then
    alter table category
      add column is_personal_default boolean default false;
  end if;
end
$$;

-- Index for faster household category lookups
create index if not exists idx_category_household on category(household_id);
