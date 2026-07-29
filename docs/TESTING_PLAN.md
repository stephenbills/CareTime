# CareTime — Comprehensive Testing Plan

A functional test checklist covering every role and screen, plus a dedicated regression section
for bugs fixed across past sessions (per `CHANGELOG.md`) that are the highest risk of quietly
coming back. Work through it role by role, or jump straight to §11 for a fast regression pass
before a release.

---

## 0. Prerequisites / Test Data

Set up before testing so multi-provider and edge-case scenarios are actually reachable:

- [ ] **2 Provider accounts** (Provider A, Provider B) — each with bank details, GST rate,
      invoice due days, and Billing Rates (Client Charge % / Worker Pay %) filled in
      (`/provider/settings/details`)
- [ ] At least 2 NDIS line items configured per Provider, with an `active` one and one with a
      `client_charge_pct_override`/`worker_pay_pct_override` set (to exercise the override path)
- [ ] **1 shared Client** linked to *both* Provider A and Provider B
- [ ] **1 shared Worker** linked to *both* Provider A and Provider B — this is the account that
      matters most for the cross-provider isolation tests in §6
- [ ] 1 Client and 1 Worker each linked to only *one* Provider (the "normal" single-provider case)
- [ ] 1 Administrator account
- [ ] At least one Client with Medical Instructions and Counters defined
- [ ] At least one recurring schedule per Provider, created far enough in the past that its
      generated window can be checked against "now"
- [ ] Confirm `.env.local` (or the deployed environment) has `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`,
      `NEXT_PUBLIC_APP_URL` set, and all `supabase_*.sql` migrations have been run in order

---

## 1. Authentication & Account Access

- [ ] Login page shows the multi-role picker (Administrator / Provider / Worker / Client /
      Nominee) and each role card routes to the correct dashboard on success
- [ ] A person with both a Worker and a Client login (or multiple Provider links) is prompted to
      pick which context to enter
- [ ] Wrong password / unknown email shows a clear error, not a silent failure
- [ ] **Forgot password**: request reset → email arrives → click link → lands on Set New
      Password (not stuck on the spinner) → set a new password → log in with it
- [ ] An **expired or already-used** reset link shows a visible "invalid or expired" error rather
      than hanging indefinitely
- [ ] Invite flow: Provider invites a new Client/Worker by email (`/api/invite`) → recipient
      receives a welcome email → can set a password and log in
- [ ] Logout works from every role's nav (Provider left sidebar, Client/Worker bottom nav) and
      returns to `/auth/login`

## 2. Provider Role

**Dashboard** (`/provider/dashboard`)
- [ ] Stat cards (Active Clients, Active Workers, Activities This Month, Awaiting Client
      Approval) show correct counts and link to the right pages
- [ ] "N shifts awaiting your payment approval" banner appears/disappears correctly
- [ ] Unassigned Activities: inline worker assignment from the dropdown works and removes the row
- [ ] Awaiting Payment Approval list heading shows a count; **clicking a row** navigates to that
      activity's detail page; the inline **Approve** button still works without triggering that
      navigation

**Clients** (`/provider/clients`)
- [ ] List shows active + inactive (with badge), Add Client works for both a brand-new client and
      linking an existing one by email (no duplicate created)
- [ ] Client detail: Personal Details are read-only, "Your Notes" (dates, notes, Active toggle)
      are editable and save; Nominees list (if any) shows read-only; Medical Instructions /
      Counters sections appear read-only and **only when that Client has defined any**; Send
      Invite / Resend Invite works

**Workers** (`/provider/carers`)
- [ ] Same list/add/link-by-email behavior as Clients; adding a worker links `provider_carers`
      (not just `carers`) for both the new-worker and existing-email paths
- [ ] Worker detail: Personal Details read-only including **Work Phone, Car Registration, ABN**;
      Your Notes editable

**Calendar** (`/provider/calendar`) — week view across all Clients/Workers, click-through to an
activity, previous/next week navigation

**Schedules** (`/provider/schedules`)
- [ ] Create a recurring schedule (Client, Worker, NDIS item, recurrence pattern, shift time,
      locations) — occurrences generate for the initial window
- [ ] **Edit** an existing schedule's title/time/worker/NDIS item/addresses — confirm the changes
      appear on **already-generated future** activities, not just the schedule template
- [ ] Change the recurrence pattern itself — new implied occurrences appear; existing ones aren't
      deleted
- [ ] Manual "Generate" button still works per-schedule
- [ ] **Auto-generation on login**: age a schedule so it has under 4 weeks of activities
      remaining, then reload any `/provider/*` page as that Provider — confirm it's topped back
      up to ~4 weeks with no duplicate rows, and that a schedule already past its `valid_until`
      is left alone

**Activities** (`/provider/activities`) — create one-off, edit, view detail, see status/rejection
reason, mileage/expenses on completed shifts

**Status** (`/provider/status`) — status board reflects current activity states

**Invoices** (`/provider/invoices`)
- [ ] **Generate Invoices**: date range picker enforces to-date > from-date and defaults
      to-date to from-date + 7; Preview only shows **this Provider's own** activities (critical —
      see §6); Generate & Email creates one invoice per Client and marks those activities invoiced
