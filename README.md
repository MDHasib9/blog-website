# Blogify

Blogify is a community blogging site built with Next.js 16, React 19, TypeScript, Tailwind CSS, and Supabase.

## Features

- Public story feed with search, topic filters, and pagination
- Public author profiles and profile story lists
- Email/password sign-up, sign-in, email confirmation, and password reset
- Rich-text story publishing with image uploads
- Author-only story editing and soft deletion
- Threaded comments and post reactions
- Saved stories, author follows, and in-app notifications
- User reports and administrator moderation tools
- Responsive navigation and light/dark themes

## Local development

Use Node.js 20.9 or later.

1. Install the locked dependencies:

   ```powershell
   npm ci
   ```

2. Copy the example environment file and add your Supabase project values:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Start the development server:

   ```powershell
   npm run dev
   ```

The site is available at [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable/anonymous client key |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical site origin used for absolute metadata URLs |

Only public Supabase credentials belong in these variables. Never put a Supabase service-role or secret key in a `NEXT_PUBLIC_` variable or commit it to this repository.

### Supabase prerequisites

The app expects an existing Supabase project with the `profiles`, `posts`, `categories`, `tags`, `post_tags`, `reactions`, `comments`, `bookmarks`, `follows`, `notifications`, and `reports` tables, the `user_role`, `reaction_type`, `notification_type`, and `report_status` enums, and the row-level security policies required by the app's public reads and authenticated mutations. It also expects a public `post-images` Storage bucket with policies that allow signed-in users to upload to their own user-ID folder.

The migrations in `supabase/migrations` assume that schema already exists. Review and run them in order in the Supabase SQL Editor before enabling social notifications and admin moderation:

1. `20261001000100_secure_community_notifications.sql` replaces direct notification inserts with database-generated notifications for follows, reactions, comments, replies, and reports.
2. `20261001000200_protect_profile_privileges.sql` prevents non-admin users from changing their own role, ban, or deletion fields. This is important because the supplied self-update RLS policy alone does not restrict which profile columns a user can update.

Ensure at least one trusted administrator is assigned `role = 'admin'` in `profiles` using the Supabase SQL Editor; do not expose an admin-role editor in the client. Verify all RLS policies and Storage policies against the project before launch. Configure Supabase Auth's site URL and allowed redirect URLs for local development and each deployed domain; the app completes confirmation and password-reset callbacks through `/auth/confirm`.

## Validation

```powershell
npm run lint
npm run build
```

To run the production build locally:

```powershell
npm run start
```

## Deploy to Vercel

1. Push this repository to GitHub and import it into Vercel. Vercel detects the Next.js framework and uses `npm run build`.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the Vercel project's Production, Preview, and Development environments as appropriate.
3. Set `NEXT_PUBLIC_SITE_URL` to the production site's HTTPS origin, such as `https://your-project.vercel.app` or your custom domain.
4. In Supabase Auth URL Configuration, set the production site URL and allow the corresponding local and deployed callback URLs, including `/auth/confirm`.
5. Verify the `post-images` bucket and its upload/read policies in Supabase.
6. Deploy and test sign-up confirmation, sign-in, password reset, story publishing/editing/deletion, image uploads, comments, and reactions on the deployed URL.

The app uses server rendering, Server Actions, and a request proxy for authenticated routes, so deploy it as a Next.js application rather than a static export.
