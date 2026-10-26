-- FairTab initial schema.
-- Money is stored as bigint minor units (cents). Every expense or payment has shares where
-- sum(paid) = sum(owed) = amount. A payment is an entry where the payer "paid" and the receiver "owed".

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now()
);

create function public.new_invite_code() returns text
language sql volatile set search_path = '' as $$
  select translate(rtrim(encode(uuid_send(gen_random_uuid()), 'base64'), '='), '+/', '-_')
$$;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  simplify_debts boolean not null default true,
  invite_code text not null unique default public.new_invite_code(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Soft delete: a deleted group disappears for everyone but can be restored from the dashboard.
  deleted_at timestamptz
);

-- A member is either a real user (user_id set), a guest placeholder (user_id null) that a user
-- can claim through the invite link, or a former member (left_at set) kept so history adds up.
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  left_at timestamptz,
  unique (group_id, user_id),
  check (left_at is null or user_id is null)
);
create index group_members_user_id_idx on public.group_members (user_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense', 'payment')),
  description text not null check (char_length(description) between 1 and 200),
  category text check (char_length(category) <= 50),
  notes text check (char_length(notes) <= 1000),
  amount bigint not null check (amount > 0 and amount <= 100000000000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  spent_on date not null default current_date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index expenses_group_idx on public.expenses (group_id, spent_on desc, created_at desc);

create table public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  member_id uuid not null references public.group_members (id) on delete cascade,
  paid bigint not null default 0 check (paid >= 0 and paid <= 100000000000000),
  owed bigint not null default 0 check (owed >= 0 and owed <= 100000000000000),
  primary key (expense_id, member_id),
  check (paid > 0 or owed > 0)
);
create index expense_shares_member_idx on public.expense_shares (member_id);

-- Optional invite-only mode. While this table is empty anyone can sign up.
-- Add rows (lowercase emails) in the Supabase table editor to allow only those people.
create table public.signup_allowlist (
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  added_at timestamptz not null default now()
);

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------

create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members m
    join public.groups g on g.id = m.group_id
    where m.group_id = gid and m.user_id = (select auth.uid()) and g.deleted_at is null
  )
$$;

create function public.shares_group_with(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    join public.groups g on g.id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other and g.deleted_at is null
  )
$$;

create function public.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  return uid;
end;
$$;

-- True when the member owes nothing and is owed nothing in every currency.
create function public.member_is_settled(p_member_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1
    from public.expense_shares s
    join public.expenses e on e.id = s.expense_id
    where s.member_id = p_member_id and e.deleted_at is null
    group by e.currency
    having sum(s.paid - s.owed) <> 0
  )
$$;

-- Create a profile automatically when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Me'
    ), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- When an account is deleted, keep its history as a former member (or drop rows with no history),
-- so the rows never look like unclaimed guests that anyone with the invite link could take over.
create function public.handle_deleted_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.group_members m
   where m.user_id = old.id and not exists (select 1 from public.expense_shares s where s.member_id = m.id);
  update public.group_members set user_id = null, left_at = now() where user_id = old.id;
  return old;
end;
$$;

create trigger on_profile_deleted
  before delete on public.profiles
  for each row execute function public.handle_deleted_profile();

-- Invite-only mode: refuse sign-ups that are not on the allowlist (when the list is not empty).
create function public.enforce_signup_allowlist() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.signup_allowlist)
     and not exists (select 1 from public.signup_allowlist where email = lower(btrim(coalesce(new.email, '')))) then
    raise exception 'This FairTab is invite-only' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger enforce_signup_allowlist
  before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();

-- Every expense must satisfy sum(paid) = sum(owed) = amount when the transaction commits,
-- however it was written (app, import or the dashboard).
create function public.check_expense_balanced() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  eid uuid;
  total bigint;
  total_paid bigint;
  total_owed bigint;
