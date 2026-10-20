-- Whispa database: reference snapshot of the final state.
-- It mirrors the migrations applied to the live Supabase project (create_confessions, add_reports, accounts,
-- comment_count, recovery_codes, seed_posts, atu_only_posting, review_hardening). Read it to understand or
-- rebuild the setup; if the live project and this file ever disagree, the live project wins.
--
-- Dashboard settings that are NOT in SQL:
--   Authentication > Sign In / Providers > Email: "Confirm email" must be OFF (usernames have no real inbox).
--   Edge Function "reset-password": supabase/functions/reset-password/index.ts, JWT verification on.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now(),
  recovery_hash text,                       -- bcrypt hash of the single-use recovery code
  reset_attempts integer not null default 0,
  reset_locked_until timestamptz
);

create table public.confessions (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(btrim(content)) between 3 and 500),
  campus text not null check (campus in ('ATU','UG Legon','KNUST','UCC','Ashesi','UPSA','GCTU','Other')),
  category text not null check (category in ('Relationships','Academics','Money','Drama','Work')),
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  is_approved boolean not null default true,
  created_at timestamptz not null default now(),
  report_count integer not null default 0,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),  -- private, never readable by clients
  comment_count integer not null default 0,
  is_seed boolean not null default false    -- private flag for starter posts: delete from confessions where is_seed
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  confession_id uuid not null references public.confessions(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 300),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null default auth.uid()
);

create table public.votes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  confession_id uuid not null references public.confessions(id) on delete cascade,
  direction text not null check (direction in ('up','down')),
  primary key (user_id, confession_id)
);

create table public.reports (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  confession_id uuid not null references public.confessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, confession_id)
);

-- Emoji reactions: one per account per post (changeable). Counts live on the post as {"laugh": 3, "fire": 1}.
alter table public.confessions add column reaction_counts jsonb not null default '{}'::jsonb;
create table public.reactions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  confession_id uuid not null references public.confessions(id) on delete cascade,
  reaction text not null check (reaction in ('laugh','cry','shy','fire','love')),
  primary key (user_id, confession_id)
);
create index reactions_confession_idx on public.reactions (confession_id);

-- ---------------------------------------------------------------- indexes
create index confessions_feed_idx on public.confessions (created_at desc) where is_approved;
create index comments_confession_idx on public.comments (confession_id, created_at);
create index votes_confession_idx on public.votes (confession_id);
create index reports_confession_idx on public.reports (confession_id);
create index confessions_user_idx on public.confessions (user_id);
create index comments_user_idx on public.comments (user_id);

-- ---------------------------------------------------------------- row-level security
alter table public.profiles enable row level security;
alter table public.confessions enable row level security;
alter table public.comments enable row level security;
alter table public.votes enable row level security;
alter table public.reports enable row level security;
alter table public.reactions enable row level security;

-- Column privileges keep private columns (user_id, is_seed, recovery data) away from the public API.
revoke select on public.confessions from anon, authenticated;
grant select (id, content, campus, category, upvotes, downvotes, is_approved, created_at, report_count, comment_count, reaction_counts)
  on public.confessions to anon, authenticated;
revoke select on public.comments from anon, authenticated;
grant select (id, confession_id, content, created_at) on public.comments to anon, authenticated;
revoke select on public.profiles from anon, authenticated;
grant select (id, username, created_at) on public.profiles to authenticated;
revoke insert on public.confessions from anon;
revoke insert on public.comments from anon;

create policy "read approved confessions" on public.confessions for select to anon, authenticated using (is_approved);
-- Only ATU is open for posting. To open another campus, add it to this list and to ACTIVE_CAMPUSES in lib/constants.ts.
create policy "logged-in users post" on public.confessions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and is_approved and upvotes = 0 and downvotes = 0 and report_count = 0 and comment_count = 0
    and reaction_counts = '{}'::jsonb
    and campus in ('ATU')
  );
create policy "read comments on approved confessions" on public.comments for select to anon, authenticated
  using (exists (select 1 from public.confessions c where c.id = confession_id and c.is_approved));