- [ ] **Reissue**: for a Client/range with an already-invoiced non-paid invoice, the "Reissue &
      Regenerate" prompt appears; confirming deletes the old invoice + line items, unlinks the
      activities, and a fresh Preview picks them back up; a **paid** invoice in the same range is
      left untouched and does *not* trigger a reissue prompt
- [ ] Invoice detail: line items, totals, status; **Mark as Paid** updates linked activities to
      `paid`; **Print/Download PDF** opens the real formal PDF in a new tab — confirm it matches
      what was emailed, has **no Worker Cost or Margin figures anywhere**, and both print and
      download work from the browser's PDF viewer
- [ ] Directly navigating to another Provider's invoice id (typed in the URL) is rejected, and
      that invoice cannot be marked as paid via a crafted request either

**Reports** (`/provider/reports`)
- [ ] Awaiting Client Approval report: client/date filters, individual and bulk "Send Reminder"
- [ ] Medical Instructions & Counters report: lazy-loads on first click, per-client breakdown of
      given/total instruction counts with %, and summed counter totals for the filtered range

**Settings** (`/provider/settings`) — Details (bank info, GST rate, invoice due days, billing
rates), NDIS item selection from the master catalogue, Public Holidays, Status labels, Users

**Sidebar** — Logout sits directly below Settings with no gap

## 3. Worker Role

**Dashboard** (`/worker/dashboard`)
- [ ] Three boxes: **Today** (count of today's shifts; clicking reveals the separate **Upcoming**
      / future-scheduled list, not today's own shifts), **Awaiting Acceptance** (clicking reveals
      its own list), **Completed Shifts** (count of `awaiting_payment_approval`/
      `ready_for_payment` shifts not yet invoiced; clicking shows each with a payment-due figure)
- [ ] "Today's Activities" detail list (with pickup address and Accept CTA) stays visible below
      the boxes at all times, independent of which box is expanded

**Calendar** (`/worker/calendar`) — own shifts only

**Activity detail** (`/worker/activities/[id]`)
- [ ] Accept (bulk-accepts sibling occurrences in the same recurring series) / Decline
- [ ] Start Shift → status moves to `in_progress`, actual start time recorded
- [ ] Medical Instructions checklist and Counters +/- stepper appear only when attached/defined;
      both are interactive **only** while `in_progress`, and remain visible read-only afterward
- [ ] End Shift & Submit: comments required, actual times, mileage/expenses optional; submission
      is never blocked by unchecked Medical Instructions
- [ ] Shift Summary shows **date + day + time** for both Started and Ended (check an overnight
      shift crossing midnight shows the correct date on each end, not the same date twice)

**Details** (`/worker/details`) — self-edit including **Work Phone, Car Registration, ABN**;
saving with 2+ linked Providers prompts which to notify

**History** (`/worker/history`) — past completed/paid/rejected/cancelled shifts

## 4. Client Role

**Dashboard** (`/client/dashboard`)
- [ ] "Needs Your Approval" is always visible immediately when there's a pending shift
- [ ] **Upcoming Activities** box shows a count; clicking reveals the list
- [ ] **Reports** box; clicking reveals a list of report links (currently one: Shift Report)

**Calendar** (`/client/calendar`) — activities across **every** linked Provider, add an activity
from a specific day

**Activities**
- [ ] **Add Activity**: Provider dropdown only appears with 2+ linked Providers; Preferred Worker
      and NDIS Support Type (searchable) scope to the selected Provider; Shift Time
      auto-detects overnight when end ≤ start; Recurrence picker; Medical Instructions checkbox
      list appears only if any are defined, and attaches to **every** occurrence generated for a
      new recurring activity
- [ ] **Edit Activity**: editing a recurring occurrence cascades title/description/time to every
      not-yet-completed sibling, but changing attached **Medical Instructions only affects that
      one occurrence** (does not cascade)
- [ ] **Approve/Reject** a completed shift: star rating required to approve, comments optional,
      rejecting requires a reason; **approving returns you to the previous screen**
- [ ] A completed activity's detail page shows read-only Medical Instructions given/not-given
      state and each Counter's tally for that specific shift

**Details** (`/client/details`) — self-edit, notify Providers on save, links to Medical
Instructions / Counters / Reports

**Medical Instructions** (`/client/medical-instructions`) — add/edit/delete

**Counters** (`/client/counters`) — add/delete, title capped at 30 characters, unique per Client

**Notes** (`/client/notes`) — past shifts with Worker comments

**Reports** (`/client/reports`)
- [ ] Date range enforces to > from, defaults to-date to from + 7
- [ ] Each shift shows date/day/start/end/worker/NDIS code/status/cost, with cost matching what
      the same shift would show on a real invoice
- [ ] Provider column only appears if the Client has more than one linked Provider
- [ ] Subtotal/GST/Total summary matches the sum of the visible rows

## 5. Administrator Role

- [ ] Non-administrator accounts cannot reach `/admin/*` (redirected/blocked)
- [ ] Providers list, Add Provider, Provider detail/edit all work
- [ ] NDIS Master catalogue: add/edit master items, confirm they're the source Providers pick
      from when building their own NDIS item list

