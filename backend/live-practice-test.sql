-- Transaction-only fixtures: no test users or practice records remain.
begin;
insert into auth.users(id,email) values
('a1111111-1111-4111-8111-111111111111','live-alice@example.invalid'),
('b2222222-2222-4222-8222-222222222222','live-bob@example.invalid'),
('c3333333-3333-4333-8333-333333333333','live-member@example.invalid'),
('d4444444-4444-4444-8444-444444444444','live-outsider@example.invalid');
insert into public.repertoire_profiles(id,display_name,share_practice) values
('a1111111-1111-4111-8111-111111111111','Live Alice',true),
('b2222222-2222-4222-8222-222222222222','Live Bob',true),
('c3333333-3333-4333-8333-333333333333','Live Member',true),
('d4444444-4444-4444-8444-444444444444','Live Outsider',true);
insert into public.repertoire_friendships(requester,recipient,status) values('a1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222','accepted');
insert into public.repertoire_sets(id,owner_id,name) values('e5555555-5555-4555-8555-555555555555','a1111111-1111-4111-8111-111111111111','Live test');
insert into public.repertoire_set_members(set_id,user_id) values
('e5555555-5555-4555-8555-555555555555','a1111111-1111-4111-8111-111111111111'),
('e5555555-5555-4555-8555-555555555555','c3333333-3333-4333-8333-333333333333');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select public.repertoire_live_heartbeat('f6666666-6666-4666-8666-666666666666','{"online":true,"running":true,"practice_day":"2026-11-03","song_key":"test-tune","song_title":"Test Tune","events":[]}');
do $$begin
 if jsonb_array_length(public.repertoire_live_snapshot())<>1 then raise exception 'FAIL: own live state unavailable';end if;
 begin update public.repertoire_live_sessions set user_id='b2222222-2222-4222-8222-222222222222';raise exception 'FAIL: direct live write allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$begin
 if jsonb_array_length(public.repertoire_live_snapshot())<>1 then raise exception 'FAIL: accepted friend cannot read live state';end if;
 begin perform public.repertoire_live_heartbeat('f6666666-6666-4666-8666-666666666666','{"online":true,"practice_day":"2026-11-03","events":[]}');raise exception 'FAIL: device identity spoofed';exception when raise_exception then if sqlerrm<>'Device belongs to another account' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','c3333333-3333-4333-8333-333333333333',true);
do $$begin if jsonb_array_length(public.repertoire_live_snapshot())<>1 then raise exception 'FAIL: set member cannot read live state';end if;end $$;
select set_config('request.jwt.claim.sub','d4444444-4444-4444-8444-444444444444',true);
do $$begin if jsonb_array_length(public.repertoire_live_snapshot())<>0 then raise exception 'FAIL: outsider sees live state';end if;end $$;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
update public.repertoire_profiles set share_practice=false where id=auth.uid();
do $$declare result public.repertoire_live_sessions;begin
 result:=public.repertoire_live_heartbeat('f6666666-6666-4666-8666-666666666666','{"online":true,"running":true,"practice_day":"2026-11-03","song_title":"Private","events":[]}');
 if result.online or result.running or result.song_title is not null or result.events<>'[]'::jsonb then raise exception 'FAIL: sharing opt-out ignored';end if;
end $$;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$begin if jsonb_array_length(public.repertoire_live_snapshot())<>0 then raise exception 'FAIL: opted-out live state leaked';end if;end $$;
reset role;
update public.repertoire_profiles set share_practice=true where id='a1111111-1111-4111-8111-111111111111';
update public.repertoire_friendships set status='pending' where requester='a1111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$begin if jsonb_array_length(public.repertoire_live_snapshot())<>0 then raise exception 'FAIL: pending friend sees live state';end if;end $$;
set local role anon;
do $$begin
 begin perform public.repertoire_live_snapshot();raise exception 'FAIL: anonymous live read';exception when insufficient_privilege then null;end;
 begin perform public.repertoire_live_heartbeat('f6666666-6666-4666-8666-666666666666','{}');raise exception 'FAIL: anonymous heartbeat';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: live owner identity, accepted friends, shared sets, outsider denial, sharing opt-out, pending friend denial, anonymous denial' as result;
