-- Recurring expenses. Run against a database with local_auth_stub.sql and the migrations applied.
-- Every block raises an exception (and psql stops) if an expectation fails.
-- current_date cannot be faked, so dates are picked relative to today, and "time passing" is
-- simulated by moving a rule's next_on back as the superuser.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{"display_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'mallory@example.com', '{}');

create function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false);
$$;
-- The migration removes PUBLIC's default EXECUTE on new functions, so grant this test helper explicitly.
grant execute on function pg_temp.act_as(text) to authenticated, anon;
-- Test-only: move a rule back in time. The app cannot start a rule more than a year ago, but these
-- tests need fixed historical dates (month ends, leap years, long catch-ups).
create function pg_temp.backdate(p_rid uuid, p_start date, p_end date default null) returns void
language sql security definer as $$
  update public.recurring_expenses
     set start_on = p_start, next_on = p_start, anchor_day = extract(day from p_start), end_on = p_end
   where id = p_rid;
$$;
grant execute on function pg_temp.backdate(uuid, date, date) to authenticated;

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;

-- Only the app functions are callable, and only by signed-in users.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.recurring_next_date(date,text,int,int)',
    'public._recurring_first_on_or_after(date,text,int,int,date)',
    'public._check_recurring(uuid,bigint,jsonb,text,int,date,date)',
    'public._check_recurring_dates(date,date,date)',
    'public._materialize_recurring(uuid,date)',
    'public.run_recurring_all()'
  ] loop
    if has_function_privilege('authenticated', fn, 'execute') or has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL: % is callable by app users', fn;
    end if;
  end loop;
  foreach fn in array array[
    'public.create_recurring(uuid,text,bigint,text,jsonb,text,int,date,date,text,text,date)',
    'public.update_recurring(uuid,text,bigint,text,jsonb,text,int,date,date,text,text,date)',
    'public.set_recurring_paused(uuid,boolean,date)',
    'public.delete_recurring(uuid)',
    'public.run_recurring(date)'
  ] loop
    if not has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'FAIL: % should be callable by signed-in users', fn;
    end if;
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL: % is callable by anonymous users', fn;
    end if;
  end loop;
end $$;

-- The date helper is month-end safe and remembers the anchor day.
do $$
declare
  got date;
  cases text[][] := array[
    -- from, frequency, interval, anchor, expected
    array['2025-01-31', 'monthly', '1', '31', '2025-02-28'],
    array['2025-02-28', 'monthly', '1', '31', '2025-03-31'],
    array['2025-03-31', 'monthly', '1', '31', '2025-04-30'],
    array['2024-01-31', 'monthly', '1', '31', '2024-02-29'],
    array['2026-12-15', 'monthly', '1', '15', '2027-01-15'],
    array['2026-11-30', 'monthly', '3', '30', '2027-02-28'],
    array['2026-01-01', 'weekly', '1', '1', '2026-01-08'],
    array['2026-12-28', 'weekly', '2', '28', '2027-01-11'],
    array['2024-02-29', 'yearly', '1', '29', '2025-02-28'],
    array['2027-02-28', 'yearly', '1', '29', '2028-02-29'],
    array['2026-03-10', 'yearly', '2', '10', '2028-03-10']
  ];
  c text[];
begin
  foreach c slice 1 in array cases loop
    got := public.recurring_next_date(c[1]::date, c[2], c[3]::int, c[4]::int);
    if got is distinct from c[5]::date then
      raise exception 'FAIL: recurring_next_date(%, %, %, %) = %, expected %', c[1], c[2], c[3], c[4], got, c[5];
    end if;
  end loop;
  -- Without an anchor day it uses the day of the date it starts from.
  if public.recurring_next_date('2026-01-31', 'monthly', 1, null) is distinct from '2026-02-28'::date then
    raise exception 'FAIL: recurring_next_date without an anchor day';
  end if;
  if public._recurring_first_on_or_after('2025-01-31', 'monthly', 1, 31, '2025-03-01') is distinct from '2025-03-31'::date
     or public._recurring_first_on_or_after('2025-01-31', 'monthly', 1, 31, '2025-01-31') is distinct from '2025-01-31'::date then
    raise exception 'FAIL: _recurring_first_on_or_after';
  end if;
end $$;

set role authenticated;

-- Alice creates a group with guests Carl and Dana, and a monthly rule starting last year on Jan 31.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare
  gid uuid; me uuid; carl uuid; dana uuid; rid uuid;
  y int := extract(year from current_date)::int - 1;
  dates date[];
  n int;
