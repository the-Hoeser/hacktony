# Historical Gmail event discovery

HackTony uses the existing Gmail OAuth read-only token to scan matching messages from the connected mailbox. The search does not apply a date cutoff, so it can find older matching messages as the user continues through pages.

## Scan behavior

- Gmail `messages.list` is requested with `maxResults=100`.
- Each user-initiated scan processes up to three Gmail result pages.
- The UI exposes a “Scan older emails” action when Gmail returns a continuation page token.
- Message details are fetched in small concurrent batches using `format=metadata` and the Subject, From, and Date headers. The Gmail-provided snippet is used for limited evidence; message bodies and attachments are not fetched.
- Matching messages are deduplicated by Gmail message ID in local state.
- No messages are modified, sent, archived, or deleted.

## Event candidate grouping

Subject prefixes and common confirmation phrases are normalized to infer an event name. Similar normalized names are grouped into one candidate. Generic titles without a dependable event name are kept separate rather than being merged into a potentially unrelated event.

The UI shows a suggested status based on words in subjects and snippets:
- Registered
- In progress
- Submitted
- Completed
- Interested when there is insufficient status evidence

These are heuristic suggestions, not verified outcomes. The user reviews each candidate before import and can edit the resulting tracker entry later.

## Import behavior

Importing a candidate creates one HackTony event or appends evidence to an existing event with the same normalized name. Existing statuses are never downgraded by an import. Up to 20 evidence messages are included in the event notes; the remaining message count is noted. The imported candidate's Gmail rows are marked imported in Supabase when the user is signed in and those rows have already been synced.

## Limitations

- Search results are based on Gmail's search matching, so messages that contain no query terms can be missed.
- The initial query is broad and can return unrelated competition, job, or submission mail. Candidates are review-first.
- Name grouping and suggested status are heuristic; different subject wording can split one event into multiple candidates, and similarly named events can occasionally be grouped.
- Snippets do not always contain the event name or participation outcome. HackTony does not fetch full message bodies in this version.
- Gmail access tokens remain in memory for the current browser session; reconnect Gmail after a reload before scanning more pages.
- Scan continuation tokens are session state. After reconnecting, a new scan starts from the newest matching messages; the event records already imported remain in the tracker.

## Privacy

Only Gmail read-only access is requested. The importer reads matching message metadata and snippets for review. It does not send mail or change the mailbox.
