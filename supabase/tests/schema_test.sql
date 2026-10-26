-- Run against a database with local_auth_stub.sql and the migrations applied.
-- Every block raises an exception (and psql stops) if an expectation fails.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'mallory@example.com', '{}');

create function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false);
$$;

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;

-- Internal helpers must not be callable by app users (Supabase grants EXECUTE by default).
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public._write_expense(uuid,uuid,text,text,text,bigint,text,date,jsonb,uuid,text)',
    'public._remove_member(uuid)',
    'public.member_is_settled(uuid)',
    'public.handle_new_user()',
    'public.enforce_signup_allowlist()',
    'public.new_invite_code()'
  ] loop
    if has_function_privilege('authenticated', fn, 'execute') or has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL: % is callable by app users', fn;
    end if;
  end loop;
  foreach fn in array array['public.save_expense(uuid,text,bigint,text,jsonb,text,text,date,uuid,text)', 'public.join_group(text,uuid)'] loop
    if not has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'FAIL: % should be callable by signed-in users', fn;
    end if;
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL: % is callable by anonymous users', fn;
    end if;
  end loop;
end $$;

set role authenticated;

-- Alice creates a group and a guest "Bob".
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare gid uuid; guest uuid; me uuid; eid uuid;
begin
  gid := public.create_group('Trip', 'eur');
  select id into me from public.group_members where group_id = gid and user_id = auth.uid();
  insert into public.group_members (group_id, display_name) values (gid, 'Bob') returning id into guest;
  insert into ctx values ('gid', gid), ('alice_member', me), ('bob_member', guest),
    ('code', (select invite_code from public.groups where id = gid));

  -- Alice pays 40 for both.
  eid := public.save_expense(gid, 'Dinner', 3000, 'EUR', jsonb_build_array(
    jsonb_build_object('member_id', me, 'paid', 3000, 'owed', 1500),
    jsonb_build_object('member_id', guest, 'paid', 0, 'owed', 1500)), p_notes => 'Pizza place');
  insert into ctx values ('eid', eid);
  if (select notes from public.expenses where id = eid) <> 'Pizza place' then
    raise exception 'FAIL: notes not saved';
  end if;

  -- Shares that do not add up are rejected.
  begin
    perform public.save_expense(gid, 'Bad', 3000, 'EUR', jsonb_build_array(
      jsonb_build_object('member_id', me, 'paid', 3000, 'owed', 1000)));
    raise exception 'FAIL: unbalanced expense accepted';
  exception when sqlstate '22023' then null;
  end;

  -- A payment to yourself is rejected, even when split into duplicate entries.
  begin
    perform public.save_expense(gid, 'Payment', 500, 'EUR', jsonb_build_array(
      jsonb_build_object('member_id', me, 'paid', 500, 'owed', 0),
      jsonb_build_object('member_id', me, 'paid', 0, 'owed', 500)), p_kind => 'payment');
    raise exception 'FAIL: payment to self accepted';
  exception when sqlstate '22023' then null;
  end;

  -- Editing works and replaces shares.
  perform public.save_expense(gid, 'Dinner', 4000, 'EUR', jsonb_build_array(
    jsonb_build_object('member_id', me, 'paid', 4000, 'owed', 2000),
    jsonb_build_object('member_id', guest, 'paid', 0, 'owed', 2000)), p_expense_id => eid);
  if (select sum(owed) from public.expense_shares where expense_id = eid) <> 4000 then
    raise exception 'FAIL: edit did not replace shares';
  end if;

  -- Direct writes that would skip validation are blocked.
  begin
    insert into public.expenses (group_id, description, amount, currency) values (gid, 'x', 1, 'EUR');
    raise exception 'FAIL: direct expense insert allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.group_members set user_id = '00000000-0000-0000-0000-00000000000c' where id = guest;
    raise exception 'FAIL: member user_id was writable';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.group_members where id = guest;
    raise exception 'FAIL: direct member delete allowed';
  exception when insufficient_privilege then null;
  end;

  -- Removing a guest who owes money is refused.
  begin
    perform public.remove_member(guest);
    raise exception 'FAIL: removed a member with an open balance';
  exception when sqlstate '23514' then null;
  end;

  -- A guest with no expenses can be removed completely.
  insert into public.group_members (group_id, display_name) values (gid, 'Typo') returning id into guest;
  perform public.remove_member(guest);
  if exists (select 1 from public.group_members where id = guest) then
    raise exception 'FAIL: guest without expenses was not removed';
  end if;
end $$;

