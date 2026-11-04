begin;
insert into auth.users(id,email) values
('a1111111-1111-4111-8111-111111111111','history-alice@example.invalid'),('b2222222-2222-4222-8222-222222222222','history-bob@example.invalid'),('c3333333-3333-4333-8333-333333333333','history-member@example.invalid'),('d4444444-4444-4444-8444-444444444444','history-outsider@example.invalid');
insert into public.repertoire_profiles(id,display_name,share_practice,share_repertoire) values
('a1111111-1111-4111-8111-111111111111','History Alice',true,true),('b2222222-2222-4222-8222-222222222222','History Bob',true,false),('c3333333-3333-4333-8333-333333333333','History Member',true,false),('d4444444-4444-4444-8444-444444444444','History Outsider',true,false);
insert into public.repertoire_friendships(requester,recipient,status) values('a1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222','accepted');
insert into public.repertoire_sets(id,owner_id,name) values('e5555555-5555-4555-8555-555555555555','a1111111-1111-4111-8111-111111111111','History test');
insert into public.repertoire_set_members(set_id,user_id) values('e5555555-5555-4555-8555-555555555555','a1111111-1111-4111-8111-111111111111'),('e5555555-5555-4555-8555-555555555555','c3333333-3333-4333-8333-333333333333');
insert into public.repertoire_journals(user_id,document) values('a1111111-1111-4111-8111-111111111111','{"version":1,"songs":[{"id":"song-a","title":"Tune","artist":"Artist","bpm":100,"notes":"SECRET-NOTES","lesson":"SECRET-LESSON","rating":4,"stage":"learning"},{"id":"song-b","title":"Unplayed","artist":"Artist","bpm":null}],"logs":{"2026-11-03":{"song-a":60}},"schedule":[[],[],[],[],[],[],[]]}');
insert into public.repertoire_practice_sessions(id,user_id,practice_day,song_key,title,artist,seconds) values
('f6666666-6666-4666-8666-666666666666','a1111111-1111-4111-8111-111111111111','2026-11-03','tune-artist','Tune','Artist',60),('f7777777-7777-4777-8777-777777777777','a1111111-1111-4111-8111-111111111111','2026-11-04','tune-artist','Tune','Artist',90);
set local role authenticated;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$declare result jsonb; begin
 result:=public.repertoire_friend_catalog('a1111111-1111-4111-8111-111111111111');
 if not (result->>'full')::boolean or jsonb_array_length(result->'songs')<>2 or result#>>'{logs,2026-11-03,song-a}'<>'60' then raise exception 'FAIL: friend projection missing repertoire or history';end if;
 if result::text like '%SECRET%' or result::text like '%rating%' or result::text like '%stage%' or result::text like '%schedule%' then raise exception 'FAIL: private journal fields leaked';end if;
 if exists(select 1 from public.repertoire_journals) then raise exception 'FAIL: friend can read raw journal';end if;
 if (select sum(seconds) from public.repertoire_shared_totals(null,null,null))<>150 then raise exception 'FAIL: all-time shared total';end if;
 if (select sum(seconds) from public.repertoire_shared_totals('2026-11-04','2026-11-04',array['tune-artist']))<>90 then raise exception 'FAIL: date-filtered total';end if;
end $$;
select set_config('request.jwt.claim.sub','c3333333-3333-4333-8333-333333333333',true);
do $$begin
 if (public.repertoire_friend_catalog('a1111111-1111-4111-8111-111111111111')->>'full')::boolean then raise exception 'FAIL: set-only member sees full repertoire';end if;
 if (select sum(seconds) from public.repertoire_shared_totals(null,null,null))<>150 then raise exception 'FAIL: set member cannot read shared totals';end if;
end $$;
select set_config('request.jwt.claim.sub','d4444444-4444-4444-8444-444444444444',true);
do $$begin if (public.repertoire_friend_catalog('a1111111-1111-4111-8111-111111111111')->>'full')::boolean or exists(select 1 from public.repertoire_shared_totals(null,null,null)) then raise exception 'FAIL: outsider sees history';end if;end $$;
reset role;
update public.repertoire_profiles set share_repertoire=false where id='a1111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$begin if (public.repertoire_friend_catalog('a1111111-1111-4111-8111-111111111111')->>'full')::boolean then raise exception 'FAIL: repertoire opt-out ignored';end if;end $$;
reset role;
update public.repertoire_profiles set share_repertoire=true,share_practice=false where id='a1111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$begin if (public.repertoire_friend_catalog('a1111111-1111-4111-8111-111111111111')->>'full')::boolean or exists(select 1 from public.repertoire_shared_totals(null,null,null)) then raise exception 'FAIL: practice opt-out ignored';end if;end $$;
reset role;
update public.repertoire_profiles set share_practice=true where id='a1111111-1111-4111-8111-111111111111';
update public.repertoire_friendships set status='pending' where requester='a1111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$begin if (public.repertoire_friend_catalog('a1111111-1111-4111-8111-111111111111')->>'full')::boolean then raise exception 'FAIL: pending friend sees repertoire';end if;end $$;
set local role anon;
do $$begin begin perform public.repertoire_friend_catalog('a1111111-1111-4111-8111-111111111111');raise exception 'FAIL: anonymous projection';exception when insufficient_privilege then null;end;begin perform public.repertoire_shared_totals(null,null,null);raise exception 'FAIL: anonymous totals';exception when insufficient_privilege then null;end;end $$;
reset role;
rollback;
select 'PASS: multi-day totals, accepted-friend consent, private field exclusion, raw-journal denial, set-only limits, both sharing opt-outs, pending and anonymous denial' as result;