create policy "logged-in users comment" on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.confessions c where c.id = confession_id and c.is_approved));
create policy "read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "read own votes" on public.votes for select to authenticated using (user_id = (select auth.uid()));
create policy "read own reports" on public.reports for select to authenticated using (user_id = (select auth.uid()));
create policy "read own reactions" on public.reactions for select to authenticated using (user_id = (select auth.uid()));
-- No insert/update/delete policies on votes, reports or profiles: they change only through the functions below.

-- ---------------------------------------------------------------- accounts
-- Accounts are <username>@users.whispa.invalid. The profile username comes from the email itself.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare e text := lower(coalesce(new.email, ''));
begin
  if e !~ '^[a-z0-9_]{3,20}@users\.whispa\.invalid$' then
    raise exception 'invalid_signup' using errcode = '22023';
  end if;
  insert into public.profiles (id, username) values (new.id, split_part(e, '@', 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- rate limits and counters
create or replace function public.enforce_post_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('post:' || new.user_id::text, 0));
    if exists (select 1 from confessions where user_id = new.user_id and created_at > now() - interval '30 seconds') then
      raise exception 'too_fast';
    end if;
  end if;
  return new;
end $$;
create trigger post_rate before insert on public.confessions for each row execute function public.enforce_post_rate();

create or replace function public.enforce_comment_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('comment:' || new.user_id::text, 0));
    if exists (select 1 from comments where user_id = new.user_id and created_at > now() - interval '10 seconds') then
      raise exception 'too_fast';
    end if;
  end if;
  return new;
end $$;
create trigger comment_rate before insert on public.comments for each row execute function public.enforce_comment_rate();

create or replace function public.bump_comment_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update confessions set comment_count = comment_count + 1 where id = new.confession_id;
  return new;
end $$;
create trigger comments_count after insert on public.comments for each row execute function public.bump_comment_count();

create or replace function public.drop_comment_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update confessions set comment_count = greatest(comment_count - 1, 0) where id = old.confession_id;
  return old;
end $$;
create trigger comments_count_down after delete on public.comments for each row execute function public.drop_comment_count();

-- ---------------------------------------------------------------- voting and reporting
-- One vote per account. p_direction: 'up', 'down', or null to remove the vote.
create or replace function public.vote_confession(p_id uuid, p_direction text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prev text;
begin
  if uid is null then raise exception 'login required'; end if;
  if p_direction is not null and p_direction not in ('up','down') then raise exception 'bad direction'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_id::text, 0));
  perform 1 from confessions where id = p_id and is_approved;
  if not found then raise exception 'not found'; end if;
  select direction into prev from votes where user_id = uid and confession_id = p_id;
  if prev is not distinct from p_direction then return; end if;
  if prev = 'up' then update confessions set upvotes = greatest(upvotes - 1, 0) where id = p_id;
  elsif prev = 'down' then update confessions set downvotes = greatest(downvotes - 1, 0) where id = p_id; end if;
  if p_direction = 'up' then update confessions set upvotes = upvotes + 1 where id = p_id;
  elsif p_direction = 'down' then update confessions set downvotes = downvotes + 1 where id = p_id; end if;
  if p_direction is null then delete from votes where user_id = uid and confession_id = p_id;
  else insert into votes (user_id, confession_id, direction) values (uid, p_id, p_direction)
    on conflict (user_id, confession_id) do update set direction = excluded.direction;
  end if;
end $$;

