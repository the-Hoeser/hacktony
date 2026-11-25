# HackTony integrations

## Supabase cloud sync

The tracker now supports passwordless Supabase Auth and a manual **Sync now** action. The browser only uses the project's publishable key; never place a Supabase secret or service-role key in frontend environment variables.

### Netlify environment variables

In Netlify → HackTony project → Project configuration → Environment variables, add:

- `VITE_SUPABASE_URL` — `https://wofyhisslmokjejrtlzk.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the project's publishable key (starts with `sb_publishable_`)

Both are public browser values; use Build scope. Save and trigger a new deploy.

### Supabase Auth URL configuration

In Supabase → Authentication → URL Configuration, set Site URL to:

`https://hacktony.netlify.app`

Add that same URL to the allowed redirect URLs. Magic-link sign-in returns to the current app origin.

### Database

The deployed database has these HackTony-specific tables:

- `public.hacktony_events`
- `public.hacktony_gmail_discoveries`

Both tables have RLS enabled, explicit authenticated grants, and owner-only policies. The existing `public.hackathons` catalogue and other project tables were left intact.

## Gmail read-only OAuth

1. Open Google Cloud Console and choose/create a project.
2. Enable the Gmail API.
3. Configure the OAuth consent screen; add your Gmail account as a test user while in Testing.
4. Create OAuth Client ID → Web application.
5. Add Authorized JavaScript origin: `https://hacktony.netlify.app`.
6. Copy the Client ID into HackTony → Settings → Google OAuth Client ID and save.
7. Connect Gmail. The app requests only `gmail.readonly`.

The access token is held in app memory for the current session, not persisted to local storage. Discovery searches a limited number of emails and creates a review queue. Import/dismiss actions require review and do not modify the Gmail messages.

## Current limitations

- Manual cloud sync (not background/automatic sync yet).
- Gmail token is session-only; reconnect after it expires.
- Netlify env variables must be added manually because the connected Netlify API integration cannot edit site variables.
- Team collaboration and shared workspaces are not implemented.