## 6. Cross-Role Data Isolation & Security

This is the highest-value section given the bugs found this session — treat it as non-negotiable
before any release, using the shared Client/Worker from §0:

- [ ] Provider A's invoice **Generate → Preview** never shows the shared Worker's shifts that
      belong to Provider B
- [ ] Provider A cannot open Provider B's invoice detail page by editing the URL, and cannot mark
      it as paid via a direct API call
- [ ] Provider A's dashboards, reports, calendar, and schedules never show Provider B's activities
      for the shared Client/Worker
- [ ] A Client cannot view another Client's activities, Medical Instructions, Counters, or
      Reports by guessing/editing an id in the URL
- [ ] A Worker cannot view another Worker's shifts or details by guessing/editing an id
- [ ] Note for future work: RLS on most tables is intentionally coarse ("any authenticated user"),
      so isolation is enforced at the query layer (`.eq('provider_id', ...)` etc.) rather than the
      database — **any new query added in a future session touching `activities`, `invoices`, or
      similar shared tables should be checked for this same class of missing-scope bug**

## 7. Recurring Schedules & Activities (deep focus)

- [ ] Creating a recurring schedule/activity respects `valid_from`/`valid_until` when generating
      its initial window
- [ ] Editing a Provider-side schedule cascades to already-generated, not-yet-completed activities
- [ ] Editing a Client-created recurring activity cascades the same way, but Medical Instruction
      attachment edits are per-occurrence only
- [ ] Changing a recurrence pattern adds new implied occurrences without deleting existing ones
- [ ] Auto-extension on Provider login tops up any schedule under 4 weeks remaining, skips
      schedules past `valid_until`, and a forced Supabase error doesn't prevent the Provider's
      page from loading
- [ ] Deleting a recurring activity offers "this only" vs "this and future"
- [ ] Accepting one occurrence of a recurring series bulk-accepts sibling `awaiting_acceptance`
      occurrences
- [ ] Overnight shifts (end time ≤ start time) compute correct duration everywhere: activity
      detail, invoicing, Client Reports, Worker Completed Shifts

## 8. Invoicing & Billing (deep focus)

- [ ] Client-charge amount = `unit_price × (client_charge_pct_override ?? provider.client_charge_pct) / 100 × hours`,
      consistent across invoice generation, Client Reports, and the invoice PDF
- [ ] Worker-pay amount = same formula using `worker_pay_pct`, consistent between real invoice
      generation and the Worker dashboard's Completed Shifts payment-due figure
- [ ] GST computed from the Provider's own `gst_rate`
- [ ] Invoice PDF: line items readable, NDIS code + description shown, divider lines don't run
      through row text, the TOTAL highlight box doesn't overlap the GST row above it, Payment
      Details + footer sit in a consistent spot near the bottom on both a short and a long invoice
- [ ] Reissue only ever touches non-paid invoices

## 9. Notifications / Email

Trigger at least one of each and confirm the email arrives with correct data (check Brevo
dashboard/logs if the recipient inbox isn't available): activity assigned, activity accepted,
activity declined, shift submitted, shift approved, shift rejected, payment approved, activity
details changed, details updated (Client/Worker profile save), and the welcome/invite email.

- [ ] A slow/unreachable Brevo does not hang the password-reset or login flow — confirm the
      timeout still shows a usable error state

## 10. Mobile & Responsive

- [ ] Form inputs don't trigger persistent iOS Safari zoom, including after a client-side
      navigation (e.g. right after login)
- [ ] Viewport renders at actual device width on Worker/Client mobile views, not scaled-down desktop
- [ ] Client/Worker bottom nav reaches every destination with correct active-state highlighting

## 11. Regression Checklist (fast pass before release)

Quick-hit table of specific historical bugs — confirm each one is *still* fixed:

| # | Bug | Confirm now |
|---|-----|-------------|
| 1 | Recurring schedule edits didn't reach generated shifts | Edit a schedule, already-generated activities update too |
| 2 | Invoice preview leaked another Provider's activities | Shared-worker scenario in §6 |
| 3 | Invoice detail page/Mark-as-Paid had no provider scoping | Direct-URL test in §6 |
| 4 | Invoice PDF divider ran through row text | Generate a multi-line invoice, inspect the PDF |
| 5 | Invoice TOTAL box overlapped the GST row | Same PDF |
| 6 | Invoice Payment Details/footer drifted with content length | Compare a short vs. long invoice PDF |
| 7 | Client Approve didn't return to previous screen | Approve a shift, confirm navigation |
| 8 | Password reset link hung indefinitely | §1 forgot-password flow |
| 9 | Add Worker didn't link `provider_carers` | §2 Workers, existing-email path |
| 10 | `work_phone`/`car_registration`/`abn` not editable anywhere | §2/§3 Worker details |
| 11 | Sidebar Logout had a gap below Settings | Visual check, Provider sidebar |
| 12 | Mobile input zoom persisted across navigation | §10 |
| 13 | Mobile viewport rendered at desktop width | §10 |
