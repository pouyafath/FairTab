-- Recurring expenses (rent, subscriptions).
-- A rule stores everything an expense needs plus a schedule, and the database adds the expense on
-- each due date. Adding is idempotent (one expense per rule and date, guaranteed by a unique index)
-- and capped (at most 60 dates per rule per run; the rest are added on the next run).

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense')),
  description text not null check (char_length(description) between 1 and 200),
  category text check (char_length(category) <= 50),
  notes text check (char_length(notes) <= 1000),
  amount bigint not null check (amount > 0 and amount <= 100000000000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- [{member_id, paid, owed}], exactly what save_expense takes (merged per person).
  shares jsonb not null check (jsonb_typeof(shares) = 'array'),
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  interval_count int not null default 1 check (interval_count between 1 and 12),
  -- Day of the month a monthly or yearly schedule keeps coming back to: Jan 31 -> Feb 28 -> Mar 31.
  anchor_day smallint check (anchor_day between 1 and 31),
  start_on date not null,
  -- The next date whose expense has not been added yet.
  next_on date not null,
  end_on date check (end_on >= start_on),
  paused boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recurring_expenses_group_idx on public.recurring_expenses (group_id);
create index recurring_expenses_due_idx on public.recurring_expenses (next_on) where not paused;

alter table public.expenses
  add column recurring_id uuid references public.recurring_expenses (id) on delete set null,
  add column occurrence_on date;
-- One expense per rule and date, even when two runs happen at the same time. A deleted expense
-- keeps its date, so an occurrence someone deleted is not added again.
create unique index expenses_recurring_occurrence_idx on public.expenses (recurring_id, occurrence_on)
  where recurring_id is not null;

------------------------------------------------------------------------------
-- Row level security: members read the rules of their groups; writes go through the functions.
------------------------------------------------------------------------------

alter table public.recurring_expenses enable row level security;

create policy "recurring: members read" on public.recurring_expenses
  for select to authenticated using (public.is_group_member(group_id));

revoke all on public.recurring_expenses from anon, authenticated;
grant select on public.recurring_expenses to authenticated;

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------

-- The date after p_from in a schedule. Months are month-end safe thanks to the anchor day:
-- with anchor 31, Jan 31 -> Feb 28 (29 in a leap year) -> Mar 31.
create function public.recurring_next_date(p_from date, p_frequency text, p_interval int, p_anchor_day int)
returns date
language sql immutable set search_path = '' as $$
  select case
    when p_frequency = 'weekly' then p_from + 7 * p_interval
    when p_frequency in ('monthly', 'yearly') then
      m.first_day + least(coalesce(p_anchor_day, extract(day from p_from)::int),
                          extract(day from m.first_day + interval '1 month' - interval '1 day')::int) - 1
  end
  from (
    select (date_trunc('month', p_from::timestamp)
            + make_interval(months => p_interval * case when p_frequency = 'yearly' then 12 else 1 end))::date as first_day
  ) m
$$;

-- The first date of the schedule on or after p_min, counting from p_from (used to skip missed dates).
create function public._recurring_first_on_or_after(
  p_from date, p_frequency text, p_interval int, p_anchor_day int, p_min date
) returns date
language plpgsql immutable set search_path = '' as $$
declare
  d date := p_from;
begin
  while d < p_min loop
    d := public.recurring_next_date(d, p_frequency, p_interval, p_anchor_day);
  end loop;
  return d;
end;
$$;

-- Internal: checks a rule the same way _write_expense checks an expense (no negative amounts,
-- paid = owed = amount, everyone is a current member of the group) plus its schedule.
-- Returns the shares merged per person.
create function public._check_recurring(
  p_group_id uuid, p_amount bigint, p_shares jsonb, p_frequency text, p_interval int, p_start_on date, p_end_on date
) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  merged_shares jsonb;
  total_paid bigint;
  total_owed bigint;
  foreign_members int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  if p_amount > 100000000000000 then
    raise exception 'Amount is too large' using errcode = '22023';
  end if;
  if p_frequency is null or p_frequency not in ('weekly', 'monthly', 'yearly') then
    raise exception 'It can repeat every week, month or year' using errcode = '22023';
  end if;
  if p_interval is null or p_interval not between 1 and 12 then
    raise exception 'It can repeat every 1 to 12 weeks, months or years' using errcode = '22023';
  end if;
  if p_end_on < p_start_on then
    raise exception 'The end date is before the first date' using errcode = '22023';
  end if;
  if jsonb_typeof(p_shares) is distinct from 'array' then
    raise exception 'shares must be an array' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_shares) s
    where s ->> 'member_id' is null
       or coalesce((s ->> 'paid')::bigint, 0) < 0
       or coalesce((s ->> 'owed')::bigint, 0) < 0
  ) then
    raise exception 'Amounts cannot be negative' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_shares) s
    join public.group_members m on m.id = (s ->> 'member_id')::uuid
    where m.left_at is not null
  ) then
    raise exception 'Someone in this expense has left the group' using errcode = '22023';
  end if;

  with merged as (
    select (s ->> 'member_id')::uuid as member_id,
           sum(coalesce((s ->> 'paid')::bigint, 0)) as paid,
           sum(coalesce((s ->> 'owed')::bigint, 0)) as owed
    from jsonb_array_elements(p_shares) s
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('member_id', merged.member_id, 'paid', merged.paid, 'owed', merged.owed)
                            order by merged.member_id) filter (where merged.paid > 0 or merged.owed > 0), '[]'::jsonb),
         coalesce(sum(merged.paid), 0), coalesce(sum(merged.owed), 0),
         count(*) filter (where m.id is null)
    into merged_shares, total_paid, total_owed, foreign_members
  from merged
  left join public.group_members m on m.id = merged.member_id and m.group_id = p_group_id;

  if jsonb_array_length(merged_shares) = 0 then
    raise exception 'An expense needs at least one person' using errcode = '22023';
  end if;
  if foreign_members > 0 then
    raise exception 'Every person must be a member of the group' using errcode = '22023';
  end if;
  if total_paid <> p_amount or total_owed <> p_amount then
    raise exception 'Paid (%) and owed (%) must both equal the amount (%)', total_paid, total_owed, p_amount
      using errcode = '22023';
  end if;
  return merged_shares;
