# Schedule — Google Calendar ingestion setup

The `schedule` app reads a family's Google calendars **read-only** via a Google
Cloud **service account**. No per-user OAuth. This is a one-time setup; after it,
a Convex cron syncs the current week every 15 minutes.

## 1. Create the service account

1. In the Google Cloud console, create (or pick) a project.
2. Enable the **Google Calendar API** for it.
3. Create a **service account**; create a **JSON key** and download it.

## 2. Share the calendars with the service account

For each calendar to ingest (per-person and the shared/household one):

1. Google Calendar → Settings → that calendar → **Share with specific people**.
2. Add the service account's email (`...@...iam.gserviceaccount.com`) with
   **"See all event details"** (read) access.
3. Copy the calendar's **Calendar ID** (Settings → Integrate calendar).

## 3. Set Convex environment variables

In the Convex dashboard (Project → Settings → Environment Variables):

| Variable | Value |
| --- | --- |
| `GOOGLE_SA_KEY` | the entire service-account JSON key, stringified |
| `SCHEDULE_CALENDARS` | `[{"calendarId":"<id>","who":"<memberId>|shared"}, ...]` |
| `SCHEDULE_MEMBERS` | `[{"id":"<memberId>","tokens":["<name>","<alias>"]}, ...]` |
| `SCHEDULE_TZ` | IANA timezone, e.g. `Australia/Sydney` |

- A per-person calendar's `who` is that member's id; the shared calendar's `who`
  is the literal `shared`.
- `tokens` are the name words used to attribute a shared-calendar event to a
  member from its title (e.g. first name + nickname). No token match on a shared
  event → the whole family.

These values hold real names and ids and live **only** in Convex env — never in
git (see `docs/agents/privacy.md`).

## 4. Verify

Trigger a sync manually and confirm rows land:

```bash
cd packages/convex
pnpm exec dotenv -e ../../.env.local -- convex run schedule/sync:run
```

It returns `{ count: <n> }`. Check the `scheduleEvents` table in the dashboard,
then confirm the cron (`sync schedule`) is listed and runs every 15 minutes.
