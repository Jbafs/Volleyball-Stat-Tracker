# Volleyball Stat Tracker

A self-hosted volleyball statistics app for coaches. Track every touch of every rally — serve, receive, set, attack, dig, block — and review stats, heatmaps, and rotation breakdowns after the match.

## Features

- **Play-by-play entry** — film-review style point entry with a visual court diagram
- **Per-player stats** — kills, efficiency, aces, reception quality, digs, assists
- **Rotation breakdown** — sideout % and scoring % for each of the 6 rotation slots
- **Heatmaps** — attack destinations, dig positions, and reception locations
- **Season tracking** — W-L records, season stats, match history per team
- **Match recap** — full stat tables, top performers, rally log with admin correction
- **Proposal system** — non-admin users can suggest edits; admins review and apply them
- **Mobile-friendly** — responsive sidebar, works on phones and tablets

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Backend | Cloudflare Workers, Hono |
| Database | Cloudflare D1 (SQLite) |
| Package manager | pnpm workspaces |

Everything runs on Cloudflare's free tier.

---

## Prerequisites

Before starting, you'll need:

- [Node.js](https://nodejs.org) v18 or later
- [pnpm](https://pnpm.io/installation) — `npm install -g pnpm`
- A [Cloudflare account](https://cloudflare.com) (free)
- Wrangler CLI — `npm install -g wrangler`

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/volleyball-stat-tracker.git
cd volleyball-stat-tracker
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Log in to Cloudflare

```bash
wrangler login
```

This opens a browser window. Sign in with your Cloudflare account.

### 4. Create your D1 databases

You need two databases — one for local development, one for production.

```bash
# Development database
wrangler d1 create volleyball-stats

# Production database
wrangler d1 create volleyball-stats-prod
```

Each command will print output like this:

```
✅ Successfully created DB 'volleyball-stats'

[[d1_databases]]
binding = "DB"
database_name = "volleyball-stats"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` values.

### 5. Configure `wrangler.toml`

Copy the example config and fill in your database IDs:

```bash
cp worker/wrangler.example.toml worker/wrangler.toml
```

Open `worker/wrangler.toml` and replace the placeholder IDs with yours:

```toml
# Dev database (around line 16)
database_id = "YOUR_DEV_DATABASE_ID"   ← paste your dev ID here

# Prod database (around line 30)
database_id = "YOUR_PROD_DATABASE_ID"  ← paste your prod ID here
```

> `worker/wrangler.toml` is gitignored — your real IDs will never be committed.

### 6. Apply database migrations

This creates all the tables in your databases.

```bash
cd worker

# Apply to your local dev database
wrangler d1 migrations apply volleyball-stats

# Apply to your production database
wrangler d1 migrations apply volleyball-stats-prod --remote --env production

cd ..
```

### 7. Set your admin secret

This is the password you'll use to create the first admin account. Choose something strong.

```bash
cd worker
wrangler secret put SETUP_SECRET --env production
# Enter your secret when prompted
cd ..
```

For local development, create `worker/.dev.vars`:

```
SETUP_SECRET=any-local-dev-secret
```

> `.dev.vars` is already gitignored — don't commit it.

### 8. Build and deploy

```bash
# Build the frontend
pnpm --filter frontend build

# Deploy worker + frontend together to production
cd worker
wrangler deploy --env production
```

After this, your app is live at `https://volleyball-stat-tracker-production.YOUR_SUBDOMAIN.workers.dev`.

### 9. Create your admin account

Make a POST request to bootstrap the first admin. Replace the values below:

```bash
curl -X POST https://YOUR_WORKER_URL/api/v1/auth/setup \
  -H "Authorization: Bearer YOUR_SETUP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-admin-password"}'
```

You can also use a tool like [Postman](https://postman.com) or [Hoppscotch](https://hoppscotch.io) if you're not comfortable with `curl`.

Once this succeeds, go to your app URL and sign in at `/login`.

> The setup endpoint only works once — it's disabled after the first admin is created.

---

## Local Development

Run the frontend and backend simultaneously in two terminal windows:

**Terminal 1 — Frontend:**
```bash
pnpm --filter frontend dev
```
Opens at `http://localhost:5173`

**Terminal 2 — Worker:**
```bash
cd worker
wrangler dev
```
Runs locally at `http://localhost:8787`

The frontend dev server is pre-configured to proxy API calls to port 8787 automatically.

To create a local admin account during development:

```bash
curl -X POST http://localhost:8787/api/v1/auth/setup \
  -H "Authorization: Bearer any-local-dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'
```

---

## Deploying Updates

Whenever you change code:

```bash
# Rebuild the frontend
pnpm --filter frontend build

# Redeploy
cd worker && wrangler deploy --env production
```

If you add a new migration file (changes to the database schema):

```bash
cd worker
wrangler d1 migrations apply volleyball-stats-prod --remote --env production
```

---

## Project Structure

```
volleyball-stat-tracker/
├── frontend/          # React app (Vite + Tailwind)
│   └── src/
│       ├── features/  # Page components (matches, teams, entry, stats…)
│       ├── api/       # TanStack Query hooks
│       ├── store/     # Zustand state (match, rally, auth)
│       └── components/# Shared UI (court SVG, layout)
├── worker/            # Cloudflare Worker (Hono API)
│   ├── src/
│   │   └── routes/    # API route handlers
│   └── migrations/    # D1 SQL migration files
└── packages/
    └── shared/        # Types, schemas, constants shared by both
```

---

## License

MIT — see [LICENSE](LICENSE).