end;
$$;

-- Internal: adds an expense for every due date of one rule (up to today and up to end_on), at most
-- 60 per call, and moves next_on forward. A date that already has its expense is skipped, so running
-- this twice adds nothing. If the expense can no longer be written (the person who set it up or
-- someone in it left the group, or the group was deleted), the rule is paused instead of failing.
create function public._materialize_recurring(p_recurring_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r public.recurring_expenses;
  d date;
  eid uuid;
  steps int := 0;
  created int := 0;
begin
  -- Two runs at the same time take turns: skip a rule another run is adding right now.
  select * into r from public.recurring_expenses where id = p_recurring_id for update skip locked;
  if not found or r.paused then
    return 0;
  end if;

  d := r.next_on;
  while d <= current_date and (r.end_on is null or d <= r.end_on) and steps < 60 loop
    steps := steps + 1;
    if not exists (select 1 from public.expenses where recurring_id = r.id and occurrence_on = d) then
      begin
        eid := public._write_expense(null, r.group_id, 'expense', r.description, r.category,
                                     r.amount, r.currency, d, r.shares, r.created_by, r.notes);
        update public.expenses set recurring_id = r.id, occurrence_on = d where id = eid;
        created := created + 1;
      exception
        when unique_violation then
          null; -- another run added this date in the meantime
        when insufficient_privilege or data_exception or integrity_constraint_violation then
          update public.recurring_expenses set paused = true, next_on = d where id = r.id;
          return created;
      end;
    end if;
    d := public.recurring_next_date(d, r.frequency, r.interval_count, r.anchor_day);
  end loop;

  if d is distinct from r.next_on then
    update public.recurring_expenses set next_on = d where id = r.id;
  end if;
  return created;
end;
$$;

------------------------------------------------------------------------------
-- Functions called by the app
------------------------------------------------------------------------------

-- Creates a recurring expense and adds the expenses already due (the first one, when it starts today).
create function public.create_recurring(
  p_group_id uuid, p_description text, p_amount bigint, p_currency text, p_shares jsonb,
  p_frequency text, p_interval int default 1, p_start_on date default null, p_end_on date default null,
  p_category text default null, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  start_date date := coalesce(p_start_on, current_date);
  checked_shares jsonb;
  rid uuid;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group' using errcode = '42501';
  end if;
  checked_shares := public._check_recurring(p_group_id, p_amount, p_shares, p_frequency, p_interval, start_date, p_end_on);

  insert into public.recurring_expenses (group_id, description, category, notes, amount, currency, shares,
                                         frequency, interval_count, anchor_day, start_on, next_on, end_on, created_by)
  values (p_group_id, trim(p_description), nullif(trim(p_category), ''), nullif(trim(p_notes), ''), p_amount,
          upper(p_currency), checked_shares, p_frequency, p_interval, extract(day from start_date), start_date,
          start_date, p_end_on, uid)
  returning id into rid;

  perform public._materialize_recurring(rid);
  return rid;
end;
$$;

-- Changes a recurring expense. Expenses it already added stay as they are: dates that are already
-- due are added with the old details first, and the change applies to the dates still to come.
-- p_start_on, when given, is the new next date (and anchor day); dates before today are skipped.
create function public.update_recurring(
  p_recurring_id uuid, p_description text, p_amount bigint, p_currency text, p_shares jsonb,
  p_frequency text, p_interval int default 1, p_start_on date default null, p_end_on date default null,
  p_category text default null, p_notes text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  r public.recurring_expenses;
  checked_shares jsonb;
  anchor int;
  next_date date;
begin
  select * into r from public.recurring_expenses where id = p_recurring_id for update;
  if not found or not public.is_group_member(r.group_id) then
    raise exception 'Recurring expense not found' using errcode = 'P0002';
  end if;
  perform public._materialize_recurring(r.id);
  select * into r from public.recurring_expenses where id = p_recurring_id;

  checked_shares := public._check_recurring(r.group_id, p_amount, p_shares, p_frequency, p_interval,
                                            coalesce(p_start_on, r.start_on), p_end_on);
  if p_start_on is not null then
    anchor := extract(day from p_start_on);
    next_date := p_start_on;
  else
    anchor := case when p_frequency = r.frequency then r.anchor_day else extract(day from r.next_on) end;
    next_date := r.next_on;
  end if;
  next_date := public._recurring_first_on_or_after(next_date, p_frequency, p_interval, anchor, current_date);

  update public.recurring_expenses
     set description = trim(p_description), category = nullif(trim(p_category), ''),
         notes = nullif(trim(p_notes), ''), amount = p_amount, currency = upper(p_currency),
         shares = checked_shares, frequency = p_frequency, interval_count = p_interval, anchor_day = anchor,
         start_on = coalesce(p_start_on, start_on), next_on = next_date, end_on = p_end_on, updated_at = now(),
         -- If the person who set it up has left, whoever changes it takes over adding its expenses.
         created_by = case when exists (select 1 from public.group_members m
                                        where m.group_id = r.group_id and m.user_id = r.created_by)
                           then r.created_by else uid end
   where id = r.id;

  perform public._materialize_recurring(r.id);
end;
$$;

-- Pauses or resumes a recurring expense. Resuming does not add the dates missed while it was
-- paused: it continues with the first date from today on.
create function public.set_recurring_paused(p_recurring_id uuid, p_paused boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  r public.recurring_expenses;
begin
  select * into r from public.recurring_expenses where id = p_recurring_id for update;
  if not found or not public.is_group_member(r.group_id) then
    raise exception 'Recurring expense not found' using errcode = 'P0002';
  end if;
  if p_paused is null or p_paused = r.paused then
    return;
  end if;
  if p_paused then
    update public.recurring_expenses set paused = true, updated_at = now() where id = r.id;
    return;
  end if;

  -- Don't resume something that can no longer be added (e.g. someone in it left the group).
  begin
    perform public._check_recurring(r.group_id, r.amount, r.shares, r.frequency, r.interval_count, r.start_on, r.end_on);
  exception when invalid_parameter_value then
    raise exception 'This recurring expense cannot continue (%). Delete it and add it again.', sqlerrm
      using errcode = '22023';
  end;
  update public.recurring_expenses
     set paused = false, updated_at = now(),
         next_on = public._recurring_first_on_or_after(r.next_on, r.frequency, r.interval_count, r.anchor_day, current_date),
         -- If the person who set it up has left, whoever resumes it takes over adding its expenses.
         created_by = case when exists (select 1 from public.group_members m
                                        where m.group_id = r.group_id and m.user_id = r.created_by)
                           then r.created_by else uid end
   where id = r.id;
  perform public._materialize_recurring(r.id);
end;
$$;

-- Deletes a recurring expense. The expenses it already added stay.
create function public.delete_recurring(p_recurring_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  delete from public.recurring_expenses where id = p_recurring_id and public.is_group_member(group_id);
  if not found then
    raise exception 'Recurring expense not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Adds the due expenses of every recurring expense in the caller's groups and returns how many were
-- added. The app calls this after sign-in and when it comes back to the foreground.
create function public.run_recurring() returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  rid uuid;
  total int := 0;
begin
  for rid in
    select r.id
    from public.recurring_expenses r
    join public.groups g on g.id = r.group_id
    where g.deleted_at is null and not r.paused and r.next_on <= current_date
      and (r.end_on is null or r.next_on <= r.end_on)
      and exists (select 1 from public.group_members m where m.group_id = r.group_id and m.user_id = uid)
    order by r.id
  loop
    total := total + public._materialize_recurring(rid);
  end loop;
  return total;
end;
$$;

-- For a scheduler such as pg_cron (see the README): the same for every rule in every group.
-- Not callable from the app.
create function public.run_recurring_all() returns int
language plpgsql security definer set search_path = '' as $$
declare
  rid uuid;
  total int := 0;
begin
  for rid in
    select id from public.recurring_expenses
    where not paused and next_on <= current_date and (end_on is null or next_on <= end_on)
    order by id
  loop
    total := total + public._materialize_recurring(rid);
  end loop;
  return total;
end;
$$;

------------------------------------------------------------------------------
-- Function privileges
------------------------------------------------------------------------------

revoke execute on function
  public.recurring_next_date(date, text, int, int),
  public._recurring_first_on_or_after(date, text, int, int, date),
  public._check_recurring(uuid, bigint, jsonb, text, int, date, date),
  public._materialize_recurring(uuid),
  public.create_recurring(uuid, text, bigint, text, jsonb, text, int, date, date, text, text),
  public.update_recurring(uuid, text, bigint, text, jsonb, text, int, date, date, text, text),
  public.set_recurring_paused(uuid, boolean),
  public.delete_recurring(uuid),
  public.run_recurring(),
  public.run_recurring_all()
from public, anon, authenticated;
grant execute on function
  public.create_recurring(uuid, text, bigint, text, jsonb, text, int, date, date, text, text),
  public.update_recurring(uuid, text, bigint, text, jsonb, text, int, date, date, text, text),
  public.set_recurring_paused(uuid, boolean),
  public.delete_recurring(uuid),
  public.run_recurring()
to authenticated;
