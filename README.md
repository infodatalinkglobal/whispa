# Whispa

Anonymous campus confessions for Ghana. *Say it. Nobody knows.* Live at https://whispa-nu.vercel.app

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Edge Functions) · Vercel.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and anon key
npm run dev
```

## How it works

- **Accounts:** a username and password, no email. Supabase Auth is email-based, so each username maps to
  `<username>@users.whispa.invalid` (enforced by a database trigger). Usernames are never shown on posts.
- **Anonymity:** posts, votes, comments and reports store the account privately; clients cannot read that column.
- **Password reset:** a single-use recovery code shown at sign-up (and on request from the account menu). The
  `reset-password` edge function checks it, sets the new password and ends all old logins.
- **Abuse limits:** 1 post per 30 s, 1 reply per 10 s, one vote and one report per account. A post is hidden after
  10 reports from accounts at least 1 hour old.
- **Feed:** Hot by default, with a New switch. Hot score = (up − down + reactions + 2 × replies + 1) ÷ (age in hours + 2)^1.5
  (`lib/ranking.ts`).
- **Reactions:** 😂 😭 😳 🔥 ❤️, one per account per post, changeable. Counts are stored on the post.
- **Daily question:** a new prompt every day from a built-in list (`lib/prompts.ts`), plus writing starters in the composer.
- **Share cards:** `/api/card/<confession id>` draws a 1080×1920 image for WhatsApp Status.
- **Install prompt:** web app manifest, generated icons (`/icons/<size>.png`) and a tiny service worker.

## Database

`supabase/schema.sql` is a reference snapshot of the live schema, policies and functions. Dashboard settings that are
not in SQL: Authentication > Email > **Confirm email must be off**. The edge function source is in
`supabase/functions/reset-password/`.

## Everyday operations (run in the Supabase SQL editor)

```sql
-- Hide a post
update public.confessions set is_approved = false where id = '<post id>';

-- Remove starter posts once real ones outnumber them
delete from public.confessions where is_seed = true;
```

## Opening another campus later

1. Add it to `ACTIVE_CAMPUSES` in `lib/constants.ts` (the campus filter and pickers come back automatically).
2. Add it to the `campus in (...)` list in the `"logged-in users post"` policy.
