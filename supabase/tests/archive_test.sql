-- Archived groups are read-only; deleted expenses can be restored.
-- Run against a database with local_auth_stub.sql and the migrations applied (supabase/tests/run.sh).
-- Every block raises an exception (and psql stops) if an expectation fails.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{"display_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'mallory@example.com', '{}');

create function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false);
$$;
-- The migrations remove PUBLIC's default EXECUTE on new functions, so grant the test helpers explicitly.
grant execute on function pg_temp.act_as(text) to authenticated, anon;

-- Runs a statement and checks that it is refused because the group is archived.
create function pg_temp.expect_archived(what text, stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % worked while the group was archived', what;
exception when insufficient_privilege then
  if sqlerrm is distinct from 'This group is archived. Unarchive it to make changes.' then
    raise exception 'FAIL: % was refused with the wrong message: %', what, sqlerrm;
  end if;
end $$;
grant execute on function pg_temp.expect_archived(text, text) to authenticated;

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;

-- The new functions are callable by signed-in users only; the internal helpers by nobody.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public._require_not_archived(uuid)',
    'public._write_expense(uuid,uuid,text,text,text,bigint,text,date,jsonb,uuid,text)'
  ] loop
    if has_function_privilege('authenticated', fn, 'execute') or has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL: % is callable by app users', fn;
    end if;
  end loop;
  foreach fn in array array[
    'public.archive_group(uuid)', 'public.unarchive_group(uuid)', 'public.group_is_active(uuid)',
    'public.delete_expense(uuid)', 'public.restore_expense(uuid)', 'public.join_group(text,uuid)',
    'public.regenerate_invite(uuid)', 'public.remove_member(uuid)'
  ] loop
    if not has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'FAIL: % should be callable by signed-in users', fn;
    end if;
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL: % is callable by anonymous users', fn;
    end if;
  end loop;
end $$;

set role authenticated;

-- Alice creates a group with two guests (Sam, and Typo who is in no expense), one expense and one
-- deleted expense.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare gid uuid; me uuid; sam uuid; spare uuid; eid uuid; gone uuid;
begin
  gid := public.create_group('Flat', 'CAD');
  select id into me from public.group_members where group_id = gid and user_id = auth.uid();
  insert into public.group_members (group_id, display_name) values (gid, 'Sam') returning id into sam;
  insert into public.group_members (group_id, display_name) values (gid, 'Typo') returning id into spare;
  eid := public.save_expense(gid, 'Groceries', 4000, 'CAD', jsonb_build_array(
    jsonb_build_object('member_id', me, 'paid', 4000, 'owed', 2000),
    jsonb_build_object('member_id', sam, 'paid', 0, 'owed', 2000)));
  gone := public.save_expense(gid, 'Pizza', 1000, 'CAD', jsonb_build_array(
    jsonb_build_object('member_id', me, 'paid', 1000, 'owed', 500),
    jsonb_build_object('member_id', sam, 'paid', 0, 'owed', 500)));
  perform public.delete_expense(gone);
  insert into ctx values ('gid', gid), ('me', me), ('sam', sam), ('spare', spare), ('eid', eid), ('gone', gone),
    ('code', (select invite_code from public.groups where id = gid));
  if (select archived_at from public.groups where id = gid) is not null then
    raise exception 'FAIL: a new group is archived';
  end if;
  if not public.group_is_active(gid) then
    raise exception 'FAIL: a new group is not active';
  end if;
end $$;

-- Bob joins with the link as a new person (so Sam can still be claimed later).
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$
begin
  perform public.join_group((select v from ctx where k = 'code'));
end $$;

-- Mallory is not a member: she cannot archive, unarchive or restore anything.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$
declare gid uuid := (select v from ctx where k = 'gid');
begin
  begin
    perform public.archive_group(gid);
    raise exception 'FAIL: outsider archived the group';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.unarchive_group(gid);
    raise exception 'FAIL: outsider unarchived the group';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.archive_group(gen_random_uuid());
    raise exception 'FAIL: archived a group that does not exist';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.restore_expense((select v from ctx where k = 'gone')::uuid);
    raise exception 'FAIL: outsider restored an expense';
  exception when no_data_found then null;
  end;
end $$;
reset role;
do $$
begin
  if (select archived_at from public.groups where id = (select v from ctx where k = 'gid')::uuid) is not null then
    raise exception 'FAIL: outsider changed archived_at';
  end if;
end $$;
set role authenticated;

-- Bob, a member who did not create the group, archives it.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$
declare gid uuid := (select v from ctx where k = 'gid');
begin
  perform public.archive_group(gid);
  if (select archived_at from public.groups where id = gid) is null then
    raise exception 'FAIL: archive_group did not archive';
  end if;
  if public.group_is_active(gid) then
    raise exception 'FAIL: an archived group counts as active';
  end if;
  insert into ctx values ('archived_at', (select archived_at from public.groups where id = gid));