begin
  gid := public.create_group('Flat', 'EUR');
  select id into me from public.group_members where group_id = gid and user_id = auth.uid();
  insert into public.group_members (group_id, display_name) values (gid, 'Carl') returning id into carl;
  insert into public.group_members (group_id, display_name) values (gid, 'Dana') returning id into dana;
  insert into ctx values ('gid', gid), ('me', me), ('carl', carl), ('dana', dana),
    ('code', (select invite_code from public.groups where id = gid));

  rid := public.create_recurring(gid, ' Rent ', 100000, 'eur', jsonb_build_array(
      jsonb_build_object('member_id', me, 'paid', 100000, 'owed', 50000),
      jsonb_build_object('member_id', dana, 'paid', 0, 'owed', 50000)),
    'monthly', 1, current_date + 1, null, 'Rent', 'Paid to the landlord');
  perform pg_temp.backdate(rid, make_date(y, 1, 31), make_date(y, 3, 31));
  perform public.run_recurring();
  insert into ctx values ('monthly', rid);

  select array_agg(spent_on order by spent_on) into dates from public.expenses where recurring_id = rid;
  if dates is distinct from array[make_date(y, 1, 31), make_date(y, 3, 1) - 1, make_date(y, 3, 31)] then
    raise exception 'FAIL: monthly rule from Jan 31 added %', dates;
  end if;
  if exists (select 1 from public.expenses where recurring_id = rid and (occurrence_on is distinct from spent_on
             or description <> 'Rent' or currency <> 'EUR' or amount <> 100000 or category <> 'Rent'
             or notes is distinct from 'Paid to the landlord' or created_by is distinct from auth.uid())) then
    raise exception 'FAIL: added expenses do not match the rule';
  end if;
  if (select sum(s.owed) from public.expense_shares s join public.expenses e on e.id = s.expense_id
      where e.recurring_id = rid and s.member_id = dana) is distinct from 150000::numeric then
    raise exception 'FAIL: shares of added expenses are wrong';
  end if;
  -- It ended: next_on is past end_on, and it stays in the list.
  if (select next_on from public.recurring_expenses where id = rid) is distinct from make_date(y, 4, 30)
     or (select anchor_day from public.recurring_expenses where id = rid) is distinct from 31::smallint then
    raise exception 'FAIL: next_on/anchor_day after the end date';
  end if;

  -- The same in a leap year, whatever this year is.
  rid := public.create_recurring(gid, 'Rent 2024', 1000, 'EUR', jsonb_build_array(
      jsonb_build_object('member_id', me, 'paid', 1000, 'owed', 1000)),
    'monthly', 1, current_date + 1);
  perform pg_temp.backdate(rid, '2024-01-31', '2024-03-31');
  perform public.run_recurring();
  insert into ctx values ('leap', rid);
  select array_agg(spent_on order by spent_on) into dates from public.expenses where recurring_id = rid;
  if dates is distinct from array['2024-01-31', '2024-02-29', '2024-03-31']::date[] then
    raise exception 'FAIL: monthly rule from Jan 31 in a leap year added %', dates;
  end if;
  rid := (select v from ctx where k = 'monthly')::uuid;

  -- Running again adds nothing.
  n := public.run_recurring();
  if n <> 0 or (select count(*) from public.expenses where recurring_id = rid) <> 3 then
    raise exception 'FAIL: second run added expenses';
  end if;

  -- Rules can only be changed through the functions.
  begin
    update public.recurring_expenses set amount = 1 where id = rid;
    raise exception 'FAIL: rules were directly writable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.recurring_expenses (group_id, description, amount, currency, shares, frequency, start_on, next_on)
    values (gid, 'x', 1, 'EUR', '[]', 'weekly', current_date, current_date);
    raise exception 'FAIL: rules were directly insertable';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.recurring_expenses where id = rid;
    raise exception 'FAIL: rules were directly deletable';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Even if next_on is moved back (e.g. two runs racing), dates that already have their expense are skipped.
reset role;
update public.recurring_expenses set next_on = start_on where id = (select v from ctx where k = 'monthly')::uuid;
do $$
declare
  rid uuid;
  first_id uuid;
