begin;
alter table public.repertoire_profiles add column if not exists share_repertoire boolean not null default false;
create or replace function public.repertoire_shared_totals(p_start date default null,p_end date default null,p_keys text[] default null)
returns table(user_id uuid,song_key text,seconds numeric,days bigint)
language sql stable security invoker set search_path='' as $$
 select s.user_id,s.song_key,sum(s.seconds),count(distinct s.practice_day)
 from public.repertoire_practice_sessions s
 where (p_start is null or s.practice_day>=p_start) and (p_end is null or s.practice_day<=p_end) and (p_keys is null or s.song_key=any(p_keys))
 group by s.user_id,s.song_key;
$$;
-- Deliberate projection: never return journal documents, notes, lessons, schedules,
-- email addresses, focus settings, confidence ratings or authentication data.
create or replace function public.repertoire_friend_catalog(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare doc jsonb; allowed boolean; catalog jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 select p_user=auth.uid() or (
  exists(select 1 from public.repertoire_profiles p where p.id=p_user and p.share_practice and p.share_repertoire)
  and exists(select 1 from public.repertoire_friendships f where f.status='accepted' and ((f.requester=auth.uid() and f.recipient=p_user) or (f.recipient=auth.uid() and f.requester=p_user)))
 ) into allowed;
 if not allowed then return jsonb_build_object('full',false,'songs','[]'::jsonb,'logs','{}'::jsonb);end if;
 select document into doc from public.repertoire_journals where user_id=p_user;
 select coalesce(jsonb_agg(jsonb_build_object('id',song->>'id','title',song->>'title','artist',song->>'artist','bpm',song->'bpm')),'[]'::jsonb)
 into catalog from jsonb_array_elements(coalesce(doc->'songs','[]'::jsonb)) song;
 return jsonb_build_object('full',true,'songs',catalog,'logs',coalesce(doc->'logs','{}'::jsonb));
end; $$;
revoke all on function public.repertoire_shared_totals(date,date,text[]),public.repertoire_friend_catalog(uuid) from public,anon;
grant execute on function public.repertoire_shared_totals(date,date,text[]),public.repertoire_friend_catalog(uuid) to authenticated;
commit;