begin
  if tg_table_name = 'expenses' then
    eid := new.id;
  elsif tg_op = 'DELETE' then
    eid := old.expense_id;
  else
    eid := new.expense_id;
  end if;
  select amount into total from public.expenses where id = eid;
  if total is null then
    return null; -- the expense itself was deleted
  end if;
  select coalesce(sum(paid), 0), coalesce(sum(owed), 0) into total_paid, total_owed
  from public.expense_shares where expense_id = eid;
  if total_paid <> total or total_owed <> total then
    raise exception 'Expense % does not add up: paid %, owed %, amount %', eid, total_paid, total_owed, total
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger expense_shares_balanced
  after insert or update or delete on public.expense_shares
  deferrable initially deferred
  for each row execute function public.check_expense_balanced();

create constraint trigger expenses_balanced
  after insert or update of amount on public.expenses
  deferrable initially deferred
  for each row execute function public.check_expense_balanced();

------------------------------------------------------------------------------
-- Row level security: you can only see groups you belong to.
------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.signup_allowlist enable row level security; -- no policies: dashboard only

create policy "profiles: read self and group mates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "groups: members read" on public.groups
  for select to authenticated using (public.is_group_member(id));
create policy "groups: members update" on public.groups
  for update to authenticated using (public.is_group_member(id)) with check (public.is_group_member(id));

create policy "members: members read" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "members: add guests" on public.group_members
  for insert to authenticated with check (public.is_group_member(group_id) and user_id is null);
-- Members may rename guests and themselves, but not other people's accounts.
create policy "members: rename guests and self" on public.group_members
  for update to authenticated
  using (public.is_group_member(group_id) and (user_id is null or user_id = (select auth.uid())))
  with check (public.is_group_member(group_id) and (user_id is null or user_id = (select auth.uid())));

create policy "expenses: members read" on public.expenses
  for select to authenticated using (public.is_group_member(group_id));

create policy "shares: members read" on public.expense_shares
  for select to authenticated using (
    exists (select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id))
  );

-- Table privileges: nothing for anonymous users, and writes that must keep invariants
-- go through the functions below.
revoke all on public.profiles, public.groups, public.group_members, public.expenses, public.expense_shares,
  public.signup_allowlist from anon, authenticated;
grant select on public.profiles, public.groups, public.group_members, public.expenses, public.expense_shares to authenticated;
grant update (display_name, default_currency) on public.profiles to authenticated;
grant update (name, default_currency, simplify_debts) on public.groups to authenticated;
grant insert (group_id, display_name), update (display_name) on public.group_members to authenticated;

------------------------------------------------------------------------------
-- Functions called by the app
------------------------------------------------------------------------------

create function public.create_group(p_name text, p_currency text default 'USD') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  gid uuid;
begin
  insert into public.groups (name, default_currency, created_by)
  values (trim(p_name), upper(p_currency), uid)
  returning id into gid;

  insert into public.group_members (group_id, user_id, display_name)
  select gid, uid, p.display_name from public.profiles p where p.id = uid;
  return gid;
end;
$$;

