# HackTony

HackTony is a Gmail-first personal hackathon tracker. It discovers hackathon-related emails, turns them into structured event records, and provides a dashboard for participation, submissions, outcomes, and activity.

## Zero-cost MVP goal
Run the first version on free tiers. Keep Gmail access read-only, filter emails before AI extraction, deduplicate messages, and track AI usage.

## Roadmap
- [ ] Sprint 0: frontend shell, backend skeleton, docs
- [ ] Sprint 1: Google OAuth + Gmail readonly sync
- [ ] Sprint 2: email classification, extraction, deduplication, review queue
- [ ] Sprint 3: dashboard data and event management
- [ ] Sprint 4: incremental sync, hardening, deployment

## Proposed stack
- Frontend: React + TypeScript + Vite
- Backend: FastAPI
- Database/Auth: Supabase PostgreSQL + Auth
- Email: Gmail API with readonly OAuth scope
- AI: provider abstraction, rules-first filtering
- Hosting: free-tier-first

## Product principles
- No hackathon-platform scraping or platform APIs
- Gmail is the initial data source
- Email messages are evidence; normalized hackathon records are the product data
- Read-only email access, minimal stored content, user corrections take precedence
- AI extraction should be cost-limited and optional

See `docs/architecture.md` and `docs/mvp-plan.md`.
