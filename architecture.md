# HackTony Architecture

## Data flow
1. OAuth consent grants Gmail read-only access.
2. Sync worker fetches message metadata and candidate email content.
3. Deterministic sender/subject/body rules classify likely hackathon messages.
4. Only candidates proceed to structured extraction.
5. Entity resolution matches messages to existing hackathons.
6. High-confidence updates apply automatically; uncertain records enter a review queue.
7. Dashboard API serves normalized records and analytics.

## Components
- Frontend: React + TypeScript + Vite
- Backend: FastAPI
- Database/Auth: Supabase Postgres and Auth
- Gmail: Gmail API (readonly scope)
- AI: pluggable extraction service, invoked only for filtered candidates
- Sync: manual trigger first; scheduled incremental sync later

## Core entities
- users
- hackathons
- emails
- hackathon_email_links
- submissions
- achievements
- sync_history
- ai_usage

## Cost guardrails
- Rules-first email filtering
- Gmail incremental sync/history IDs
- Idempotency using Gmail message ID
- Extraction caching
- Per-user quotas and token/cost accounting
- Manual scan control and bounded initial import
- AI disabled until configuration is supplied

## MVP constraints
- No platform scraping or individual hackathon platform APIs.
- Gmail is the ingestion source.
- Emails are evidence; normalized hackathon records are the product data.
- User corrections take precedence over automated extraction.
