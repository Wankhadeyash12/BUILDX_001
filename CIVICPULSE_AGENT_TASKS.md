# CivicPulse — Track 2 Build Instructions

**How to use this file:**
- **Cursor:** Open Composer/Agent mode, attach this file (`@CIVICPULSE_AGENT_TASKS.md`), and say: *"Implement TASK 1 through TASK 7 in order, in this repo. Confirm each task builds before starting the next."*
- **GitHub Copilot (agent mode / Workspace):** Open Copilot Chat in Agent mode, attach this file, and give the same instruction. If Copilot loses context on long multi-file edits, paste one `## TASK N` section at a time instead of the whole file.
- **Claude Code:** `claude "implement the tasks in CIVICPULSE_AGENT_TASKS.md, one at a time, confirm the build after each"`

Do **not** skip the CONTEXT section below when feeding a single task in isolation — the agent needs it to know the project shape.

---

## CONTEXT (include this with every task if pasting individually)

Repo: CivicPulse — `server/src/index.js` (Express + Mongoose + Socket.IO API), `client/src/App.jsx` (React + Vite frontend, single-file component structure). Hackathon project targeting **Track 2: Urban Infrastructure & Roads** (Nagpur civic hackathon).

The app lets citizens report civic issues (pothole, streetlight, water leakage, garbage, drainage) through a 4-step wizard (photo → location → category → review). Authorities manage reports through a role-gated dashboard. Scope every change around roads/infrastructure specifically: potholes, road damage, streetlights, and construction/work coordination are the priority; water leakage/garbage are secondary and shouldn't get new features.

**Constraints that apply to every task:**
- Every new external call (AI, image upload) must degrade gracefully — never block core report submission if it fails.
- Match the existing compact code style in the files already — don't introduce a different formatting convention or split single-line handlers into multi-line unless a task requires real new logic.
- Don't touch auth, JWT, or existing Socket.IO event wiring except where a task explicitly requires it.
- After each task, list any new env vars needed and add them to `.env.example`.

---

## TASK 1 — Fix photo persistence (currently broken, do this first)

`submitReport` in `client/src/App.jsx` picks a photo into component state but never sends it to the server — `images: [String]` on the Issue schema stays empty forever.

1. Convert the selected file to base64 client-side (or upload to Cloudinary/a free image host if an API key is configured) and include it in the `POST /api/issues` payload.
2. In `server/src/index.js`, update the `POST /api/issues` handler to accept and store the image (base64 string or hosted URL) into the existing `images: [String]` field.
3. If image upload/encoding fails, still allow the report to submit without a photo rather than failing the whole request.

---

## TASK 2 — AI photo classification + severity (Anthropic API, vision)

Replaces the always-503 `/api/ai/analyze-image` stub with a real call.

1. Implement `POST /api/ai/analyze-image` to accept a base64 image (+ optional description text) and call the Claude API (`model: claude-sonnet-4-6`, vision-capable) with a prompt requiring **strict JSON only**:
   ```json
   { "category": "POTHOLE|ROAD_DAMAGE|STREETLIGHT|WATER_LEAKAGE|GARBAGE|DRAINAGE|OTHER",
     "severity": "LOW|MEDIUM|HIGH|CRITICAL",
     "reasoning": "short string" }
   ```
2. Parse and validate the response; strip markdown code fences if present. On parse failure or API error, return `{ available: false }` — the client must fall back to manual category selection, never block submission.
3. In `LocationReportModal`, call this endpoint right after a photo is selected (on the step 1→2 transition). Pre-fill category + severity in step 3 from the result, but keep it citizen-editable.
4. Replace the fake "AI ANALYSIS 94% confident" static text (only present in the dead `ReportModal` component — see Task 7) with the real `reasoning` string in the review step of the actually-used `LocationReportModal`.

**Env var needed:** `ANTHROPIC_API_KEY` — add to `.env.example`, never hardcode.

---

## TASK 3 — Duplicate & cluster detection

