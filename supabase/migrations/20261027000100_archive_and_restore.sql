-- Archived groups and restoring deleted expenses.
-- Any member can archive a group. An archived group is read-only for everyone until a member
-- unarchives it: no new or changed expenses, people, invite links or settings. People can still
-- leave it (once settled up) and its creator can still delete it.
-- Safe to run more than once.

alter table public.groups add column if not exists archived_at timestamptz;

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------

-- True when the signed-in user is a member of the group and it is not deleted or archived.
-- Used by row level security. Checking membership here too means people outside the group
-- always get false, so they cannot use it to find out whether a group exists or is archived.
create or replace function public.group_is_active(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members m
    join public.groups g on g.id = m.group_id
    where m.group_id = gid and m.user_id = (select auth.uid())
      and g.deleted_at is null and g.archived_at is null
  )
$$;

-- Internal: refuses changes to an archived group. Callers check membership first.
create or replace function public._require_not_archived(p_group_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.groups where id = p_group_id and archived_at is not null) then
    raise exception 'This group is archived. Unarchive it to make changes.' using errcode = '42501';
  end if;
end;
$$;

------------------------------------------------------------------------------
-- Archive and unarchive
------------------------------------------------------------------------------

create or replace function public.archive_group(p_group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group' using errcode = '42501';
  end if;
  -- Archiving twice keeps the original date.
  update public.groups set archived_at = coalesce(archived_at, now()) where id = p_group_id;
end;
$$;

create or replace function public.unarchive_group(p_group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group' using errcode = '42501';
  end if;
  update public.groups set archived_at = null where id = p_group_id;
end;
$$;

------------------------------------------------------------------------------
-- Existing functions, now refusing changes to archived groups
-- (bodies copied from 20261026000000_init.sql; the only change is the _require_not_archived call)
------------------------------------------------------------------------------

-- Every expense write goes through here (save_expense, import_more and anything added later).
create or replace function public._write_expense(
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
  perform public._require_not_archived(p_group_id);
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

create or replace function public.delete_expense(p_expense_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  -- Only looks at groups I belong to; anything else ends in "Expense not found" below.
  perform public._require_not_archived(
    (select group_id from public.expenses where id = p_expense_id and public.is_group_member(group_id)));
  update public.expenses set deleted_at = now(), updated_at = now()
   where id = p_expense_id and deleted_at is null and public.is_group_member(group_id);
  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.restore_expense(p_expense_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_user();
  perform public._require_not_archived(
    (select group_id from public.expenses where id = p_expense_id and public.is_group_member(group_id)));
  -- Like _write_expense: someone who left can still be in a payment (settling up), not in an expense.
  if exists (select 1 from public.expense_shares s join public.group_members m on m.id = s.member_id
             join public.expenses e on e.id = s.expense_id
             where s.expense_id = p_expense_id and m.left_at is not null and e.kind <> 'payment') then
    raise exception 'This expense involves someone who has left the group, so it cannot be restored' using errcode = '22023';
  end if;
  update public.expenses set deleted_at = null, updated_at = now()
   where id = p_expense_id and deleted_at is not null and public.is_group_member(group_id);
  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.join_group(p_code text, p_claim_member_id uuid default null) returns uuid
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
  perform public._require_not_archived(gid);

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

create or replace function public.regenerate_invite(p_group_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  code text;
begin
  perform public.require_user();
  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group' using errcode = '42501';
  end if;
  perform public._require_not_archived(p_group_id);
  update public.groups set invite_code = public.new_invite_code() where id = p_group_id
  returning invite_code into code;
  return code;
end;
$$;

create or replace function public.remove_member(p_member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_user();
  gid uuid;
begin
  select group_id into gid from public.group_members where id = p_member_id and left_at is null;
  if gid is null or not public.is_group_member(gid) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  perform public._require_not_archived(gid);
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

------------------------------------------------------------------------------
-- Row level security: direct writes (renaming the group, adding or renaming people) also stop
-- while the group is archived.
------------------------------------------------------------------------------

drop policy if exists "groups: members update" on public.groups;
create policy "groups: members update" on public.groups
  for update to authenticated
  using (public.is_group_member(id) and public.group_is_active(id))
  with check (public.is_group_member(id) and public.group_is_active(id));

drop policy if exists "members: add guests" on public.group_members;
create policy "members: add guests" on public.group_members
  for insert to authenticated
  with check (public.is_group_member(group_id) and public.group_is_active(group_id) and user_id is null);

-- Members may rename guests and themselves, but not other people's accounts.
drop policy if exists "members: rename guests and self" on public.group_members;
create policy "members: rename guests and self" on public.group_members
  for update to authenticated
  using (public.is_group_member(group_id) and public.group_is_active(group_id)
         and (user_id is null or user_id = (select auth.uid())))
  with check (public.is_group_member(group_id) and public.group_is_active(group_id)
              and (user_id is null or user_id = (select auth.uid())));

------------------------------------------------------------------------------
-- Function privileges (see the end of 20261026000000_init.sql)
------------------------------------------------------------------------------
-- group_is_active is granted because row level security policies run it as the signed-in user.
-- _write_expense and _require_not_archived stay private.
revoke execute on function
  public.group_is_active(uuid), public._require_not_archived(uuid),
  public.archive_group(uuid), public.unarchive_group(uuid),
  public._write_expense(uuid, uuid, text, text, text, bigint, text, date, jsonb, uuid, text),
  public.delete_expense(uuid), public.restore_expense(uuid),
  public.join_group(text, uuid), public.regenerate_invite(uuid), public.remove_member(uuid)
from public, anon, authenticated;
grant execute on function
  public.group_is_active(uuid),
  public.archive_group(uuid), public.unarchive_group(uuid),
  public.delete_expense(uuid), public.restore_expense(uuid),
  public.join_group(text, uuid), public.regenerate_invite(uuid), public.remove_member(uuid)
to authenticated;