begin
  -- And the unique index refuses a second expense for the same rule and date (moving the first
  -- date onto the second one, which is Feb 28 or Feb 29).
  foreach rid in array array[(select v from ctx where k = 'monthly'), (select v from ctx where k = 'leap')]::uuid[] loop
    select id into first_id from public.expenses where recurring_id = rid order by occurrence_on limit 1;
    begin
      update public.expenses
         set occurrence_on = (select occurrence_on from public.expenses where recurring_id = rid
                              order by occurrence_on offset 1 limit 1)
       where id = first_id;
      raise exception 'FAIL: two expenses for the same rule and date';
    exception when unique_violation then null;
    end;
  end loop;
end $$;
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare rid uuid := (select v from ctx where k = 'monthly')::uuid; n int;
begin
  n := public.run_recurring();
  if n <> 0 or (select count(*) from public.expenses where recurring_id = rid) <> 3 then
    raise exception 'FAIL: rerun after moving next_on back added duplicates';
  end if;
  if (select next_on from public.recurring_expenses where id = rid) is distinct from
     (select end_on + 30 from public.recurring_expenses where id = rid) then
    raise exception 'FAIL: next_on did not move forward again';
  end if;
end $$;

-- Weekly catch-up is capped at 60 per run; the next run continues where it stopped.
do $$
declare
  gid uuid := (select v from ctx where k = 'gid');
  me uuid := (select v from ctx where k = 'me');
  rid uuid;
  n int;
begin
  rid := public.create_recurring(gid, 'Cleaner', 2000, 'EUR',
    jsonb_build_array(jsonb_build_object('member_id', me, 'paid', 2000, 'owed', 2000)),
    'weekly', p_start_on => current_date + 1);
  perform pg_temp.backdate(rid, current_date - 7 * 70);
  perform public.run_recurring();
  insert into ctx values ('weekly', rid);
  if (select count(*) from public.expenses where recurring_id = rid) <> 60
     or (select next_on from public.recurring_expenses where id = rid) is distinct from current_date - 7 * 10 then
    raise exception 'FAIL: catch-up was not capped at 60';
  end if;
  n := public.run_recurring();
  if n <> 11 or (select count(*) from public.expenses where recurring_id = rid) <> 71
     or (select max(spent_on) from public.expenses where recurring_id = rid) is distinct from current_date
     or (select next_on from public.recurring_expenses where id = rid) is distinct from current_date + 7 then
    raise exception 'FAIL: second run did not finish the catch-up';
  end if;
  n := public.run_recurring();
  if n <> 0 then
    raise exception 'FAIL: third run added expenses';
  end if;
  -- A deleted occurrence is not added again.
  perform public.delete_expense((select id from public.expenses where recurring_id = rid and spent_on = current_date));
end $$;
reset role;
update public.recurring_expenses set next_on = current_date where id = (select v from ctx where k = 'weekly')::uuid;
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare rid uuid := (select v from ctx where k = 'weekly')::uuid; n int;
begin
  n := public.run_recurring();
  if n <> 0 or (select count(*) from public.expenses where recurring_id = rid) <> 71 then
    raise exception 'FAIL: a deleted occurrence was added again';
  end if;
end $$;

-- Pause and resume: dates missed while paused are skipped, not added later.
do $$
declare
  gid uuid := (select v from ctx where k = 'gid');
  me uuid := (select v from ctx where k = 'me');
  rid uuid;
begin
  rid := public.create_recurring(gid, 'Gym', 3000, 'EUR',
    jsonb_build_array(jsonb_build_object('member_id', me, 'paid', 3000, 'owed', 3000)), 'weekly');
  insert into ctx values ('gym', rid);
  if (select count(*) from public.expenses where recurring_id = rid and spent_on = current_date) <> 1 then
    raise exception 'FAIL: a rule starting today did not add today''s expense';
  end if;
  perform public.set_recurring_paused(rid, true);
  if not (select paused from public.recurring_expenses where id = rid) then
    raise exception 'FAIL: not paused';
  end if;
end $$;
reset role;
-- Three weeks "pass" while it is paused.
update public.recurring_expenses set next_on = current_date - 20 where id = (select v from ctx where k = 'gym')::uuid;
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare rid uuid := (select v from ctx where k = 'gym')::uuid; n int;
begin
  n := public.run_recurring();
  if n <> 0 or (select count(*) from public.expenses where recurring_id = rid) <> 1 then
    raise exception 'FAIL: a paused rule added expenses';
  end if;
  perform public.set_recurring_paused(rid, false);
  if (select paused from public.recurring_expenses where id = rid)
     or (select next_on from public.recurring_expenses where id = rid) is distinct from current_date + 1
     or (select count(*) from public.expenses where recurring_id = rid) <> 1 then
    raise exception 'FAIL: resuming did not skip the missed dates';
  end if;
