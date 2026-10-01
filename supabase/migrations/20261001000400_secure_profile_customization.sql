do $$
begin
  if exists (
    select lower(username)
    from public.profiles
    where username is not null
    group by lower(username)
    having count(*) > 1
  ) then
    raise exception
      'Cannot add case-insensitive username uniqueness: duplicate usernames exist. Resolve duplicate profile usernames, then rerun this migration.';
  end if;
end;
$$;

create unique index if not exists profiles_username_lower_unique_idx
  on public.profiles (lower(username))
  where username is not null;