-- Internal: validates and writes one expense. p_shares is [{member_id, paid, owed}].
-- Never callable by app users directly (see privileges at the end); callers check access first,
-- and it re-checks that p_user belongs to the group as a second line of defence.
create function public._write_expense(
  p_expense_id uuid, p_group_id uuid, p_kind text, p_description text, p_category text,
  p_amount bigint, p_currency text, p_spent_on date, p_shares jsonb, p_user uuid, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eid uuid := p_expense_id;
  total_paid bigint;
  total_owed bigint;
  share_count int;
  foreign_members int;
  payers int;
  receivers int;
begin
  if not exists (
    select 1 from public.group_members m join public.groups g on g.id = m.group_id
    where m.group_id = p_group_id and m.user_id = p_user and g.deleted_at is null
  ) then
    raise exception 'You are not a member of this group' using errcode = '42501';
  end if;
  if jsonb_typeof(p_shares) is distinct from 'array' then
    raise exception 'shares must be an array' using errcode = '22023';
  end if;
  -- Amounts are never negative; otherwise a negative row could cancel out a fake credit.
  if exists (
    select 1 from jsonb_array_elements(p_shares) s
    where s ->> 'member_id' is null
       or coalesce((s ->> 'paid')::bigint, 0) < 0
       or coalesce((s ->> 'owed')::bigint, 0) < 0
  ) then
    raise exception 'Amounts cannot be negative' using errcode = '22023';
  end if;
  -- People who left can only appear in an expense they were already part of, or in a payment
  -- (to settle up with them). Nobody can be charged for something new after leaving.
  if p_kind <> 'payment' and exists (
    select 1 from jsonb_array_elements(p_shares) s
    join public.group_members m on m.id = (s ->> 'member_id')::uuid
    where m.left_at is not null
      and not exists (select 1 from public.expense_shares old
                      where old.expense_id = p_expense_id and old.member_id = m.id)
  ) then
    raise exception 'Someone in this expense has left the group' using errcode = '22023';
  end if;

  -- Merge duplicate member entries first so every check sees the final shares.
  with merged as (
    select (s ->> 'member_id')::uuid as member_id,
           sum(coalesce((s ->> 'paid')::bigint, 0)) as paid,
           sum(coalesce((s ->> 'owed')::bigint, 0)) as owed
    from jsonb_array_elements(p_shares) s
    group by 1
  )
  select count(*) filter (where merged.paid > 0 or merged.owed > 0),
         coalesce(sum(merged.paid), 0), coalesce(sum(merged.owed), 0),
         count(*) filter (where m.id is null),
         count(*) filter (where merged.paid > 0),
         count(*) filter (where merged.owed > 0)
    into share_count, total_paid, total_owed, foreign_members, payers, receivers
  from merged
  left join public.group_members m on m.id = merged.member_id and m.group_id = p_group_id;

  if share_count = 0 then
    raise exception 'An expense needs at least one person' using errcode = '22023';
  end if;
  if foreign_members > 0 then
    raise exception 'Every person must be a member of the group' using errcode = '22023';
  end if;
  if total_paid <> p_amount or total_owed <> p_amount then
    raise exception 'Paid (%) and owed (%) must both equal the amount (%)', total_paid, total_owed, p_amount
      using errcode = '22023';
  end if;
  if p_kind = 'payment' and (share_count <> 2 or payers <> 1 or receivers <> 1) then
    raise exception 'A payment goes from one person to another person' using errcode = '22023';
  end if;

  if eid is null then
    insert into public.expenses (group_id, kind, description, category, notes, amount, currency, spent_on, created_by)
    values (p_group_id, p_kind, trim(p_description), nullif(trim(p_category), ''), nullif(trim(p_notes), ''),
            p_amount, upper(p_currency), coalesce(p_spent_on, current_date), p_user)
    returning id into eid;
  else
    update public.expenses
       set kind = p_kind, description = trim(p_description), category = nullif(trim(p_category), ''),
           notes = nullif(trim(p_notes), ''), amount = p_amount, currency = upper(p_currency),
           spent_on = coalesce(p_spent_on, spent_on), updated_at = now()
     where id = eid and group_id = p_group_id and deleted_at is null;
    if not found then
      raise exception 'Expense not found' using errcode = 'P0002';
    end if;
    delete from public.expense_shares where expense_id = eid;
  end if;

  insert into public.expense_shares (expense_id, member_id, paid, owed)
  select eid, (s ->> 'member_id')::uuid, sum(coalesce((s ->> 'paid')::bigint, 0)), sum(coalesce((s ->> 'owed')::bigint, 0))
  from jsonb_array_elements(p_shares) s
  group by (s ->> 'member_id')::uuid
  having sum(coalesce((s ->> 'paid')::bigint, 0)) > 0 or sum(coalesce((s ->> 'owed')::bigint, 0)) > 0;

  return eid;
end;
$$;

create function public.save_expense(
  p_group_id uuid, p_description text, p_amount bigint, p_currency text, p_shares jsonb,
  p_kind text default 'expense', p_category text default null, p_spent_on date default null,
  p_expense_id uuid default null, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group' using errcode = '42501';
  end if;
  return public._write_expense(p_expense_id, p_group_id, p_kind, p_description, p_category,
                               p_amount, p_currency, p_spent_on, p_shares, uid, p_notes);
end;
$$;

create function public.delete_expense(p_expense_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  update public.expenses set deleted_at = now(), updated_at = now()
   where id = p_expense_id and deleted_at is null and public.is_group_member(group_id);
  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.restore_expense(p_expense_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  if exists (select 1 from public.expense_shares s join public.group_members m on m.id = s.member_id
             where s.expense_id = p_expense_id and m.left_at is not null) then
    raise exception 'This expense involves someone who has left the group, so it cannot be restored' using errcode = '22023';
  end if;
  update public.expenses set deleted_at = null, updated_at = now()
   where id = p_expense_id and deleted_at is not null and public.is_group_member(group_id);
  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Lets someone with an invite link see what they are joining before they join.
create function public.preview_invite(p_code text)
returns table (group_id uuid, group_name text, member_count int, already_member boolean, guests jsonb)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name,
         (select count(*)::int from public.group_members m where m.group_id = g.id and m.left_at is null),
         public.is_group_member(g.id),
         coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name) order by m.display_name)
                   from public.group_members m
                   where m.group_id = g.id and m.user_id is null and m.left_at is null), '[]'::jsonb)
  from public.groups g
  where g.invite_code = p_code and g.deleted_at is null and auth.uid() is not null
