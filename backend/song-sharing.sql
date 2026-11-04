begin;
create or replace function repertoire_private.song_friends(a uuid,b uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() in(a,b) and a<>b and exists(select 1 from public.repertoire_friendships f where f.status='accepted' and ((f.requester=a and f.recipient=b) or (f.requester=b and f.recipient=a)));
$$;
revoke all on function repertoire_private.song_friends(uuid,uuid) from public,anon;
grant execute on function repertoire_private.song_friends(uuid,uuid) to authenticated;
create table public.repertoire_song_shares(
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references public.repertoire_profiles(id) on delete cascade,
 recipient uuid not null references public.repertoire_profiles(id) on delete cascade,
 song_key text not null check(char_length(song_key) between 3 and 500),
 title text not null check(char_length(trim(title)) between 1 and 200),
 artist text not null check(char_length(artist)<=200),
 bpm integer check(bpm between 20 and 300),
 minutes integer not null check(minutes between 1 and 180),
 notes text not null default '' check(char_length(notes)<=10000),
 lesson text not null default '' check(char_length(lesson)<=1000),
 updated_at timestamptz not null default now(),
 unique(sender,recipient,song_key),check(sender<>recipient)
);
create index repertoire_song_shares_recipient on public.repertoire_song_shares(recipient,updated_at desc);
alter table public.repertoire_song_shares enable row level security;
create policy song_share_read on public.repertoire_song_shares for select to authenticated using(repertoire_private.song_friends(sender,recipient));
create policy song_share_insert on public.repertoire_song_shares for insert to authenticated with check(sender=auth.uid() and repertoire_private.song_friends(sender,recipient));
create policy song_share_update on public.repertoire_song_shares for update to authenticated using(sender=auth.uid() and repertoire_private.song_friends(sender,recipient)) with check(sender=auth.uid() and repertoire_private.song_friends(sender,recipient));
create policy song_share_delete on public.repertoire_song_shares for delete to authenticated using(sender=auth.uid());
revoke all on public.repertoire_song_shares from anon,authenticated;
grant select,insert,delete on public.repertoire_song_shares to authenticated;
grant update(sender,recipient,song_key,title,artist,bpm,minutes,notes,lesson,updated_at) on public.repertoire_song_shares to authenticated;
commit;
