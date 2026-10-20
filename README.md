# AI STUDY

A responsive learning space for multiple-choice, integer, and decimal-number practice, streaks, study files, and helpdesk queries. Built with Next.js and Supabase Auth, Postgres, and private Storage. The dashboard/sidebar layout follows the attached AI STUDY prototype; localStorage-based mock authentication and file storage from that prototype are replaced with real Supabase authentication, database access policies, and private file storage.

## Local setup

1. Install Node.js 20.9+ and run `npm install`.
2. Create a Supabase project. Copy its project URL and anon/public key from **Project Settings → API** into `.env.local` using `.env.example`; set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
3. Apply `supabase/migrations/001_initial.sql` in the Supabase SQL Editor or with the Supabase CLI.
4. Set the Supabase Auth site URL to `http://localhost:3000` and allowlist `http://localhost:3000/auth/callback`.
5. Configure at least one OAuth provider below and run `npm run dev`.

Without Supabase credentials, the page shows setup guidance; authentication and persistent user data require a Supabase project.

## OAuth providers

Enable providers under Supabase **Authentication → Providers** and add credentials from the provider console. Register the exact callback URL shown by Supabase in the provider's redirect allowlist.

- **Google/Gmail:** Create a web OAuth client in Google Cloud Console and allow the Supabase callback.
- **Facebook:** Configure a Facebook Login app and add the Supabase callback to valid OAuth redirect URIs.
- **Apple ID:** Configure Sign in with Apple, including the service ID, domain, return URL, and key material required by Supabase.

Sign-in does not work until provider credentials and callback allowlists are configured in both places. Do not commit client secrets or service-role keys.

## Administrator and data access

`ADMIN_EMAIL` defaults to `Himanshuraj25102008@gmail.com`. Set it in deployment configuration if needed. The verified matching account can create and delete quizzes and multiple-choice, integer, and decimal questions; create note folders; upload and remove resources (up to 20 MB); inspect learner streaks; and reply to or resolve helpdesk queries. If changing the admin email, update the fallback in `public.is_site_admin()` in the migration as well.

RLS protects learner profiles, answers, and queries. Answer keys are stored separately from learner-readable questions. `submit_quiz_answer` checks responses and updates current/best consecutive-correct streaks atomically; each user can submit once per question. Uploaded files are in a private bucket and accessed through short-lived signed URLs for signed-in users.

## Deployment

Deploy to any Node-compatible Next.js host. Configure all variables in `.env.example`, use the deployed origin for `NEXT_PUBLIC_SITE_URL`, add its `/auth/callback` to Supabase's redirect allowlist, apply the SQL migration, and update OAuth callbacks. This app uses the public anon key with RLS; never expose a service-role key.

### Vercel

In Vercel, import `himanshuraj25102008/ai-study` and select the `himanshuraj25102008-ai-study-website` branch. Keep the detected Next.js framework defaults. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_EMAIL`, and `NEXT_PUBLIC_SITE_URL` to the Vercel project's Production environment, then deploy the branch. A new push to this branch triggers another deployment when the Git integration is connected.

No site has been deployed and no domain registered. `ai__study.com` contains underscores and is not a valid standard DNS hostname; purchase/configure a valid domain separately and point it at the deployment before using it as the production URL.

## Checks

- `npm test`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