end $$;

-- Changing a rule only affects the dates still to come.
do $$
declare
  me uuid := (select v from ctx where k = 'me');
  dana uuid := (select v from ctx where k = 'dana');
  rid uuid := (select v from ctx where k = 'gym')::uuid;
  new_shares jsonb := jsonb_build_array(
    jsonb_build_object('member_id', me, 'paid', 4000, 'owed', 2000),
    jsonb_build_object('member_id', dana, 'paid', 0, 'owed', 2000));
begin
  perform public.update_recurring(rid, 'Gym (both)', 4000, 'EUR', new_shares, 'monthly', 1, current_date + 3);
  if (select amount from public.expenses where recurring_id = rid) is distinct from 3000::bigint
     or (select count(*) from public.expenses where recurring_id = rid) <> 1 then
    raise exception 'FAIL: updating changed an expense that was already added';
  end if;
  if exists (select 1 from public.recurring_expenses where id = rid and (
       amount <> 4000 or description <> 'Gym (both)' or frequency <> 'monthly' or next_on <> current_date + 3
       or anchor_day <> extract(day from current_date + 3) or jsonb_array_length(shares) <> 2)) then
    raise exception 'FAIL: update not saved';
  end if;
  -- A next date in the past does not add expenses for the past: it moves to the first date from today.
  perform public.update_recurring(rid, 'Gym (both)', 4000, 'EUR', new_shares, 'monthly', 1, current_date - 40);
  if (select next_on from public.recurring_expenses where id = rid) < current_date
     or (select count(*) from public.expenses where recurring_id = rid) <> 1 then
    raise exception 'FAIL: update with a past date added past expenses';
  end if;
  -- Invalid changes are refused.
  begin
    perform public.update_recurring(rid, 'Gym', 4000, 'EUR', new_shares, 'daily');
    raise exception 'FAIL: unknown frequency accepted';
  exception when sqlstate '22023' then null;
  end;
end $$;

-- Invalid rules are refused, like invalid expenses.
do $$
declare
  gid uuid := (select v from ctx where k = 'gid');
  me uuid := (select v from ctx where k = 'me');
  dana uuid := (select v from ctx where k = 'dana');
  bad jsonb;
begin
  foreach bad in array array[
    jsonb_build_array(jsonb_build_object('member_id', me, 'paid', 1000, 'owed', 500)),            -- does not add up
    jsonb_build_array(jsonb_build_object('member_id', me, 'paid', 2000, 'owed', 0),
                      jsonb_build_object('member_id', dana, 'paid', 0, 'owed', 1000),
                      jsonb_build_object('member_id', dana, 'paid', -1000, 'owed', 0)),           -- negative
    jsonb_build_array(jsonb_build_object('member_id', gen_random_uuid(), 'paid', 1000, 'owed', 1000)), -- not a member
    '[]'::jsonb,                                                                                -- nobody
    '{}'::jsonb                                                                                 -- not an array
  ] loop
    begin
      perform public.create_recurring(gid, 'Bad', 1000, 'EUR', bad, 'monthly');
      raise exception 'FAIL: invalid shares accepted: %', bad;
    exception when sqlstate '22023' then null;
    end;
  end loop;
  bad := jsonb_build_array(jsonb_build_object('member_id', me, 'paid', 1000, 'owed', 1000));
  begin
    perform public.create_recurring(gid, 'Bad', 1000, 'EUR', bad, 'monthly', 13);
    raise exception 'FAIL: interval 13 accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_recurring(gid, 'Bad', 1000, 'EUR', bad, 'monthly', 1, current_date, current_date - 1);
    raise exception 'FAIL: end date before the start accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_recurring(gid, 'Bad', 200000000000000, 'EUR', jsonb_build_array(
      jsonb_build_object('member_id', me, 'paid', 200000000000000, 'owed', 200000000000000)), 'monthly');
    raise exception 'FAIL: huge amount accepted';
  exception when sqlstate '22023' then null;
  end;
  if exists (select 1 from public.recurring_expenses where description = 'Bad') then
    raise exception 'FAIL: an invalid rule was saved';
  end if;
end $$;

