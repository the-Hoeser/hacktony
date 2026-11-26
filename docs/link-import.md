# Hackathon link import

HackTony's Add Hackathon dialog accepts a public event URL and requests a metadata preview from the Netlify function at `/.netlify/functions/import-hackathon`.

## Supported host families

The first extractor version accepts public pages from Devpost, Unstop, HackerEarth, Devfolio, Major League Hacking, Luma, Hackathon.com, Hackathons.com, HackathonFinder, Techsnap, IndiaHackathons, and AllAI.Events. Redirects are checked against the same allowlist.

## What is extracted

The importer prefers Schema.org JSON-LD Event data when present, then falls back to Open Graph and standard page metadata. It can prefill the event title, platform, description, start/end dates, location, and event link when the page publishes those fields.

It does not currently use AI, sign in to platforms, or bypass anti-bot pages. Some pages are JavaScript-rendered or do not publish structured event metadata; for those, the user receives a warning or an error and can finish the form manually. Prize pools, eligibility, tracks, registration deadlines, and team requirements are not guaranteed to be extracted in this first version.

## Safety and review

- Only HTTP(S) URLs on the supported public domain allowlist are accepted.
- Local/private IP destinations and redirects outside the allowlist are rejected.
- Fetches have a timeout and return metadata only; no cookies or user credentials are forwarded.
- Extracted fields are editable and nothing is added to the tracker until the user confirms Save hackathon.
- Event links are checked for exact duplicates before saving.

## Extension path

Add platform-specific parsers only where necessary, retain the metadata parser as a fallback, and keep every imported field reviewable. A future discovery feed can reuse the same normalized event structure.