-- One emoji reaction per account. p_reaction: 'laugh' | 'cry' | 'shy' | 'fire' | 'love', or null to remove it.
create or replace function public.react_confession(p_id uuid, p_reaction text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prev text;
begin
  if uid is null then raise exception 'login required'; end if;
  if p_reaction is not null and p_reaction not in ('laugh','cry','shy','fire','love') then raise exception 'bad reaction'; end if;
  perform pg_advisory_xact_lock(hashtextextended('react:' || uid::text || ':' || p_id::text, 0));
  perform 1 from confessions where id = p_id and is_approved;
  if not found then raise exception 'not found'; end if;
  select reaction into prev from reactions where user_id = uid and confession_id = p_id;
  if prev is not distinct from p_reaction then return; end if;
  if prev is not null then
    update confessions set reaction_counts = jsonb_set(reaction_counts, array[prev],
      to_jsonb(greatest(coalesce((reaction_counts ->> prev)::int, 0) - 1, 0))) where id = p_id;
  end if;
  if p_reaction is not null then
    update confessions set reaction_counts = jsonb_set(reaction_counts, array[p_reaction],
      to_jsonb(coalesce((reaction_counts ->> p_reaction)::int, 0) + 1)) where id = p_id;
    insert into reactions (user_id, confession_id, reaction) values (uid, p_id, p_reaction)
      on conflict (user_id, confession_id) do update set reaction = excluded.reaction;
  else
    delete from reactions where user_id = uid and confession_id = p_id;
  end if;
end $$;

-- One report per account. Only accounts at least 1 hour old count toward hiding; 10 counted reports hide a post.
create or replace function public.report_confession(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); created timestamptz;
begin
  if uid is null then raise exception 'login required'; end if;
  insert into reports (user_id, confession_id) values (uid, p_id) on conflict do nothing;
  if found then
    select created_at into created from auth.users where id = uid;
    if created is not null and created <= now() - interval '1 hour' then
      update confessions
      set report_count = report_count + 1,
          is_approved = case when report_count + 1 >= 10 then false else is_approved end
      where id = p_id and is_approved;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------- recovery codes (password reset)
-- A signed-in member stores a new code. Only the hash is kept.
create or replace function public.set_recovery_code(p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare c text := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if length(c) <> 16 then raise exception 'bad code'; end if;
  update profiles set recovery_hash = crypt(c, gen_salt('bf')), reset_attempts = 0, reset_locked_until = null
  where id = auth.uid();
end $$;

-- Service role only (used by the reset-password edge function).
create or replace function public.set_recovery_code_for(p_user uuid, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare c text := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
begin
  update profiles set recovery_hash = crypt(c, gen_salt('bf')), reset_attempts = 0, reset_locked_until = null where id = p_user;
end $$;

-- Returns the user id when username + code match, else null. 5 misses lock the account's reset for 15 minutes.
create or replace function public.verify_recovery(p_username text, p_code text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare c text := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g')); p profiles%rowtype;
begin
  select * into p from profiles where username = lower(trim(p_username));
  if not found or p.recovery_hash is null then return null; end if;
  if p.reset_locked_until is not null and p.reset_locked_until > now() then return null; end if;
  if length(c) = 16 and crypt(c, p.recovery_hash) = p.recovery_hash then
    update profiles set reset_attempts = 0, reset_locked_until = null where id = p.id;
    return p.id;
  end if;
  update profiles
    set reset_attempts = case when reset_attempts + 1 >= 5 then 0 else reset_attempts + 1 end,
        reset_locked_until = case when reset_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
    where id = p.id;
  return null;
end $$;

-- Ends every login for an account after a password reset.
create or replace function public.revoke_sessions(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.sessions where user_id = p_user;
end $$;

-- ---------------------------------------------------------------- function permissions
revoke execute on function public.bump_comment_count() from public, anon, authenticated;
revoke execute on function public.drop_comment_count() from public, anon, authenticated;
revoke execute on function public.enforce_comment_rate() from public, anon, authenticated;
revoke execute on function public.enforce_post_rate() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.vote_confession(uuid, text) from public, anon;
revoke all on function public.report_confession(uuid) from public, anon;
revoke all on function public.set_recovery_code(text) from public, anon;
revoke all on function public.react_confession(uuid, text) from public, anon;
grant execute on function public.react_confession(uuid, text) to authenticated;
grant execute on function public.vote_confession(uuid, text) to authenticated;
grant execute on function public.report_confession(uuid) to authenticated;
grant execute on function public.set_recovery_code(text) to authenticated;

revoke all on function public.set_recovery_code_for(uuid, text) from public, anon, authenticated;
revoke all on function public.verify_recovery(text, text) from public, anon, authenticated;
revoke all on function public.revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function public.set_recovery_code_for(uuid, text) to service_role;
grant execute on function public.verify_recovery(text, text) to service_role;
grant execute on function public.revoke_sessions(uuid) to service_role;
