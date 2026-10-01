create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() = old.id
    and old.role <> 'admin'::public.user_role
    and (
      new.role is distinct from old.role
      or new.is_banned is distinct from old.is_banned
      or new.banned_at is distinct from old.banned_at
      or new.banned_reason is distinct from old.banned_reason
      or new.deleted_at is distinct from old.deleted_at
    )
  then
    raise exception 'Profile role and moderation fields can only be changed by an administrator'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();