-- Mallory (not in the group) cannot see, create, change, pause, delete or run Alice's rules.
reset role;
update public.recurring_expenses set next_on = current_date - 7 where id = (select v from ctx where k = 'gym')::uuid;
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$
declare
  gid uuid := (select v from ctx where k = 'gid');
  rid uuid := (select v from ctx where k = 'gym')::uuid;
  shares jsonb := jsonb_build_array(jsonb_build_object('member_id', (select v from ctx where k = 'me'), 'paid', 100, 'owed', 100));
  n int;
begin
  if exists (select 1 from public.recurring_expenses) then
    raise exception 'FAIL: outsider can see rules';
  end if;
  begin
    perform public.create_recurring(gid, 'Hack', 100, 'EUR', shares, 'weekly');
    raise exception 'FAIL: outsider created a rule';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.update_recurring(rid, 'Hack', 100, 'EUR', shares, 'weekly');
    raise exception 'FAIL: outsider changed a rule';
  exception when no_data_found then null;
  end;
  begin
    perform public.set_recurring_paused(rid, true);
    raise exception 'FAIL: outsider paused a rule';
  exception when no_data_found then null;
  end;
  begin
    perform public.delete_recurring(rid);
    raise exception 'FAIL: outsider deleted a rule';
  exception when no_data_found then null;
  end;
  n := public.run_recurring();
  if n <> 0 then
    raise exception 'FAIL: outsider ran someone else''s rules';
  end if;
end $$;
reset role;
do $$
begin
  if (select next_on from public.recurring_expenses where id = (select v from ctx where k = 'gym')::uuid) is distinct from current_date - 7
     or (select paused from public.recurring_expenses where id = (select v from ctx where k = 'gym')::uuid) then
    raise exception 'FAIL: outsider changed a rule';
  end if;
end $$;
set role anon;
do $$
begin
  begin
    perform public.run_recurring();
    raise exception 'FAIL: anon could call run_recurring';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.recurring_expenses;
    raise exception 'FAIL: anon can read rules';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role authenticated;

-- A rule with someone who left the group is paused instead of making the run fail.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare
  gid uuid := (select v from ctx where k = 'gid');
  me uuid := (select v from ctx where k = 'me');
  carl uuid := (select v from ctx where k = 'carl');
  rid uuid;
begin
  rid := public.create_recurring(gid, 'Internet', 1000, 'EUR', jsonb_build_array(
    jsonb_build_object('member_id', me, 'paid', 1000, 'owed', 500),
    jsonb_build_object('member_id', carl, 'paid', 0, 'owed', 500)), 'monthly');
  insert into ctx values ('internet', rid);
  -- Carl settles up and is removed (kept as a former member because he has history).
  perform public.save_expense(gid, 'Payment', 500, 'EUR', jsonb_build_array(
    jsonb_build_object('member_id', carl, 'paid', 500, 'owed', 0),
    jsonb_build_object('member_id', me, 'paid', 0, 'owed', 500)), p_kind => 'payment');
  perform public.remove_member(carl);
end $$;
reset role;
update public.recurring_expenses set next_on = current_date - 1 where id = (select v from ctx where k = 'internet')::uuid;
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare rid uuid := (select v from ctx where k = 'internet')::uuid;
begin
  perform public.run_recurring(); -- must not fail
  if not (select paused from public.recurring_expenses where id = rid)
     or (select next_on from public.recurring_expenses where id = rid) is distinct from current_date - 1
     or (select count(*) from public.expenses where recurring_id = rid) <> 1 then
    raise exception 'FAIL: rule with a former member was not paused';
  end if;
  -- The gym rule in the same run was still added.
  if not exists (select 1 from public.expenses where recurring_id = (select v from ctx where k = 'gym')::uuid
                 and spent_on = current_date - 7) then
    raise exception 'FAIL: one broken rule stopped the others';
  end if;
  begin
    perform public.set_recurring_paused(rid, false);
    raise exception 'FAIL: resumed a rule with a former member';
  exception when sqlstate '22023' then null;
  end;
end $$;

-- Bob joins and sets up a rule, then leaves: the rule pauses, and Alice can resume it and take it over.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$
declare
  gid uuid;
  rid uuid;
begin
  gid := public.join_group((select v from ctx where k = 'code'));
  if (select count(*) from public.recurring_expenses) <> 5 then
    raise exception 'FAIL: a member cannot see the group''s rules';
  end if;
  rid := public.create_recurring(gid, 'Streaming', 1500, 'EUR', jsonb_build_array(
    jsonb_build_object('member_id', (select v from ctx where k = 'me'), 'paid', 1500, 'owed', 1500)), 'monthly');
  insert into ctx values ('streaming', rid);
  perform public.leave_group(gid);
