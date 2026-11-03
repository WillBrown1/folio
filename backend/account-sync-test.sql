-- All fixtures and writes are rolled back. No emails are sent.
begin;
insert into auth.users(id,email) values
('a1111111-1111-4111-8111-111111111111','sync-alice@example.invalid'),
('b2222222-2222-4222-8222-222222222222','sync-bob@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
do $$declare result jsonb; doc jsonb:='{"version":1,"songs":[],"schedule":[[],[],[],[],[],[],[]],"logs":{},"scheduleEnabled":false}'; begin
 result:=public.repertoire_save_journal(0,doc,'11111111-1111-4111-8111-111111111111');
 if not (result->>'saved')::boolean or (result->>'revision')::int<>1 then raise exception 'FAIL: first save'; end if;
 result:=public.repertoire_save_journal(0,doc,'11111111-1111-4111-8111-111111111111');
 if not (result->>'saved')::boolean or (result->>'revision')::int<>1 then raise exception 'FAIL: retry not idempotent'; end if;
 result:=public.repertoire_save_journal(0,doc,'22222222-2222-4222-8222-222222222222');
 if (result->>'saved')::boolean then raise exception 'FAIL: stale device overwrote journal'; end if;
 result:=public.repertoire_save_journal(1,doc||'{"scheduleEnabled":true}','33333333-3333-4333-8333-333333333333');
 if (result->>'revision')::int<>2 then raise exception 'FAIL: revision update'; end if;
 if (select count(*) from public.repertoire_journals)<>1 then raise exception 'FAIL: own journal unreadable'; end if;
 begin
  update public.repertoire_journals set revision=999;
  raise exception 'FAIL: direct update bypassed concurrency control';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$declare result jsonb; begin
 if exists(select 1 from public.repertoire_journals) then raise exception 'FAIL: another account can read private journal'; end if;
 result:=public.repertoire_save_journal(2,'{"version":1,"songs":[],"schedule":[[],[],[],[],[],[],[]],"logs":{}}','44444444-4444-4444-8444-444444444444');
 if (result->>'saved')::boolean then raise exception 'FAIL: another account changed journal'; end if;
 if exists(select 1 from public.repertoire_journals) then raise exception 'FAIL: other journal leaked'; end if;
end $$;
set local role anon;
do $$begin
 begin perform count(*) from public.repertoire_journals;raise exception 'FAIL: anonymous journal access';exception when insufficient_privilege then null;end;
 begin perform public.repertoire_save_journal(0,'{}','55555555-5555-4555-8555-555555555555');raise exception 'FAIL: anonymous save';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: private journal access, stale-write protection, idempotent retry, account isolation, anonymous denial' as result;
