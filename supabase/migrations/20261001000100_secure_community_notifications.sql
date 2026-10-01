drop policy if exists "System / authenticated can insert notifications"
on public.notifications;

revoke insert on table public.notifications from anon, authenticated;

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

create or replace function public.notify_on_reaction()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  recipient_id uuid;
  event_type public.notification_type;
begin
  if new.comment_id is not null then
    select comments.author_id
      into recipient_id
      from public.comments
      where comments.id = new.comment_id
        and comments.deleted_at is null;
    event_type := 'reaction_comment'::public.notification_type;
  else
    select posts.author_id
      into recipient_id
      from public.posts
      where posts.id = new.post_id
        and posts.deleted_at is null;
    event_type := 'reaction_post'::public.notification_type;
  end if;

  if recipient_id is not null and recipient_id <> new.user_id then
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      post_id,
      comment_id,
      is_read,
      created_at
    )
    values (
      recipient_id,
      new.user_id,
      event_type,
      new.post_id,
      new.comment_id,
      false,
      now()
    );
  end if;

  return new;
end;
$$;

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  recipient_id uuid;
  event_type public.notification_type;
begin
  if new.parent_id is not null then
    select comments.author_id
      into recipient_id
      from public.comments
      where comments.id = new.parent_id
        and comments.deleted_at is null;
    event_type := 'reply'::public.notification_type;
  else
    select posts.author_id
      into recipient_id
      from public.posts
      where posts.id = new.post_id
        and posts.deleted_at is null;
    event_type := 'comment'::public.notification_type;
  end if;

  if recipient_id is not null and recipient_id <> new.author_id then
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      post_id,
      comment_id,
      is_read,
      created_at
    )
    values (
      recipient_id,
      new.author_id,
      event_type,
      new.post_id,
      new.id,
      false,
      now()
    );
  end if;

  return new;
end;
$$;

create or replace function public.notify_on_report()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  administrator_id uuid;
begin
  for administrator_id in
    select profiles.id
      from public.profiles
      where profiles.role = 'admin'::public.user_role
        and profiles.is_banned = false
        and profiles.deleted_at is null
        and profiles.id <> new.reporter_id
  loop
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      post_id,
      comment_id,
      is_read,
      created_at
    )
    values (
      administrator_id,
      new.reporter_id,
      'report'::public.notification_type,
      new.post_id,
      new.comment_id,
      false,
      now()
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_follow_created on public.follows;
create trigger notify_follow_created
  after insert on public.follows
  for each row execute function public.notify_on_follow();

drop trigger if exists notify_reaction_created on public.reactions;
create trigger notify_reaction_created
  after insert on public.reactions
  for each row execute function public.notify_on_reaction();

drop trigger if exists notify_comment_created on public.comments;
create trigger notify_comment_created
  after insert on public.comments
  for each row execute function public.notify_on_comment();

drop trigger if exists notify_report_created on public.reports;
create trigger notify_report_created
  after insert on public.reports
  for each row execute function public.notify_on_report();