end $$;
reset role;
update public.recurring_expenses set next_on = current_date - 3 where id = (select v from ctx where k = 'streaming')::uuid;
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare rid uuid := (select v from ctx where k = 'streaming')::uuid;
begin
  perform public.run_recurring();
  if not (select paused from public.recurring_expenses where id = rid) then
    raise exception 'FAIL: rule of someone who left was not paused';
  end if;
  perform public.set_recurring_paused(rid, false);
  if (select created_by from public.recurring_expenses where id = rid) is distinct from auth.uid()
     or (select paused from public.recurring_expenses where id = rid) then
    raise exception 'FAIL: resuming did not hand the rule over';
  end if;
end $$;

-- Deleting a rule keeps the expenses it added.
do $$
declare rid uuid := (select v from ctx where k = 'weekly')::uuid; n int;
begin
  perform public.delete_recurring(rid);
  if exists (select 1 from public.recurring_expenses where id = rid) then
    raise exception 'FAIL: rule not deleted';
  end if;
  if (select count(*) from public.expenses where description = 'Cleaner' and recurring_id is null) <> 71 then
    raise exception 'FAIL: deleting a rule removed or kept a link to its expenses';
  end if;
  begin
    perform public.delete_recurring(rid);
    raise exception 'FAIL: deleted a rule twice';
  exception when no_data_found then null;
  end;
end $$;

-- The scheduler function runs every group's rules; a deleted group's rules are left alone (so restoring the group from the dashboard brings them back).
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
begin
  begin
    perform public.run_recurring_all();
    raise exception 'FAIL: app users can call run_recurring_all';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
update public.recurring_expenses set next_on = current_date - 2 where id = (select v from ctx where k = 'gym')::uuid;
do $$
declare rid uuid := (select v from ctx where k = 'gym')::uuid; n int;
begin
  n := public.run_recurring_all();
  if n <> 1
     or not exists (select 1 from public.expenses where recurring_id = rid and spent_on = current_date - 2) then
    raise exception 'FAIL: run_recurring_all did not add the due expense';
  end if;
  update public.groups set deleted_at = now() where id = (select v from ctx where k = 'gid')::uuid;
  update public.recurring_expenses set next_on = current_date - 1 where id = rid;
  n := public.run_recurring_all();
  if n <> 0 or (select paused from public.recurring_expenses where id = rid) then
    raise exception 'FAIL: the scheduler added to or paused a deleted group''s rule';
  end if;
end $$;