-- Mallory has no access to anything.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$
declare gid uuid := (select v from ctx where k = 'gid');
begin
  if exists (select 1 from public.groups) or exists (select 1 from public.expenses)
     or exists (select 1 from public.expense_shares) or exists (select 1 from public.group_members) then
    raise exception 'FAIL: outsider can read group data';
  end if;
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'FAIL: outsider can read other profiles';
  end if;
  begin
    perform public.save_expense(gid, 'Hack', 100, 'EUR', jsonb_build_array(
      jsonb_build_object('member_id', (select v from ctx where k = 'bob_member'), 'paid', 100, 'owed', 100)));
    raise exception 'FAIL: outsider added an expense';
  exception when insufficient_privilege then null;
  end;
  -- The internal helper cannot be called directly to skip the membership check.
  begin
    perform public._write_expense((select v from ctx where k = 'eid')::uuid, gid, 'expense', 'HACKED', null,
      100, 'EUR', null, jsonb_build_array(jsonb_build_object('member_id', (select v from ctx where k = 'bob_member'), 'paid', 100, 'owed', 100)),
      '00000000-0000-0000-0000-00000000000a'::uuid);
    raise exception 'FAIL: outsider called _write_expense';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_expense((select v from ctx where k = 'eid')::uuid);
    raise exception 'FAIL: outsider deleted an expense';
  exception when no_data_found then null;
  end;
  begin
    perform public.remove_member((select v from ctx where k = 'bob_member')::uuid);
    raise exception 'FAIL: outsider removed a member';
  exception when no_data_found then null;
  end;
  begin
    perform public.delete_group(gid);
    raise exception 'FAIL: outsider deleted the group';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.preview_invite('wrong-code')) then
    raise exception 'FAIL: preview with a wrong code';
  end if;
end $$;

-- Bob joins with the link and claims the guest placeholder.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$
declare p record; gid uuid;
begin
  select * into p from public.preview_invite((select v from ctx where k = 'code'));
  if p.group_name <> 'Trip' or p.already_member or jsonb_array_length(p.guests) <> 1 then
    raise exception 'FAIL: preview wrong: %', row_to_json(p);
  end if;
  gid := public.join_group((select v from ctx where k = 'code'), (p.guests -> 0 ->> 'id')::uuid);
  if (select user_id from public.group_members where id = (select v from ctx where k = 'bob_member')::uuid) <> auth.uid() then
    raise exception 'FAIL: claim did not link the member';
  end if;
  if (select count(*) from public.expense_shares) <> 2 then
    raise exception 'FAIL: Bob cannot see the shares';
  end if;
  if (select count(*) from public.profiles) <> 2 then
    raise exception 'FAIL: Bob should see his and Alice''s profile';
  end if;

  -- Bob cannot rename Alice's account, but can rename himself.
  update public.group_members set display_name = 'Evil' where id = (select v from ctx where k = 'alice_member')::uuid;
  if (select display_name from public.group_members where id = (select v from ctx where k = 'alice_member')::uuid) = 'Evil' then
    raise exception 'FAIL: renamed another user';
  end if;
  update public.group_members set display_name = 'Bobby' where id = (select v from ctx where k = 'bob_member')::uuid;
  if (select display_name from public.group_members where id = (select v from ctx where k = 'bob_member')::uuid) <> 'Bobby' then
    raise exception 'FAIL: could not rename self';
  end if;

  -- Bob cannot leave while he owes money.
  begin
    perform public.leave_group(gid);
    raise exception 'FAIL: left with an open balance';
  exception when sqlstate '23514' then null;
  end;

  -- Bob settles up.
  perform public.save_expense(gid, 'Payment', 2000, 'EUR', jsonb_build_array(
    jsonb_build_object('member_id', (select v from ctx where k = 'bob_member'), 'paid', 2000, 'owed', 0),
    jsonb_build_object('member_id', (select v from ctx where k = 'alice_member'), 'paid', 0, 'owed', 2000)),
    p_kind => 'payment');
  if exists (
    select 1 from public.expense_shares s join public.expenses e on e.id = s.expense_id
    where e.deleted_at is null group by s.member_id having sum(s.paid - s.owed) <> 0
  ) then
    raise exception 'FAIL: balances not zero after payment';
  end if;

  -- Now Bob can leave. His row stays as a former member that nobody can claim.
  perform public.leave_group(gid);
end $$;

reset role;
do $$
begin
  if (select left_at is null or user_id is not null from public.group_members where id = (select v from ctx where k = 'bob_member')::uuid) then
    raise exception 'FAIL: leaving did not mark Bob as a former member';
  end if;