1. In `POST /api/issues`, before creating a new document, query existing **open** issues (`status` not in `[RESOLVED, REJECTED]`) of the same `category` within ~50 meters using the existing `2dsphere` index (`$near` or `$geoNear`).
2. If a match exists: `$addToSet` the reporting user into that issue's `communityConfirmations` and return the **existing** issue with `{ merged: true }` in the response, instead of creating a new document.
3. On the client, when a report response has `merged: true`, show a toast like *"3 people have now reported this — merged into an existing report"* instead of the normal success message.

---

## TASK 4 — Auto department routing + SLA escalation

1. Add a `CATEGORY_DEPARTMENT_MAP` constant in `server/src/index.js`:
   ```js
   { POTHOLE: 'Road Maintenance', ROAD_DAMAGE: 'Road Maintenance', STREETLIGHT: 'Electrical Services',
     WATER_LEAKAGE: 'Water & Drainage', DRAINAGE: 'Water & Drainage', GARBAGE: 'Sanitation' }
   ```
   Set `department` automatically on issue creation instead of leaving it blank.
2. Add a `dueAt: Date` field to the Issue schema, computed at creation from severity: `CRITICAL` = 24h, `HIGH` = 72h, `MEDIUM` = 7 days, `LOW` = 14 days.
3. Add a computed "overdue" indicator (`dueAt < now && status not in [RESOLVED, REJECTED]`) exposed in `GET /api/issues` and `GET /api/authority/dashboard` responses.
4. On `AuthorityDashboard` in `App.jsx`, add an "Overdue" filter tab and KPI card alongside the existing status filters.

---

## TASK 5 — Cross-agency work coordination

1. Add a `RecentWork` Mongoose model: `{ department: String, description: String, location: { type: 'Point', coordinates: [Number] }, startDate: Date, endDate: Date }`, with a `2dsphere` index on `location`.
2. Add routes: `GET /api/recent-works` (public), `POST /api/recent-works` (auth, `AUTHORITY`/`ADMIN` only).
3. On `POST /api/issues`, after creating/merging, check whether the location falls within ~30m of an active `RecentWork` entry (`endDate` in the future or null). If so, include a warning in the response, e.g. *"This location had Water & Drainage work as of <date> — check before scheduling new work here."*
4. On the client's `CivicMap` component, add a toggleable overlay layer showing `RecentWork` entries with a distinct marker style from issue reports, so authorities can see recent work before assigning new digging.

---

## TASK 6 — Resolution verification loop

1. In `PATCH /api/issues/:id`, when `status` is being set to `RESOLVED`, require a `resolutionPhoto` field in the request body (base64 or URL) — reject with 400 if missing.
2. Add `citizenConfirmed: Boolean` (default `false`) to the Issue schema. Add `POST /api/issues/:id/confirm-resolution` (auth, only the original `reportedBy` user) that sets `citizenConfirmed: true`.
3. On the client's citizen "My reports" view, show a "Confirm this was fixed" button on any issue with `status: RESOLVED` and `citizenConfirmed: false`.
4. In the authority `IssueDetail` modal, require selecting/uploading a resolution photo before the "Resolved" status button becomes clickable.

---

## TASK 7 — Cleanup (do last, low-risk deletions)

1. Delete the unused `ReportModal` function in `App.jsx` — only `LocationReportModal` is actually rendered. Confirm no other references before removing.
2. Replace or remove hardcoded fake numbers not backed by real data:
   - Auth screen: "12,480+ reports resolved", "94% AI detection accuracy"
   - Citizen Overview section: "My active reports: 3", "Issues nearby: 28", "92% verification rate", "2.4h avg. response time", "4.8k citizens active"

   Compute real equivalents from the `issues` array/API where feasible — `CitizenAnalytics` already does this correctly; use it as the pattern. Remove the stat entirely if there's no real backing data yet.

---

## Suggested execution order for limited time

If you can't finish all seven: **1 → 2 → 3 → 4 → 7**, then 5 and 6 if time remains. Tasks 5 and 6 are the strongest differentiators but depend on 1 (photos) being solid first.
