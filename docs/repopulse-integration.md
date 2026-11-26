# HackTony ↔ Vilica integration

Vilica production URL: [https://vilica.netlify.app](https://vilica.netlify.app)

The two applications remain independent products:

- HackTony owns hackathon opportunities, personal participation records, dates, submissions, Gmail discoveries, and the association between a hackathon and a GitHub repository.
- Vilica owns GitHub repository discovery, Markdown plans/checklists, deterministic project progress, and development logs.

They do not share authentication sessions, GitHub access tokens, source-code storage, or a database connection.

## Link model

HackTony stores a user's Vilica integration in the existing owner-scoped `public.app_user_connections` table:
- `provider = 'repopulse'`
- `external_account_id = 'workspace'`
- `metadata.app_url` contains the user's independently hosted Vilica app URL
- `metadata.links` contains one mapping per HackTony event, with event ID/name, public GitHub repository URL/full name, project display name, branch, and linked timestamp

The row is subject to the existing `connections_owner` RLS policy (`user_id = auth.uid()`) and authenticated table grants. No schema migration is required for this initial linkage.

## Deep-link contract

HackTony builds an app URL using these query parameters:

- `repo=owner/repository` — required public GitHub repository identity
- `branch=main` — requested branch to read for Markdown plans/logs
- `source=hacktony` — source product marker
- `hackathon=Event%20name` — display context
- `hackathonId=<uuid>` — HackTony event identity

Vilica receives the link, then requires the user to connect their GitHub account independently. It finds the public repository in the authorized user's repository list, marks it tracked, reads the selected branch's plan/log, opens the project detail, and persists the tracked repository ID in its own private Gist. Once the project is opened, it removes the integration query parameters from the browser URL.

If the linked repository is not visible to the connected GitHub account, Vilica displays an explanation and leaves the deep link intact. Private repositories are not supported by the current Vilica OAuth scopes.

## Setup

1. Deploy Vilica independently (Netlify/Vercel or local development server).
2. In HackTony Settings → Vilica integration, enter the deployed Vilica URL. For local development, a local Vite URL can be used while the development server is running on the same device.
3. In a HackTony event, choose **Link project**, paste the exact public GitHub repository URL, and save the project display name/branch.
4. Open Vilica from that event. Connect GitHub there if not already connected.

## Progress integration boundary

This first milestone is linkage and deep navigation only. It does not yet read Vilica progress summaries into HackTony. That is the next milestone: a read-only, intentionally limited progress summary contract. Vilica continues to calculate progress from Markdown, and HackTony will not duplicate or guess that calculation.


## Read-only progress summary

Once Vilica is deployed with its Netlify Function, HackTony can call:

`GET <Vilica app URL>/.netlify/functions/project-progress?repo=owner/name&branch=optional`

The request sends only the public GitHub repository full name and optional branch. It does not send a GitHub token. Vilica reads public GitHub repository metadata, the matching Markdown plan/checklist and optional latest commit, then calculates progress using the same `parseMarkdownPlan` and `progressFromPhases` source as the Vilica UI.

HackTony displays the returned task count and percentage as read-only data. If the plan is missing, empty, or the endpoint is unavailable, HackTony shows an unavailable/no-checklist status rather than guessing. GitHub's unauthenticated API rate limit applies. The endpoint allows CORS only from HackTony production and local development origins.
