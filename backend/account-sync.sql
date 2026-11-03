begin;
create table if not exists public.repertoire_journals (
 user_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null check(jsonb_typeof(document)='object' and document->>'version'='1' and jsonb_typeof(document->'songs')='array' and jsonb_array_length(document->'songs')<=1000 and jsonb_typeof(document->'schedule')='array' and jsonb_array_length(document->'schedule')=7 and jsonb_typeof(document->'logs')='object' and octet_length(document::text)<=8388608),
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.repertoire_journals enable row level security;
create policy journal_owner_read on public.repertoire_journals for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.repertoire_journals from anon,authenticated;
grant select on public.repertoire_journals to authenticated;
create table if not exists public.repertoire_journal_writes (
 user_id uuid not null references auth.users(id) on delete cascade,
 mutation uuid not null,
 revision bigint not null,
 primary key(user_id,mutation)
);
alter table public.repertoire_journal_writes enable row level security;
revoke all on public.repertoire_journal_writes from anon,authenticated;
create or replace function public.repertoire_save_journal(p_revision bigint,p_document jsonb,p_mutation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare next_revision bigint;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select revision into next_revision from public.repertoire_journal_writes where user_id=auth.uid() and mutation=p_mutation;
 if found then return jsonb_build_object('saved',true,'revision',next_revision); end if;
 if p_revision=0 then
  insert into public.repertoire_journals(user_id,document) values(auth.uid(),p_document)
  on conflict(user_id) do nothing returning revision into next_revision;
 else
  update public.repertoire_journals set document=p_document,revision=revision+1,updated_at=now()
  where user_id=auth.uid() and revision=p_revision returning revision into next_revision;
 end if;
 if next_revision is not null then insert into public.repertoire_journal_writes(user_id,mutation,revision) values(auth.uid(),p_mutation,next_revision); end if;
 return jsonb_build_object('saved',next_revision is not null,'revision',next_revision);
end; $$;
revoke all on function public.repertoire_save_journal(bigint,jsonb,uuid) from public,anon;
grant execute on function public.repertoire_save_journal(bigint,jsonb,uuid) to authenticated;
commit;