end $$;
set role authenticated;

-- Mallory cannot take over Bob's old place, and the preview no longer lists him.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$
declare p record;
begin
  select * into p from public.preview_invite((select v from ctx where k = 'code'));
  if jsonb_array_length(p.guests) <> 0 or p.member_count <> 1 then
    raise exception 'FAIL: former member offered for claiming: %', row_to_json(p);
  end if;
  begin
    perform public.join_group((select v from ctx where k = 'code'), (select v from ctx where k = 'bob_member')::uuid);
    raise exception 'FAIL: claimed a former member';
  exception when unique_violation then null;
  end;
end $$;

-- Mallory joins as a new member; Alice can remove her because she has no expenses.
do $$
declare mid uuid;
begin
  perform public.join_group((select v from ctx where k = 'code'));
  select id into mid from public.group_members where user_id = auth.uid();
  insert into ctx values ('mallory_member', mid);
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
begin
  perform public.remove_member((select v from ctx where k = 'mallory_member')::uuid);
  begin
    perform public.remove_member((select v from ctx where k = 'alice_member')::uuid);
    raise exception 'FAIL: removed yourself with remove_member';
  exception when sqlstate '22023' then null;
  end;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$
begin
  if exists (select 1 from public.groups) then
    raise exception 'FAIL: removed member can still see the group';
  end if;
end $$;

-- Bob rejoins later as a new member. He is not the creator, so he cannot delete the group.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$
declare gid uuid;
begin
  gid := public.join_group((select v from ctx where k = 'code'));
  begin
    perform public.delete_group(gid);
    raise exception 'FAIL: non-creator deleted the group';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Alice (the creator) deletes it; it disappears for everyone and the link stops working.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
begin
  perform public.delete_group((select v from ctx where k = 'gid')::uuid);
  if exists (select 1 from public.groups where id = (select v from ctx where k = 'gid')::uuid)
     or exists (select 1 from public.expenses) then
    raise exception 'FAIL: deleted group still visible';
  end if;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$
begin
  if exists (select 1 from public.groups) or exists (select 1 from public.preview_invite((select v from ctx where k = 'code'))) then
    raise exception 'FAIL: deleted group visible to members or through the link';
  end if;
  begin
    perform public.save_expense((select v from ctx where k = 'gid')::uuid, 'Late', 100, 'EUR', '[]'::jsonb);
    raise exception 'FAIL: wrote to a deleted group';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Anonymous users cannot call anything.
reset role;
set role anon;
do $$
begin
  perform public.create_group('x');
  raise exception 'FAIL: anon could call create_group';
exception when insufficient_privilege then null;
end $$;

-- Splitwise import.
reset role;
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$
declare gid uuid;
begin
  gid := public.import_group('Imported', 'USD', array['Alice S', 'Bob'], 'Alice S', '[
    {"kind":"expense","description":"Dinner","category":"Dining out","amount":3000,"currency":"USD","date":"2024-01-05",
     "shares":[{"name":"Alice S","paid":3000,"owed":1500},{"name":"Bob","paid":0,"owed":1500}]},
    {"kind":"payment","description":"Payment","category":"Payment","amount":1000,"currency":"USD","date":"2024-01-06",
     "shares":[{"name":"Bob","paid":1000,"owed":0},{"name":"Alice S","paid":0,"owed":1000}]}
  ]'::jsonb);
  if (select count(*) from public.expenses where group_id = gid) <> 2 then
    raise exception 'FAIL: import entries missing';
  end if;
  if (select user_id from public.group_members where group_id = gid and display_name = 'Alice S') <> auth.uid() then
    raise exception 'FAIL: importer not linked to their name';
  end if;
  if (select sum(s.paid - s.owed) from public.expense_shares s join public.group_members m on m.id = s.member_id
      where m.group_id = gid and m.display_name = 'Bob') <> -500 then
    raise exception 'FAIL: imported balance wrong';
  end if;
end $$;

-- Invite-only mode: once the allowlist has entries, only listed emails can sign up.
reset role;
insert into public.signup_allowlist (email) values ('friend@example.com');
do $$
begin
  begin
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'stranger@example.com');
    raise exception 'FAIL: stranger signed up in invite-only mode';
  exception when insufficient_privilege then null;
  end;
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d2', 'Friend@Example.com');
  if not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000d2') then
    raise exception 'FAIL: allowed friend has no profile';
  end if;
end $$;
delete from public.signup_allowlist;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d3', 'anyone@example.com');

\echo 'ALL SCHEMA TESTS PASSED'