-- "Today" is the app's date (passed as p_today), not the database's UTC date, but at most one day off.
-- (Alice's other group is deleted by now, so run_recurring only sees this new group.)
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare
  me uuid;
  gid uuid;
  shares jsonb;
  rid uuid;
  n int;
begin
  gid := public.create_group('Time zones', 'EUR');
  select id into me from public.group_members where group_id = gid and user_id = auth.uid();
  shares := jsonb_build_array(jsonb_build_object('member_id', me, 'paid', 500, 'owed', 500));
  -- Ahead of UTC it is already tomorrow: a rule starting on the app's today adds its first expense now.
  rid := public.create_recurring(gid, 'Ahead', 500, 'EUR', shares, 'weekly',
    p_start_on => current_date + 1, p_today => current_date + 1);
  if (select count(*) from public.expenses where recurring_id = rid and spent_on = current_date + 1) <> 1
     or (select next_on from public.recurring_expenses where id = rid) is distinct from current_date + 8 then
    raise exception 'FAIL: a rule starting on the app''s today did not add its first expense';
  end if;
  -- Without p_today the database's date is used; run_recurring with the app's date then adds it.
  rid := public.create_recurring(gid, 'Default', 500, 'EUR', shares, 'weekly', p_start_on => current_date + 1);
  if exists (select 1 from public.expenses where recurring_id = rid) then
    raise exception 'FAIL: a rule starting tomorrow added an expense without p_today';
  end if;
  n := public.run_recurring(current_date + 1);
  if n <> 1 or (select count(*) from public.expenses where recurring_id = rid and spent_on = current_date + 1) <> 1 then
    raise exception 'FAIL: run_recurring did not use the app''s date';
  end if;
  -- Behind UTC it is still yesterday: a rule starting on the database's today waits.
  rid := public.create_recurring(gid, 'Behind', 500, 'EUR', shares, 'weekly',
    p_start_on => current_date, p_today => current_date - 1);
  if exists (select 1 from public.expenses where recurring_id = rid)
     or public.run_recurring(current_date - 1) <> 0 then
    raise exception 'FAIL: a rule starting after the app''s today added an expense';
  end if;
  if public.run_recurring() <> 1 then
    raise exception 'FAIL: run_recurring without p_today did not use the database''s date';
  end if;
  -- A date more than one day off counts as one day off.
  rid := public.create_recurring(gid, 'Far', 500, 'EUR', shares, 'weekly',
    p_start_on => current_date + 2, p_today => current_date + 30);
  if exists (select 1 from public.expenses where recurring_id = rid)
     or public.run_recurring(current_date + 30) <> 0 then
    raise exception 'FAIL: p_today more than one day ahead was accepted';
  end if;
  rid := public.create_recurring(gid, 'Past', 500, 'EUR', shares, 'weekly',
    p_start_on => current_date - 1, p_today => current_date - 30);
  if (select count(*) from public.expenses where recurring_id = rid) <> 1 then
    raise exception 'FAIL: p_today more than one day behind was accepted';
  end if;
  perform public.delete_group(gid);
end $$;

-- Rules in an archived group wait (they are not paused) and catch up after unarchiving.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare gid uuid; me uuid; rid uuid;
begin
  gid := public.create_group('Archived flat', 'EUR');
  select id into me from public.group_members where group_id = gid and user_id = auth.uid();
  perform public.archive_group(gid);
  -- The rule cannot be created while archived (it would write an expense right away)...
  begin
    perform public.create_recurring(gid, 'Gym', 3000, 'EUR',
      jsonb_build_array(jsonb_build_object('member_id', me, 'paid', 3000, 'owed', 3000)), 'weekly',
      p_start_on => current_date - 14);
    raise exception 'FAIL: created a rule in an archived group';
  exception when insufficient_privilege then null;
  end;
  -- ...so create it first, then archive.
  perform public.unarchive_group(gid);
  rid := public.create_recurring(gid, 'Gym', 3000, 'EUR',
    jsonb_build_array(jsonb_build_object('member_id', me, 'paid', 3000, 'owed', 3000)), 'weekly',
    p_start_on => current_date);
  perform public.archive_group(gid);
  -- Changing, pausing or deleting it is refused while archived (read-only).
  begin
    perform public.set_recurring_paused(rid, true);
    raise exception 'FAIL: paused a rule in an archived group';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_recurring(rid);
    raise exception 'FAIL: deleted a rule in an archived group';
  exception when insufficient_privilege then null;
  end;
  if public.run_recurring() <> 0 then
    raise exception 'FAIL: recurring added expenses to an archived group';
  end if;
  if (select paused from public.recurring_expenses where id = rid) then
    raise exception 'FAIL: archiving paused the recurring expense';
  end if;
  -- Unarchiving skips the dates missed while archived (like resuming), instead of adding them all.
  reset role;
  update public.recurring_expenses set next_on = current_date - 28 where id = rid;
  set role authenticated;
  perform public.unarchive_group(gid);
  if (select next_on from public.recurring_expenses where id = rid) < current_date - 1 then
    raise exception 'FAIL: unarchiving left missed dates to back-fill (next_on %)', (select next_on from public.recurring_expenses where id = rid);
  end if;
  if public.run_recurring() > 1 then
    raise exception 'FAIL: unarchiving back-filled the missed dates';
  end if;
  perform public.delete_group(gid);
end $$;

-- run_recurring_all (the scheduler) also leaves archived groups alone.
reset role;
do $$
declare gid uuid; rid uuid; before int;
begin
  insert into public.groups (name, created_by) values ('Cron flat', '00000000-0000-0000-0000-00000000000a') returning id into gid;
  insert into public.group_members (group_id, user_id, display_name)
    values (gid, '00000000-0000-0000-0000-00000000000a', 'A');
  insert into public.recurring_expenses (group_id, description, amount, currency, shares, frequency, anchor_day, start_on, next_on, created_by)
  select gid, 'Cron gym', 1000, 'EUR',
         jsonb_build_array(jsonb_build_object('member_id', m.id, 'paid', 1000, 'owed', 1000)),
         'weekly', null, current_date - 7, current_date - 7, '00000000-0000-0000-0000-00000000000a'
  from public.group_members m where m.group_id = gid
  returning id into rid;
  update public.groups set archived_at = now() where id = gid;
  before := (select count(*) from public.expenses where group_id = gid);
  perform public.run_recurring_all();
  if (select count(*) from public.expenses where group_id = gid) <> before
     or (select paused from public.recurring_expenses where id = rid) then
    raise exception 'FAIL: scheduler touched an archived group';
  end if;
  update public.groups set archived_at = null where id = gid;
  perform public.run_recurring_all();
  if (select count(*) from public.expenses where group_id = gid) <> before + 2 then
    raise exception 'FAIL: scheduler did not catch up after unarchiving (got %)', (select count(*) from public.expenses where group_id = gid) - before;
  end if;
  delete from public.groups where id = gid;
end $$;

-- Start dates must be real and at most a year back, so a typo in the year cannot add hundreds of expenses.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare gid uuid; me uuid; shares jsonb;
begin
  gid := public.create_group('Dates', 'EUR');
  select id into me from public.group_members where group_id = gid and user_id = auth.uid();
  shares := jsonb_build_array(jsonb_build_object('member_id', me, 'paid', 100, 'owed', 100));
  begin
    perform public.create_recurring(gid, 'Typo', 100, 'EUR', shares, 'weekly', p_start_on => current_date - 3650);
    raise exception 'FAIL: start date ten years ago accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_recurring(gid, 'Inf', 100, 'EUR', shares, 'weekly', p_start_on => '-infinity'::date);
    raise exception 'FAIL: infinite start date accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_recurring(gid, 'Inf end', 100, 'EUR', shares, 'weekly', p_start_on => current_date, p_end_on => 'infinity'::date);
    raise exception 'FAIL: infinite end date accepted';
  exception when sqlstate '22023' then null;
  end;
  perform public.delete_group(gid);
end $$;

-- run_recurring stops after about 200 expenses per call (so it never hits the time limit); the next call continues.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare gid uuid; me uuid; i int; first int; second int; third int;
begin
  gid := public.create_group('Backlog', 'EUR');
  select id into me from public.group_members where group_id = gid and user_id = auth.uid();
  for i in 1..5 loop
    perform public.create_recurring(gid, 'Weekly ' || i, 100, 'EUR',
      jsonb_build_array(jsonb_build_object('member_id', me, 'paid', 100, 'owed', 100)), 'weekly',
      p_start_on => current_date + 1);
  end loop;
  insert into ctx values ('backlog_gid', gid);
end $$;
reset role;
update public.recurring_expenses set next_on = current_date - 7 * 52
 where group_id = (select v from ctx where k = 'backlog_gid')::uuid; -- 53 dates due for each of the 5
set role authenticated;
do $$
declare first int; second int;
begin
  first := public.run_recurring(current_date);
  second := public.run_recurring(current_date);
  if first < 200 or first >= 265 or first + second <> 265 or public.run_recurring(current_date) <> 0 then
    raise exception 'FAIL: run_recurring budget: % then %', first, second;
  end if;
  perform public.delete_group((select v from ctx where k = 'backlog_gid')::uuid);
end $$;

-- Resuming uses the app's date: in the evening in the Americas the database (UTC) is already on
-- tomorrow, and the expense due "today" (local) must still be added.
do $$
declare gid uuid; me uuid; rid uuid; local_today date := current_date - 1;
begin
  gid := public.create_group('Evening', 'CAD');
  select id into me from public.group_members where group_id = gid and user_id = auth.uid();
  rid := public.create_recurring(gid, 'Cleaner', 5000, 'CAD',
    jsonb_build_array(jsonb_build_object('member_id', me, 'paid', 5000, 'owed', 5000)), 'weekly',
    p_start_on => current_date + 1);
  perform public.set_recurring_paused(rid, true, local_today);
  insert into ctx values ('evening_rid', rid), ('evening_gid', gid);
end $$;
reset role;
update public.recurring_expenses set next_on = current_date - 1 where id = (select v from ctx where k = 'evening_rid')::uuid;
set role authenticated;
do $$
declare rid uuid := (select v from ctx where k = 'evening_rid')::uuid;
begin
  perform public.set_recurring_paused(rid, false, current_date - 1);
  if not exists (select 1 from public.expenses where recurring_id = rid and occurrence_on = current_date - 1) then
    raise exception 'FAIL: resuming in the evening skipped today''s expense';
  end if;
  perform public.delete_group((select v from ctx where k = 'evening_gid')::uuid);
end $$;

\echo 'RECURRING TESTS PASSED'