$$;

-- Join through an invite link, optionally taking over a guest placeholder ("I am Bob").
create function public.join_group(p_code text, p_claim_member_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  gid uuid;
begin
  select id into gid from public.groups where invite_code = p_code and deleted_at is null;
  if gid is null then
    raise exception 'This invite link is not valid' using errcode = 'P0002';
  end if;
  if public.is_group_member(gid) then
    return gid;
  end if;

  if p_claim_member_id is not null then
    update public.group_members set user_id = uid
     where id = p_claim_member_id and group_id = gid and user_id is null and left_at is null;
    if not found then
      raise exception 'That person has already joined' using errcode = '23505';
    end if;
  else
    insert into public.group_members (group_id, user_id, display_name)
    select gid, uid, p.display_name from public.profiles p where p.id = uid;
  end if;
  return gid;
end;
$$;

create function public.regenerate_invite(p_group_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  code text;
begin
  perform public.require_user();
  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group' using errcode = '42501';
  end if;
  update public.groups set invite_code = public.new_invite_code() where id = p_group_id
  returning invite_code into code;
  return code;
end;
$$;

-- Removes a person from a group. Someone with no expenses is deleted; anyone else is kept as a
-- former member (so the history still adds up) and can never be claimed through the invite link.
-- Like Splitwise, only people who are settled up can be removed or leave.
create function public._remove_member(p_member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.member_is_settled(p_member_id) then
    raise exception 'Settle up first: this person still owes or is owed money in this group' using errcode = '23514';
  end if;
  if exists (select 1 from public.expense_shares where member_id = p_member_id) then
    update public.group_members set user_id = null, left_at = now() where id = p_member_id;
  else
    delete from public.group_members where id = p_member_id;
  end if;
end;
$$;

create function public.remove_member(p_member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  gid uuid;
begin
  select group_id into gid from public.group_members where id = p_member_id and left_at is null;
  if gid is null or not public.is_group_member(gid) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.group_members where id = p_member_id and user_id = uid) then
    raise exception 'Use "Leave group" to remove yourself' using errcode = '22023';
  end if;
  if exists (select 1 from public.group_members m join public.groups g on g.id = m.group_id
             where m.id = p_member_id and m.user_id = g.created_by) then
    raise exception 'The person who created the group cannot be removed' using errcode = '42501';
  end if;
  perform public._remove_member(p_member_id);
end;
$$;

create function public.leave_group(p_group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  mid uuid;
begin
  select id into mid from public.group_members where group_id = p_group_id and user_id = uid;
  if mid is null or not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group' using errcode = '42501';
  end if;
  perform public._remove_member(mid);
end;
$$;

-- Deletes a group for everyone (soft delete). Only the person who created it can do this.
create function public.delete_group(p_group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
begin
  update public.groups set deleted_at = now()
   where id = p_group_id and deleted_at is null and public.is_group_member(p_group_id)
     and (created_by = uid or created_by is null);
  if not found then
    raise exception 'Only the person who created this group can delete it' using errcode = '42501';
  end if;
end;
$$;

-- Imports a Splitwise group in one transaction.
-- p_members: names from the export. p_me: which of those names is the caller (or null).
-- p_entries: [{kind, description, category, amount, currency, date, shares: [{name, paid, owed}]}]
create function public.import_group(
  p_name text, p_currency text, p_members text[], p_me text, p_entries jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  gid uuid;
  member_ids jsonb := '{}'::jsonb;
  m text;
  mid uuid;
  e jsonb;
begin
  if coalesce(array_length(p_members, 1), 0) = 0 then
    raise exception 'No members to import' using errcode = '22023';
  end if;
  if (select count(distinct x) from unnest(p_members) x) <> array_length(p_members, 1) then
    raise exception 'Member names must be unique' using errcode = '22023';
  end if;
  if p_me is not null and not (p_me = any (p_members)) then
    raise exception 'Unknown member %', p_me using errcode = '22023';
  end if;
  if jsonb_array_length(p_entries) > 2000 then
    raise exception 'Too many entries in one call; send the rest with import_more' using errcode = '22023';
  end if;

  insert into public.groups (name, default_currency, created_by)
  values (trim(p_name), upper(p_currency), uid) returning id into gid;

  foreach m in array p_members loop
    insert into public.group_members (group_id, user_id, display_name)
    values (gid, case when m = p_me then uid end, left(m, 80))
    returning id into mid;
    member_ids := member_ids || jsonb_build_object(m, mid);
  end loop;
  if p_me is null then
    insert into public.group_members (group_id, user_id, display_name)
    select gid, uid, p.display_name from public.profiles p where p.id = uid;
  end if;

  for e in select * from jsonb_array_elements(p_entries) loop
    perform public._write_expense(
      null, gid, e ->> 'kind', left(e ->> 'description', 200), left(e ->> 'category', 50),
      (e ->> 'amount')::bigint, e ->> 'currency', (e ->> 'date')::date,
      (select jsonb_agg(jsonb_build_object('member_id', member_ids ->> (s ->> 'name'),
                                           'paid', s -> 'paid', 'owed', s -> 'owed'))
       from jsonb_array_elements(e -> 'shares') s),
      uid);
  end loop;
  return gid;
end;
$$;

-- Adds the next batch of a Splitwise import to a group the caller created (names match member names).
-- Imports are sent in batches so each call stays well under Supabase's statement timeout.
create function public.import_more(p_group_id uuid, p_entries jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  member_ids jsonb;
  e jsonb;
begin
  if not exists (select 1 from public.groups where id = p_group_id and created_by = uid and deleted_at is null)
     or not public.is_group_member(p_group_id) then
    raise exception 'Only the person who imported this group can add to it' using errcode = '42501';
  end if;
  if jsonb_array_length(p_entries) > 2000 then
    raise exception 'Too many entries in one call' using errcode = '22023';
  end if;
  select jsonb_object_agg(display_name, id) into member_ids
  from public.group_members where group_id = p_group_id and left_at is null;

  for e in select * from jsonb_array_elements(p_entries) loop
    perform public._write_expense(
      null, p_group_id, e ->> 'kind', left(e ->> 'description', 200), left(e ->> 'category', 50),
      (e ->> 'amount')::bigint, e ->> 'currency', (e ->> 'date')::date,
      (select jsonb_agg(jsonb_build_object('member_id', member_ids ->> (s ->> 'name'),
                                           'paid', s -> 'paid', 'owed', s -> 'owed'))
       from jsonb_array_elements(e -> 'shares') s),
      uid);
  end loop;
end;
$$;

------------------------------------------------------------------------------
-- Function privileges
------------------------------------------------------------------------------
-- Supabase grants EXECUTE on new functions to anon and authenticated by default, so revoke
-- everything (including from authenticated) and grant back only the functions the app calls.
-- Internal helpers (_write_expense, _remove_member, member_is_settled, new_invite_code and the
-- trigger functions) stay private.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges revoke execute on functions from public;
grant execute on function
  public.is_group_member(uuid), public.shares_group_with(uuid), public.require_user(),
  public.create_group(text, text),
  public.save_expense(uuid, text, bigint, text, jsonb, text, text, date, uuid, text),
  public.delete_expense(uuid), public.restore_expense(uuid),
  public.preview_invite(text), public.join_group(text, uuid), public.regenerate_invite(uuid),
  public.remove_member(uuid), public.leave_group(uuid), public.delete_group(uuid),
  public.import_group(text, text, text[], text, jsonb), public.import_more(uuid, jsonb)
to authenticated;