end $$;
-- Archiving again (in a later transaction) keeps the original date.
do $$
declare gid uuid := (select v from ctx where k = 'gid');
begin
  perform public.archive_group(gid);
  if (select archived_at from public.groups where id = gid) is distinct from (select v from ctx where k = 'archived_at')::timestamptz then
    raise exception 'FAIL: archiving twice changed the date';
  end if;
end $$;

-- While archived, every way of changing the group is refused. Reading still works.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $test$
declare gid uuid := (select v from ctx where k = 'gid');
begin
  if (select count(*) from public.expenses where group_id = gid and deleted_at is null) is distinct from 1::bigint then
    raise exception 'FAIL: members cannot read the expenses of an archived group';
  end if;

  perform pg_temp.expect_archived('Adding an expense', $$
    select public.save_expense((select v from ctx where k = 'gid')::uuid, 'Late', 1000, 'CAD', jsonb_build_array(
      jsonb_build_object('member_id', (select v from ctx where k = 'me'), 'paid', 1000, 'owed', 1000)))
  $$);
  perform pg_temp.expect_archived('Recording a payment', $$
    select public.save_expense((select v from ctx where k = 'gid')::uuid, 'Payment', 2000, 'CAD', jsonb_build_array(
      jsonb_build_object('member_id', (select v from ctx where k = 'sam'), 'paid', 2000, 'owed', 0),
      jsonb_build_object('member_id', (select v from ctx where k = 'me'), 'paid', 0, 'owed', 2000)), p_kind => 'payment')
  $$);
  perform pg_temp.expect_archived('Editing an expense', $$
    select public.save_expense((select v from ctx where k = 'gid')::uuid, 'Groceries', 5000, 'CAD', jsonb_build_array(
      jsonb_build_object('member_id', (select v from ctx where k = 'me'), 'paid', 5000, 'owed', 2500),
      jsonb_build_object('member_id', (select v from ctx where k = 'sam'), 'paid', 0, 'owed', 2500)),
      p_expense_id => (select v from ctx where k = 'eid')::uuid)
  $$);
  perform pg_temp.expect_archived('Importing more entries', $$
    select public.import_more((select v from ctx where k = 'gid')::uuid, '[{"kind":"expense","description":"Taxi",
      "category":"Taxi","amount":1000,"currency":"CAD","date":"2026-10-01",
      "shares":[{"name":"Alice","paid":1000,"owed":500},{"name":"Sam","paid":0,"owed":500}]}]'::jsonb)
  $$);
  perform pg_temp.expect_archived('Deleting an expense', $$
    select public.delete_expense((select v from ctx where k = 'eid')::uuid)
  $$);
  perform pg_temp.expect_archived('Restoring an expense', $$
    select public.restore_expense((select v from ctx where k = 'gone')::uuid)
  $$);
  perform pg_temp.expect_archived('Removing a person', $$
    select public.remove_member((select v from ctx where k = 'spare')::uuid)
  $$);
  perform pg_temp.expect_archived('Making a new invite link', $$
    select public.regenerate_invite((select v from ctx where k = 'gid')::uuid)
  $$);

  -- Direct writes: updates match no rows, inserts are refused.
  update public.groups set name = 'Renamed', simplify_debts = false where id = gid;
  if (select (name, simplify_debts) from public.groups where id = gid) is distinct from ('Flat'::text, true) then
    raise exception 'FAIL: changed the settings of an archived group';
  end if;
  begin
    insert into public.group_members (group_id, display_name) values (gid, 'Newbie');
    raise exception 'FAIL: added a guest to an archived group';
  exception when insufficient_privilege then null;
  end;
  update public.group_members set display_name = 'Samuel' where id = (select v from ctx where k = 'sam')::uuid;
  update public.group_members set display_name = 'Me again' where id = (select v from ctx where k = 'me')::uuid;
  if exists (select 1 from public.group_members where group_id = gid and display_name in ('Samuel', 'Me again')) then
    raise exception 'FAIL: renamed someone in an archived group';
  end if;
  begin
    update public.groups set archived_at = null where id = gid;
    raise exception 'FAIL: archived_at was directly writable';
  exception when insufficient_privilege then null;
  end;
end $test$;

-- Nobody can join an archived group, with or without claiming a guest. An outsider who tries to
-- restore one of its expenses learns nothing about it.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $test$
begin
  perform pg_temp.expect_archived('Joining', $$
    select public.join_group((select v from ctx where k = 'code'))
  $$);
  perform pg_temp.expect_archived('Joining as a guest', $$
    select public.join_group((select v from ctx where k = 'code'), (select v from ctx where k = 'sam')::uuid)
  $$);
  begin
    perform public.restore_expense((select v from ctx where k = 'gone')::uuid);
    raise exception 'FAIL: outsider restored an expense';
  exception when no_data_found then null;
  end;
end $test$;

