create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'follows_follower_id_profiles_fkey'
      and conrelid = 'public.follows'::regclass
  ) then
    alter table public.follows
      add constraint follows_follower_id_profiles_fkey
      foreign key (follower_id) references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'follows_following_id_profiles_fkey'
      and conrelid = 'public.follows'::regclass
  ) then
    alter table public.follows
      add constraint follows_following_id_profiles_fkey
      foreign key (following_id) references public.profiles(id) on delete cascade;
  end if;

end;
$$;

delete from public.follows
where follower_id = following_id;

with duplicate_follows as (
  select
    ctid,
    row_number() over (
      partition by follower_id, following_id
      order by created_at asc, ctid
    ) as duplicate_number
  from public.follows
)
delete from public.follows
where ctid in (
  select ctid
  from duplicate_follows
  where duplicate_number > 1
);

alter table public.follows
  alter column follower_id set not null,
  alter column following_id set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'follows_no_self_follow'
      and conrelid = 'public.follows'::regclass
  ) then
    alter table public.follows
      add constraint follows_no_self_follow check (follower_id <> following_id);
  end if;
end;
$$;

create unique index if not exists follows_follower_following_unique_idx
  on public.follows (follower_id, following_id);
create index if not exists follows_following_created_at_idx
  on public.follows (following_id, created_at desc);
create index if not exists follows_follower_created_at_idx
  on public.follows (follower_id, created_at desc);

alter table public.follows enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'follows'
  loop
    execute format('drop policy %I on public.follows', existing_policy.policyname);
  end loop;
end;
$$;

create policy "Anyone can read follows"
  on public.follows
  for select
  to anon, authenticated
  using (true);

create policy "Users can follow as themselves"
  on public.follows
  for insert
  to authenticated
  with check (
    auth.uid() = follower_id
    and follower_id <> following_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = following_id
        and profiles.is_banned = false
        and profiles.deleted_at is null
    )
  );

create policy "Users can unfollow themselves"
  on public.follows
  for delete
  to authenticated
  using (auth.uid() = follower_id);

revoke insert, update, delete on table public.follows from public, anon, authenticated;
grant select on table public.follows to anon, authenticated;
grant insert, delete on table public.follows to authenticated;

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.follower_id <> new.following_id then
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      is_read,
      created_at
    )
    values (
      new.following_id,
      new.follower_id,
      'follow'::public.notification_type,
      false,
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_follow_created on public.follows;
create trigger notify_follow_created
  after insert on public.follows
  for each row execute function public.notify_on_follow();
