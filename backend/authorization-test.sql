-- Rolled-back fixtures only. No users, sessions, friendships or sets remain.
begin;
insert into auth.users(id,email) values
 ('a1111111-1111-4111-8111-111111111111','repertoire-alice@example.invalid'),
 ('b2222222-2222-4222-8222-222222222222','repertoire-bob@example.invalid'),
 ('c3333333-3333-4333-8333-333333333333','repertoire-carol@example.invalid'),
 ('d4444444-4444-4444-8444-444444444444','repertoire-outsider@example.invalid');
insert into public.repertoire_profiles(id,display_name,friend_code,share_practice) values
 ('a1111111-1111-4111-8111-111111111111','Test Alice','test-alice-code',true),
 ('b2222222-2222-4222-8222-222222222222','Test Bob','test-bob-code',true),
 ('c3333333-3333-4333-8333-333333333333','Test Carol','test-carol-code',true),
 ('d4444444-4444-4444-8444-444444444444','Test Outsider','test-outsider-code',true);
insert into public.repertoire_sets(id,owner_id,name,invite_code) values('e5555555-5555-4555-8555-555555555555','a1111111-1111-4111-8111-111111111111','Authorization test set','test-invite-code');
insert into public.repertoire_set_members(set_id,user_id) values
 ('e5555555-5555-4555-8555-555555555555','a1111111-1111-4111-8111-111111111111'),
 ('e5555555-5555-4555-8555-555555555555','b2222222-2222-4222-8222-222222222222');
insert into public.repertoire_set_songs(set_id,song_key,title,artist,minutes) values('e5555555-5555-4555-8555-555555555555','test-tune','Test tune','Artist',10);
insert into public.repertoire_friendships(id,requester,recipient) values('f6666666-6666-4666-8666-666666666666','a1111111-1111-4111-8111-111111111111','c3333333-3333-4333-8333-333333333333');
insert into public.repertoire_practice_sessions(id,user_id,practice_day,song_key,title,artist,seconds) values
 ('a7777777-7777-4777-8777-777777777777','a1111111-1111-4111-8111-111111111111',current_date,'test-tune','Test tune','Artist',60),
 ('b8888888-8888-4888-8888-888888888888','b2222222-2222-4222-8222-222222222222',current_date,'test-tune','Test tune','Artist',40),
 ('c9999999-9999-4999-8999-999999999999','c3333333-3333-4333-8333-333333333333',current_date,'test-tune','Test tune','Artist',20);

set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
do $$begin
 if (select count(*) from public.repertoire_practice_sessions)<>2 then raise exception 'FAIL: pending friends or outsiders leaked practice'; end if;
 if (select count(*) from public.repertoire_sets)<>1 then raise exception 'FAIL: member cannot read set'; end if;
 begin
  perform public.repertoire_accept_friend('f6666666-6666-4666-8666-666666666666');
  raise exception 'FAIL: sender accepted own request';
 exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub','d4444444-4444-4444-8444-444444444444',true);
do $$begin
 if exists(select 1 from public.repertoire_sets) or exists(select 1 from public.repertoire_set_members) or exists(select 1 from public.repertoire_set_songs) then raise exception 'FAIL: outsider read private set'; end if;
 if exists(select 1 from public.repertoire_practice_sessions) then raise exception 'FAIL: outsider read private practice'; end if;
 begin
  perform public.repertoire_edit_set('e5555555-5555-4555-8555-555555555555','Attack','[{"song_key":"changed","title":"Changed","artist":"Other","bpm":null,"minutes":5}]');
  raise exception 'FAIL: outsider edited set';
 exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
 perform public.repertoire_join_set('test-invite-code');
 if (select count(*) from public.repertoire_sets)<>1 then raise exception 'FAIL: valid invite did not grant membership'; end if;
end $$;

select set_config('request.jwt.claim.sub','c3333333-3333-4333-8333-333333333333',true);
select public.repertoire_accept_friend('f6666666-6666-4666-8666-666666666666');
do $$begin
 if (select count(*) from public.repertoire_practice_sessions)<>2 then raise exception 'FAIL: accepted friend cannot read totals'; end if;
end $$;
update public.repertoire_profiles set share_practice=false where id=auth.uid();

select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
do $$begin
 if exists(select 1 from public.repertoire_practice_sessions where user_id='c3333333-3333-4333-8333-333333333333') then raise exception 'FAIL: disabled sharing leaked totals'; end if;
end $$;
select public.repertoire_sync_practice('[{"id":"a7777777-7777-4777-8777-777777777777","date":"2026-11-03","songKey":"test-tune","title":"Test tune","artist":"Artist","seconds":120}]');
select public.repertoire_sync_practice('[{"id":"a7777777-7777-4777-8777-777777777777","date":"2026-11-03","songKey":"test-tune","title":"Test tune","artist":"Artist","seconds":80}]');
do $$begin
 if (select seconds from public.repertoire_practice_sessions where id='a7777777-7777-4777-8777-777777777777')<>120 then raise exception 'FAIL: retry duplicated or reduced time'; end if;
 begin
  perform public.repertoire_sync_practice('[{"id":"b8888888-8888-4888-8888-888888888888","date":"2026-11-03","songKey":"test-tune","title":"Test tune","artist":"Artist","seconds":999}]');
  raise exception 'FAIL: edited another user practice';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: friendship consent, set membership, outsider isolation, sharing opt-out, owner-only edits, and idempotent uploads' as authorization_tests;
