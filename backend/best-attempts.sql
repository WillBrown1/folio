begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('repertoire-attempts','repertoire-attempts',false,20971520,array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav','audio/x-wav','audio/x-m4a','audio/aac'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table if not exists public.repertoire_attempts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.repertoire_profiles(id) on delete cascade,
 song_id text not null check(char_length(song_id) between 1 and 1000),
 song_key text not null check(char_length(song_key) between 3 and 500),
 title text not null check(char_length(trim(title)) between 1 and 200),
 artist text not null check(char_length(artist)<=200),
 object_path text not null unique,
 mime_type text not null check(mime_type in('audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav','audio/x-wav','audio/x-m4a','audio/aac')),
 size_bytes integer not null check(size_bytes between 1 and 20971520),
 duration_seconds numeric check(duration_seconds>0 and duration_seconds<=600),
 shared boolean not null default false,
 updated_at timestamptz not null default now(),
 unique(user_id,song_id),
 check(split_part(object_path,'/',1)=user_id::text)
);
alter table public.repertoire_attempts enable row level security;
create or replace function repertoire_private.can_read_attempt(p_user uuid,p_shared boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (p_user=auth.uid() or (p_shared and exists(select 1 from public.repertoire_friendships f where f.status='accepted' and ((f.requester=auth.uid() and f.recipient=p_user) or (f.recipient=auth.uid() and f.requester=p_user)))));
$$;
revoke all on function repertoire_private.can_read_attempt(uuid,boolean) from public,anon;
grant execute on function repertoire_private.can_read_attempt(uuid,boolean) to authenticated;
create policy repertoire_attempt_read on public.repertoire_attempts for select to authenticated using(repertoire_private.can_read_attempt(user_id,shared));
create policy repertoire_attempt_share on public.repertoire_attempts for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy repertoire_attempt_delete on public.repertoire_attempts for delete to authenticated using(user_id=auth.uid());
revoke all on public.repertoire_attempts from anon,authenticated;
grant select,delete on public.repertoire_attempts to authenticated;
grant update(shared,title,artist,song_key) on public.repertoire_attempts to authenticated;
create policy repertoire_audio_upload on storage.objects for insert to authenticated with check(bucket_id='repertoire-attempts' and (storage.foldername(name))[1]=auth.uid()::text and array_length(storage.foldername(name),1)=1 and storage.filename(name)~'^[0-9a-f-]{36}\.(webm|m4a|ogg|mp3|wav|aac)$');
create policy repertoire_audio_read on storage.objects for select to authenticated using(bucket_id='repertoire-attempts' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.repertoire_attempts a where a.object_path=name and repertoire_private.can_read_attempt(a.user_id,a.shared))));
create policy repertoire_audio_delete on storage.objects for delete to authenticated using(bucket_id='repertoire-attempts' and (storage.foldername(name))[1]=auth.uid()::text);
create or replace function public.repertoire_save_attempt(p_song_id text,p_song_key text,p_title text,p_artist text,p_path text,p_mime text,p_bytes integer,p_duration numeric,p_shared boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous text; result public.repertoire_attempts;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if split_part(p_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='repertoire-attempts' and name=p_path) then raise exception 'Upload your audio first';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_song_id,0));
 select object_path into previous from public.repertoire_attempts where user_id=auth.uid() and song_id=p_song_id;
 insert into public.repertoire_attempts(user_id,song_id,song_key,title,artist,object_path,mime_type,size_bytes,duration_seconds,shared)
 values(auth.uid(),p_song_id,p_song_key,p_title,p_artist,p_path,p_mime,p_bytes,p_duration,coalesce(p_shared,false))
 on conflict(user_id,song_id) do update set song_key=excluded.song_key,title=excluded.title,artist=excluded.artist,object_path=excluded.object_path,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,duration_seconds=excluded.duration_seconds,shared=excluded.shared,updated_at=clock_timestamp()
 returning * into result;
 return jsonb_build_object('attempt',to_jsonb(result),'previous_path',previous);
end;$$;
revoke all on function public.repertoire_save_attempt(text,text,text,text,text,text,integer,numeric,boolean) from public,anon;
grant execute on function public.repertoire_save_attempt(text,text,text,text,text,text,integer,numeric,boolean) to authenticated;
commit;
