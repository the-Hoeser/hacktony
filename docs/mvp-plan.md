# HackTony MVP Plan

## Sprint 0 — Foundation
- [x] Repository
- [x] Starter frontend shell
- [x] Backend skeleton
- [x] Project configuration and env examples
- [x] Architecture docs
- [ ] Local setup validation

## Sprint 1 — Gmail connection
- Google OAuth setup
- Read-only Gmail scope
- Initial bounded scan
- Persist message IDs, metadata and minimal excerpts
- Sync state and status UI

## Sprint 2 — Intelligence
- Rules-based detection
- Structured extraction schema
- Event entity matching
- Duplicate handling
- Confidence score and review queue
- Email evidence panel

## Sprint 3 — Dashboard
- Overview metrics
- Hackathons table and filters
- Event details and timeline
- Submission records
- Achievements
- Analytics

## Sprint 4 — Reliability
- Incremental Gmail sync
- Retry handling
- Usage limits and cost reporting
- Export/delete controls
- Deployment and security review

## MVP definition of done
A user can connect Gmail with read-only permission, run a bounded scan, review discovered hackathon emails, verify/correct extracted events, and see activity on the dashboard without platform scraping.
