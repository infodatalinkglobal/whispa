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

-- ================================================================ anonymous inbox (NGL-style personal links)
-- Each account gets a private random link (/m/<code>). Anyone who opens it can send an anonymous message,
-- no account needed. Only the owner can read them. Senders keep a secret in their own browser so they can
-- see replies later, on that same browser.

create table public.inboxes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  is_paused boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.anon_messages (
  id uuid primary key default gen_random_uuid(),
  inbox_user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 500),
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  reply text check (reply is null or char_length(btrim(reply)) between 1 and 500),
  replied_at timestamptz,
  token_hash text not null,   -- hash of the sender's browser secret
  ip_hash text not null,      -- salted per recipient; only for spam limits and blocking, never readable by clients
  reported boolean not null default false
);
create table public.blocked_senders (
  inbox_user_id uuid not null references auth.users(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  primary key (inbox_user_id, ip_hash)
);
create index anon_messages_inbox_idx on public.anon_messages (inbox_user_id, created_at desc);
create index anon_messages_ip_idx on public.anon_messages (inbox_user_id, ip_hash, created_at);
create index anon_messages_token_idx on public.anon_messages (token_hash);

alter table public.inboxes enable row level security;
alter table public.anon_messages enable row level security;
alter table public.blocked_senders enable row level security;
revoke all on public.inboxes, public.anon_messages, public.blocked_senders from anon, authenticated;
grant select on public.inboxes to authenticated;
grant select (id, content, created_at, is_read, reply, replied_at) on public.anon_messages to authenticated;
grant delete on public.anon_messages to authenticated;
create policy "read own inbox" on public.inboxes for select to authenticated using (user_id = (select auth.uid()));
-- A message the owner reported disappears from their inbox for good (it stays in the database for review).
create policy "read own messages" on public.anon_messages for select to authenticated
  using (inbox_user_id = (select auth.uid()) and not reported);
create policy "delete own messages" on public.anon_messages for delete to authenticated using (inbox_user_id = (select auth.uid()));

-- 10-character link code. The alphabet has 31 characters, so pick with modulo 31.
create or replace function public.new_inbox_code() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789'; v_code text; bytes bytea; i int;
begin
  loop
    bytes := gen_random_bytes(10); v_code := '';
    for i in 0..9 loop v_code := v_code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1); end loop;
    exit when not exists (select 1 from inboxes where inboxes.code = v_code);
  end loop;
  return v_code;
end $$;

-- Owner functions (signed in)
create or replace function public.get_my_inbox() returns table (code text, is_paused boolean)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'login required'; end if;
  insert into inboxes (user_id, code) values (uid, new_inbox_code()) on conflict (user_id) do nothing;
  return query select i.code, i.is_paused from inboxes i where i.user_id = uid;
end $$;

create or replace function public.reset_inbox_link() returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_code text;
begin
  if uid is null then raise exception 'login required'; end if;
  perform get_my_inbox();
  v_code := new_inbox_code();
  update inboxes set code = v_code where user_id = uid;
  return v_code;
end $$;

create or replace function public.set_inbox_paused(p_paused boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  perform get_my_inbox();
  update inboxes set is_paused = p_paused where user_id = auth.uid();
end $$;

create or replace function public.reply_to_message(p_id uuid, p_reply text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  update anon_messages set reply = btrim(p_reply), replied_at = now() where id = p_id and inbox_user_id = auth.uid();
  if not found then raise exception 'not found'; end if;
end $$;

create or replace function public.mark_messages_read() returns void
language sql security definer set search_path = public as $$
  update anon_messages set is_read = true where inbox_user_id = auth.uid() and not is_read;
$$;

-- Flags the message for review and silently blocks whoever sent it from this inbox.
create or replace function public.report_and_block(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); h text;
begin
  if uid is null then raise exception 'login required'; end if;
  update anon_messages set reported = true where id = p_id and inbox_user_id = uid returning ip_hash into h;
  if h is null then raise exception 'not found'; end if;
  if h not like 'u:%' then
    insert into blocked_senders (inbox_user_id, ip_hash) values (uid, h) on conflict do nothing;
  end if;
end $$;

-- Public functions (no account needed)
create or replace function public.inbox_status(p_code text) returns text
language sql security definer set search_path = public as $$
  select coalesce((select case when is_paused then 'paused' else 'ok' end from inboxes where code = lower(btrim(p_code))), 'missing');
$$;

create or replace function public.send_anonymous_message(p_code text, p_content text, p_token text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  owner uuid; paused boolean; text_clean text := btrim(p_content);
  fwd text := nullif(btrim(split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1)), '');
  h text;
begin
  if text_clean is null or char_length(text_clean) not between 1 and 500 then raise exception 'bad_message'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then raise exception 'bad_token'; end if;
  select user_id, is_paused into owner, paused from inboxes where code = lower(btrim(p_code));
  if owner is null then raise exception 'inbox_not_found'; end if;
  if paused then raise exception 'inbox_paused'; end if;
  h := case when fwd is null then 'u:' || gen_random_uuid()::text
            else encode(digest(fwd || ':' || owner::text || ':whispa', 'sha256'), 'hex') end;
  -- A blocked sender sees success, so they can't tell they were blocked.
  if exists (select 1 from blocked_senders where inbox_user_id = owner and ip_hash = h) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('inbox:' || owner::text, 0));
  -- Spam limits: 5 per sender per 10 minutes, and 30 per inbox per hour.
  if (select count(*) from anon_messages where inbox_user_id = owner and ip_hash = h and created_at > now() - interval '10 minutes') >= 5
     or (select count(*) from anon_messages where inbox_user_id = owner and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many';
  end if;
  insert into anon_messages (inbox_user_id, content, token_hash, ip_hash)
  values (owner, text_clean, encode(digest(p_token, 'sha256'), 'hex'), h);
end $$;

-- The sender's browser asks for replies using the secrets it kept; returns the position in the list it sent.
create or replace function public.get_message_replies(p_tokens text[]) returns table (ord integer, reply text, replied_at timestamptz)
language sql security definer set search_path = public, extensions as $$
  select t.ord::int, m.reply, m.replied_at
  from unnest((select p_tokens[1:50])) with ordinality as t(tok, ord)
  join anon_messages m on m.token_hash = encode(digest(t.tok, 'sha256'), 'hex');
$$;

revoke all on function public.new_inbox_code() from public, anon, authenticated;
revoke all on function public.get_my_inbox(), public.reset_inbox_link(), public.set_inbox_paused(boolean),
  public.reply_to_message(uuid, text), public.mark_messages_read(), public.report_and_block(uuid) from public, anon;
grant execute on function public.get_my_inbox(), public.reset_inbox_link(), public.set_inbox_paused(boolean),
  public.reply_to_message(uuid, text), public.mark_messages_read(), public.report_and_block(uuid) to authenticated;
revoke all on function public.inbox_status(text), public.send_anonymous_message(text, text, text), public.get_message_replies(text[]) from public;
grant execute on function public.inbox_status(text), public.send_anonymous_message(text, text, text), public.get_message_replies(text[]) to anon, authenticated;
