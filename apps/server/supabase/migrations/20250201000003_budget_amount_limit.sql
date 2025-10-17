/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

-- Align budget column naming with API expectations

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budget'
      and column_name = 'amount_cap'
  ) then
    alter table budget rename column amount_cap to amount_limit;
  end if;
end
$$;

comment on column budget.amount_limit is 'Budget limit amount';