-- Nothing changed.
reset role;
do $$
declare gid uuid := (select v from ctx where k = 'gid');
begin
  if (select count(*) from public.expenses where group_id = gid) is distinct from 2::bigint
     or (select deleted_at from public.expenses where id = (select v from ctx where k = 'eid')::uuid) is not null
     or (select deleted_at from public.expenses where id = (select v from ctx where k = 'gone')::uuid) is null
     or (select amount from public.expenses where id = (select v from ctx where k = 'eid')::uuid) is distinct from 4000::bigint then
    raise exception 'FAIL: expenses changed while archived';
  end if;
  if (select invite_code from public.groups where id = gid) is distinct from (select v from ctx where k = 'code')
     or (select count(*) from public.group_members where group_id = gid) is distinct from 4::bigint
     or exists (select 1 from public.group_members where group_id = gid
                and user_id = '00000000-0000-0000-0000-00000000000c') then
    raise exception 'FAIL: the group or its people changed while archived';
  end if;
end $$;
set role authenticated;

-- Leaving an archived group is still allowed (Bob is settled up).
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$
begin
  perform public.leave_group((select v from ctx where k = 'gid')::uuid);
  if exists (select 1 from public.groups where id = (select v from ctx where k = 'gid')::uuid) then
    raise exception 'FAIL: could not leave an archived group';
  end if;
end $$;

-- Alice unarchives it, and everything works again.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare gid uuid := (select v from ctx where k = 'gid');
begin
  perform public.unarchive_group(gid);
  if (select archived_at from public.groups where id = gid) is not null or not public.group_is_active(gid) then
    raise exception 'FAIL: unarchive_group did not unarchive';
  end if;
end $$;
do $$
declare
  gid uuid := (select v from ctx where k = 'gid');
  me uuid := (select v from ctx where k = 'me');
  sam uuid := (select v from ctx where k = 'sam');
  eid uuid := (select v from ctx where k = 'eid');
  gone uuid := (select v from ctx where k = 'gone');
  extra uuid;
  code text;
begin
  -- Restoring a deleted expense in an active group brings it back with its shares.
  perform public.restore_expense(gone);
  if (select deleted_at from public.expenses where id = gone) is not null then
    raise exception 'FAIL: restore_expense did not restore';
  end if;
  if (select sum(owed) from public.expense_shares s join public.expenses e on e.id = s.expense_id
      where s.member_id = sam and e.deleted_at is null) is distinct from 2500::numeric then
    raise exception 'FAIL: restored expense does not count in the balances';
  end if;
  begin
    perform public.restore_expense(gone);
    raise exception 'FAIL: restored an expense that is not deleted';
  exception when no_data_found then null;
  end;

  extra := public.save_expense(gid, 'Late', 1000, 'CAD', jsonb_build_array(
    jsonb_build_object('member_id', me, 'paid', 1000, 'owed', 1000)));
  perform public.save_expense(gid, 'Groceries', 5000, 'CAD', jsonb_build_array(
    jsonb_build_object('member_id', me, 'paid', 5000, 'owed', 2500),
    jsonb_build_object('member_id', sam, 'paid', 0, 'owed', 2500)), p_expense_id => eid);
  perform public.delete_expense(extra);
  perform public.remove_member((select v from ctx where k = 'spare')::uuid);
  if exists (select 1 from public.group_members where id = (select v from ctx where k = 'spare')::uuid) then
    raise exception 'FAIL: could not remove a person after unarchiving';
  end if;
  code := public.regenerate_invite(gid);
  if code is not distinct from (select v from ctx where k = 'code') then
    raise exception 'FAIL: invite link did not change after unarchiving';
  end if;
  update ctx set v = code where k = 'code';

  update public.groups set name = 'Flat 2' where id = gid;
  insert into public.group_members (group_id, display_name) values (gid, 'Newbie');
  update public.group_members set display_name = 'Samuel' where id = sam;
  if (select name from public.groups where id = gid) is distinct from 'Flat 2'
     or not exists (select 1 from public.group_members where group_id = gid and display_name = 'Newbie')
     or (select display_name from public.group_members where id = sam) is distinct from 'Samuel' then
    raise exception 'FAIL: direct writes refused after unarchiving';
  end if;
end $$;

-- Mallory can join again once the group is no longer archived.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$
begin
  perform public.join_group((select v from ctx where k = 'code'));
  if not exists (select 1 from public.groups where id = (select v from ctx where k = 'gid')::uuid) then
    raise exception 'FAIL: could not join after unarchiving';
  end if;
end $$;

-- The creator can still delete an archived group. A deleted group cannot be archived or unarchived.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare gid uuid;
begin
  gid := public.create_group('Old trip', 'EUR');
  perform public.archive_group(gid);
  perform public.delete_group(gid);
  if exists (select 1 from public.groups where id = gid) then
    raise exception 'FAIL: could not delete an archived group';
  end if;
  begin
    perform public.unarchive_group(gid);
    raise exception 'FAIL: unarchived a deleted group';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.archive_group(gid);
    raise exception 'FAIL: archived a deleted group';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo 'ARCHIVE TESTS PASSED'
