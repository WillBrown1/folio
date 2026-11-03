-- Repertoire shared practice. Apply once to the application's Supabase project.
begin;
grant usage on schema public to authenticated;
create schema if not exists repertoire_private;
revoke all on schema repertoire_private from public;
grant usage on schema repertoire_private to authenticated;

create table if not exists public.repertoire_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(trim(display_name)) between 1 and 60),
 friend_code text not null unique default substr(replace(gen_random_uuid()::text,'-',''),1,16),
 share_practice boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.repertoire_friendships (
 id uuid primary key default gen_random_uuid(),
 requester uuid not null references public.repertoire_profiles(id) on delete cascade,
 recipient uuid not null references public.repertoire_profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(),
 check(requester<>recipient)
);
create unique index if not exists repertoire_friend_pair on public.repertoire_friendships(least(requester,recipient),greatest(requester,recipient));
create table if not exists public.repertoire_sets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.repertoire_profiles(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 100),
 invite_code text not null unique default replace(gen_random_uuid()::text,'-',''),
 created_at timestamptz not null default now()
);
create table if not exists public.repertoire_set_members (
 set_id uuid not null references public.repertoire_sets(id) on delete cascade,
 user_id uuid not null references public.repertoire_profiles(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(set_id,user_id)
);
create index if not exists repertoire_members_user on public.repertoire_set_members(user_id,set_id);
create table if not exists public.repertoire_set_songs (
 set_id uuid not null references public.repertoire_sets(id) on delete cascade,
 song_key text not null check(char_length(song_key) between 3 and 500),
 title text not null check(char_length(trim(title)) between 1 and 200),
 artist text not null check(char_length(artist)<=200),
 bpm integer check(bpm between 20 and 300),
 minutes integer not null default 10 check(minutes between 1 and 180),
 position integer not null default 0,
 primary key(set_id,song_key)
);
create table if not exists public.repertoire_practice_sessions (
 id uuid primary key,
 user_id uuid not null references public.repertoire_profiles(id) on delete cascade,
 practice_day date not null,
 song_key text not null check(char_length(song_key) between 3 and 500),
 title text not null check(char_length(trim(title)) between 1 and 200),
 artist text not null check(char_length(artist)<=200),
 seconds numeric(12,3) not null check(seconds between 0 and 86400),
 updated_at timestamptz not null default now()
);
create index if not exists repertoire_practice_daily on public.repertoire_practice_sessions(user_id,practice_day,song_key);

alter table public.repertoire_profiles enable row level security;
alter table public.repertoire_friendships enable row level security;
alter table public.repertoire_sets enable row level security;
alter table public.repertoire_set_members enable row level security;
alter table public.repertoire_set_songs enable row level security;
alter table public.repertoire_practice_sessions enable row level security;

-- Definer functions are private. Every read checks the authenticated caller.
create or replace function repertoire_private.is_member(p_set uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_user=auth.uid() and exists(select 1 from public.repertoire_set_members where set_id=p_set and user_id=p_user);
$$;
create or replace function repertoire_private.can_read_person(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (p_user=auth.uid() or exists(
 select 1 from public.repertoire_friendships f where (f.requester=auth.uid() and f.recipient=p_user) or (f.recipient=auth.uid() and f.requester=p_user)
 ) or exists(select 1 from public.repertoire_set_members a join public.repertoire_set_members b on a.set_id=b.set_id where a.user_id=auth.uid() and b.user_id=p_user));
$$;
create or replace function repertoire_private.can_read_practice(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (p_user=auth.uid() or (
 exists(select 1 from public.repertoire_profiles where id=p_user and share_practice) and (
 exists(select 1 from public.repertoire_friendships f where f.status='accepted' and ((f.requester=auth.uid() and f.recipient=p_user) or (f.recipient=auth.uid() and f.requester=p_user)))
 or exists(select 1 from public.repertoire_set_members a join public.repertoire_set_members b on a.set_id=b.set_id where a.user_id=auth.uid() and b.user_id=p_user))));
$$;

create policy repertoire_profile_read on public.repertoire_profiles for select to authenticated using(repertoire_private.can_read_person(id));
create policy repertoire_profile_insert on public.repertoire_profiles for insert to authenticated with check(id=auth.uid());
create policy repertoire_profile_update on public.repertoire_profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy repertoire_friend_read on public.repertoire_friendships for select to authenticated using(auth.uid() in(requester,recipient));
create policy repertoire_friend_delete on public.repertoire_friendships for delete to authenticated using(auth.uid() in(requester,recipient));
create policy repertoire_set_read on public.repertoire_sets for select to authenticated using(repertoire_private.is_member(id,auth.uid()));
create policy repertoire_set_delete on public.repertoire_sets for delete to authenticated using(owner_id=auth.uid());
create policy repertoire_member_read on public.repertoire_set_members for select to authenticated using(repertoire_private.is_member(set_id,auth.uid()));
create policy repertoire_song_read on public.repertoire_set_songs for select to authenticated using(repertoire_private.is_member(set_id,auth.uid()));
create policy repertoire_song_insert on public.repertoire_set_songs for insert to authenticated with check(exists(select 1 from public.repertoire_sets where id=set_id and owner_id=auth.uid()));
create policy repertoire_song_update on public.repertoire_set_songs for update to authenticated using(exists(select 1 from public.repertoire_sets where id=set_id and owner_id=auth.uid())) with check(exists(select 1 from public.repertoire_sets where id=set_id and owner_id=auth.uid()));
create policy repertoire_song_delete on public.repertoire_set_songs for delete to authenticated using(exists(select 1 from public.repertoire_sets where id=set_id and owner_id=auth.uid()));
create policy repertoire_time_read on public.repertoire_practice_sessions for select to authenticated using(repertoire_private.can_read_practice(user_id));
create policy repertoire_time_insert on public.repertoire_practice_sessions for insert to authenticated with check(user_id=auth.uid());
create policy repertoire_time_update on public.repertoire_practice_sessions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function repertoire_private.request_friend(p_code text)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select id into target from public.repertoire_profiles where friend_code=lower(trim(p_code));
 if target is null then raise exception 'Friend code not found'; end if;
 if target=auth.uid() then raise exception 'This is your own friend code'; end if;
 insert into public.repertoire_friendships(requester,recipient) values(auth.uid(),target) on conflict do nothing;
end; $$;
create or replace function public.repertoire_request_friend(p_code text) returns void language sql security invoker set search_path='' as $$select repertoire_private.request_friend(p_code);$$;
create or replace function repertoire_private.accept_friend(p_request uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.repertoire_friendships set status='accepted' where id=p_request and recipient=auth.uid() and status='pending';
 if not found then raise exception 'Friend request not found'; end if;
end; $$;
create or replace function public.repertoire_accept_friend(p_request uuid) returns void language sql security invoker set search_path='' as $$select repertoire_private.accept_friend(p_request);$$;

create or replace function repertoire_private.create_set(p_name text,p_songs jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare created uuid; item jsonb; n integer:=0;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_songs is null or jsonb_typeof(p_songs)<>'array' or jsonb_array_length(p_songs) not between 1 and 100 then raise exception 'Choose between 1 and 100 songs'; end if;
 insert into public.repertoire_sets(owner_id,name) values(auth.uid(),trim(p_name)) returning id into created;
 insert into public.repertoire_set_members(set_id,user_id) values(created,auth.uid());
 for item in select value from jsonb_array_elements(p_songs) loop
 insert into public.repertoire_set_songs(set_id,song_key,title,artist,bpm,minutes,position) values(created,item->>'song_key',item->>'title',coalesce(item->>'artist',''),(item->>'bpm')::integer,(item->>'minutes')::integer,n);
 n:=n+1;
 end loop;
 return created;
end; $$;
create or replace function public.repertoire_create_set(p_name text,p_songs jsonb) returns uuid language sql security invoker set search_path='' as $$select repertoire_private.create_set(p_name,p_songs);$$;
create or replace function repertoire_private.edit_set(p_set uuid,p_name text,p_songs jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; n integer:=0;
begin
 if not exists(select 1 from public.repertoire_sets where id=p_set and owner_id=auth.uid()) then raise exception 'Only the owner can edit this set'; end if;
 if p_songs is null or jsonb_typeof(p_songs)<>'array' or jsonb_array_length(p_songs) not between 1 and 100 then raise exception 'Choose between 1 and 100 songs'; end if;
 update public.repertoire_sets set name=trim(p_name) where id=p_set;
 delete from public.repertoire_set_songs where set_id=p_set;
 for item in select value from jsonb_array_elements(p_songs) loop
 insert into public.repertoire_set_songs(set_id,song_key,title,artist,bpm,minutes,position) values(p_set,item->>'song_key',item->>'title',coalesce(item->>'artist',''),(item->>'bpm')::integer,(item->>'minutes')::integer,n);
 n:=n+1;
 end loop;
end; $$;
create or replace function public.repertoire_edit_set(p_set uuid,p_name text,p_songs jsonb) returns void language sql security invoker set search_path='' as $$select repertoire_private.edit_set(p_set,p_name,p_songs);$$;
create or replace function repertoire_private.join_set(p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select id into target from public.repertoire_sets where invite_code=trim(p_code);
 if target is null then raise exception 'Set invitation not found'; end if;
 insert into public.repertoire_set_members(set_id,user_id) values(target,auth.uid()) on conflict do nothing;
 return target;
end; $$;
create or replace function public.repertoire_join_set(p_code text) returns uuid language sql security invoker set search_path='' as $$select repertoire_private.join_set(p_code);$$;
create or replace function repertoire_private.leave_set(p_set uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.repertoire_sets where id=p_set and owner_id=auth.uid()) then raise exception 'The owner must delete the set instead'; end if;
 delete from public.repertoire_set_members where set_id=p_set and user_id=auth.uid();
end; $$;
create or replace function public.repertoire_leave_set(p_set uuid) returns void language sql security invoker set search_path='' as $$select repertoire_private.leave_set(p_set);$$;

-- Idempotent cumulative session uploads: retries never add duplicate seconds.
create or replace function public.repertoire_sync_practice(p_records jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_records is null or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)>100 then raise exception 'Invalid upload'; end if;
 for item in select value from jsonb_array_elements(p_records) loop
 insert into public.repertoire_practice_sessions(id,user_id,practice_day,song_key,title,artist,seconds)
 values((item->>'id')::uuid,auth.uid(),(item->>'date')::date,item->>'songKey',item->>'title',item->>'artist',(item->>'seconds')::numeric)
 on conflict(id) do update set seconds=greatest(public.repertoire_practice_sessions.seconds,excluded.seconds),updated_at=now();
 end loop;
end; $$;

revoke all on public.repertoire_profiles,public.repertoire_friendships,public.repertoire_sets,public.repertoire_set_members,public.repertoire_set_songs,public.repertoire_practice_sessions from anon;
grant select,insert,update on public.repertoire_profiles to authenticated;
grant select,delete on public.repertoire_friendships to authenticated;
grant select,delete on public.repertoire_sets to authenticated;
grant select on public.repertoire_set_members to authenticated;
grant select,insert,update,delete on public.repertoire_set_songs to authenticated;
grant select,insert,update on public.repertoire_practice_sessions to authenticated;
revoke execute on all functions in schema repertoire_private from public,anon;
grant execute on all functions in schema repertoire_private to authenticated;
revoke execute on function public.repertoire_request_friend(text),public.repertoire_accept_friend(uuid),public.repertoire_create_set(text,jsonb),public.repertoire_edit_set(uuid,text,jsonb),public.repertoire_join_set(text),public.repertoire_leave_set(uuid),public.repertoire_sync_practice(jsonb) from public,anon;
grant execute on function public.repertoire_request_friend(text),public.repertoire_accept_friend(uuid),public.repertoire_create_set(text,jsonb),public.repertoire_edit_set(uuid,text,jsonb),public.repertoire_join_set(text),public.repertoire_leave_set(uuid),public.repertoire_sync_practice(jsonb) to authenticated;
commit;

