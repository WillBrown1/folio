begin;
create table if not exists public.repertoire_live_sessions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 online boolean not null default false,
 running boolean not null default false,
 practice_day date not null,
 song_key text,
 song_title text,
 active_event uuid,
 events jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.repertoire_live_sessions enable row level security;
create policy repertoire_live_read on public.repertoire_live_sessions for select to authenticated using(repertoire_private.can_read_practice(user_id));
revoke all on public.repertoire_live_sessions from anon,authenticated;
grant select on public.repertoire_live_sessions to authenticated;
create or replace function public.repertoire_live_heartbeat(p_device uuid,p_state jsonb)
returns public.repertoire_live_sessions language plpgsql security definer set search_path='' as $$
declare sharing boolean; result public.repertoire_live_sessions; event jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_state is null or jsonb_typeof(p_state)<>'object' or jsonb_typeof(p_state->'events') is distinct from 'array' or jsonb_array_length(p_state->'events')>100 or octet_length(p_state::text)>50000 then raise exception 'Invalid live update'; end if;
 if length(p_state->>'song_key')>500 or length(p_state->>'song_title')>200 then raise exception 'Invalid song'; end if;
 for event in select value from jsonb_array_elements(p_state->'events') loop
  if (event->>'seconds')::numeric is null or (event->>'seconds')::numeric<0 or (event->>'seconds')::numeric>86400 or length(event->>'songKey')>500 then raise exception 'Invalid live time'; end if;
  perform (event->>'id')::uuid; perform (event->>'date')::date;
 end loop;
 select share_practice into sharing from public.repertoire_profiles where id=auth.uid();
 insert into public.repertoire_live_sessions(id,user_id,online,running,practice_day,song_key,song_title,active_event,events)
 values(p_device,auth.uid(),coalesce(sharing,false) and coalesce((p_state->>'online')::boolean,false),coalesce(sharing,false) and coalesce((p_state->>'online')::boolean,false) and coalesce((p_state->>'running')::boolean,false),(p_state->>'practice_day')::date,
 case when sharing then p_state->>'song_key' end,case when sharing then p_state->>'song_title' end,case when sharing then (p_state->>'active_event')::uuid end,case when sharing then p_state->'events' else '[]'::jsonb end)
 on conflict(id) do update set online=excluded.online,running=excluded.running,practice_day=excluded.practice_day,song_key=excluded.song_key,song_title=excluded.song_title,active_event=excluded.active_event,events=excluded.events,updated_at=clock_timestamp()
 where public.repertoire_live_sessions.user_id=auth.uid() returning * into result;
 if result.id is null then raise exception 'Device belongs to another account'; end if;
 return result;
end; $$;
create or replace function public.repertoire_live_snapshot()
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('age_seconds',greatest(0,extract(epoch from now()-l.updated_at)))),'[]'::jsonb)
 from public.repertoire_live_sessions l where updated_at>now()-interval '20 minutes';
$$;
revoke all on function public.repertoire_live_heartbeat(uuid,jsonb),public.repertoire_live_snapshot() from public,anon;
grant execute on function public.repertoire_live_heartbeat(uuid,jsonb),public.repertoire_live_snapshot() to authenticated;
do $$declare table_name text;begin
 foreach table_name in array array['repertoire_live_sessions','repertoire_practice_sessions','repertoire_profiles'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then execute format('alter publication supabase_realtime add table public.%I',table_name);end if;
 end loop;
end $$;
commit;
