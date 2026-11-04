begin;
insert into auth.users(id,email) values('a1111111-1111-4111-8111-111111111111','share-alice@example.invalid'),('b2222222-2222-4222-8222-222222222222','share-bob@example.invalid'),('c3333333-3333-4333-8333-333333333333','share-member@example.invalid'),('d4444444-4444-4444-8444-444444444444','share-outsider@example.invalid');
insert into public.repertoire_profiles(id,display_name) values('a1111111-1111-4111-8111-111111111111','Share Alice'),('b2222222-2222-4222-8222-222222222222','Share Bob'),('c3333333-3333-4333-8333-333333333333','Share Member'),('d4444444-4444-4444-8444-444444444444','Share Outsider');
insert into public.repertoire_friendships(requester,recipient,status) values('a1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222','accepted');
insert into public.repertoire_sets(id,owner_id,name) values('e5555555-5555-4555-8555-555555555555','a1111111-1111-4111-8111-111111111111','Share test');
insert into public.repertoire_set_members(set_id,user_id) values('e5555555-5555-4555-8555-555555555555','a1111111-1111-4111-8111-111111111111'),('e5555555-5555-4555-8555-555555555555','c3333333-3333-4333-8333-333333333333');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
insert into public.repertoire_song_shares(sender,recipient,song_key,title,artist,bpm,minutes,notes,lesson)
 values(auth.uid(),'b2222222-2222-4222-8222-222222222222','tune-artist','Tune','Artist',100,10,'Shared notes','https://www.youtube.com/watch?v=mEn2SEwZKNE');
-- Exercise the same upsert column permissions as the browser, including identity columns.
insert into public.repertoire_song_shares(sender,recipient,song_key,title,artist,bpm,minutes,notes,lesson,updated_at)
 values(auth.uid(),'b2222222-2222-4222-8222-222222222222','tune-artist','Tune','Artist',100,10,'Updated notes','https://www.youtube.com/watch?v=mEn2SEwZKNE',now())
 on conflict(sender,recipient,song_key) do update set sender=excluded.sender,recipient=excluded.recipient,song_key=excluded.song_key,title=excluded.title,artist=excluded.artist,bpm=excluded.bpm,minutes=excluded.minutes,notes=excluded.notes,lesson=excluded.lesson,updated_at=excluded.updated_at;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$declare n integer;begin
 if (select count(*) from public.repertoire_song_shares where notes='Updated notes' and lesson like '%mEn2SEwZKNE')<>1 then raise exception 'FAIL: friend did not receive notes and lesson';end if;
 update public.repertoire_song_shares set notes='Tampered' where sender<>auth.uid();get diagnostics n=row_count;if n<>0 then raise exception 'FAIL: recipient can change sender snapshot';end if;
 begin insert into public.repertoire_song_shares(sender,recipient,song_key,title,artist,minutes) values('a1111111-1111-4111-8111-111111111111',auth.uid(),'spoof-artist','Spoof','Artist',10);raise exception 'FAIL: spoofed sender';exception when insufficient_privilege then null;end;
end $$;
insert into public.repertoire_song_shares(sender,recipient,song_key,title,artist,minutes,notes) values(auth.uid(),'a1111111-1111-4111-8111-111111111111','reply-artist','Reply','Artist',5,'Notes back');
select set_config('request.jwt.claim.sub','c3333333-3333-4333-8333-333333333333',true);
do $$begin
 if exists(select 1 from public.repertoire_song_shares) then raise exception 'FAIL: set-only member sees direct shares';end if;
 begin insert into public.repertoire_song_shares(sender,recipient,song_key,title,artist,minutes) values(auth.uid(),'a1111111-1111-4111-8111-111111111111','tune-artist','Tune','Artist',10);raise exception 'FAIL: share to nonfriend';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','d4444444-4444-4444-8444-444444444444',true);
do $$begin if exists(select 1 from public.repertoire_song_shares) then raise exception 'FAIL: outsider sees direct shares';end if;end $$;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
do $$begin if (select count(*) from public.repertoire_song_shares)<>2 then raise exception 'FAIL: two-way sharing';end if;end $$;
delete from public.repertoire_friendships where requester=auth.uid();
do $$begin if exists(select 1 from public.repertoire_song_shares) then raise exception 'FAIL: removed friend retains access';end if;end $$;
set local role anon;
do $$begin begin perform count(*) from public.repertoire_song_shares;raise exception 'FAIL: anonymous share access';exception when insufficient_privilege then null;end;end $$;
rollback;
select 'PASS: bidirectional song sharing, full payload upsert, recipient read-only, sender spoof denial, set-only and outsider denial, friend removal and anonymous denial' as result;
