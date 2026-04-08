# Volleyball Stat Tracker — Developer Documentation

## Architecture Overview

Pnpm monorepo with three workspaces:

```
packages/shared/   — TypeScript types, Zod schemas, domain constants (shared by frontend + worker)
frontend/          — React 18 + Vite + Tailwind + Zustand + TanStack Query
worker/            — Cloudflare Workers + Hono + D1 (SQLite)
```

**Deploy:** `pnpm --filter frontend build` → `npx wrangler deploy --env production` (from `worker/`)
**Migrations:** `cd worker && npx wrangler d1 migrations apply volleyball-stats-prod --remote --env production`

---

## Database Schema

All IDs are `TEXT` (nanoid). All timestamps are `INTEGER` (Unix ms). D1 returns raw `snake_case` column names.

### `teams`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| name | TEXT | Full name |
| short_name | TEXT | Abbreviation |
| color | TEXT | Hex color, default `#3B82F6` |
| default_lineup | TEXT | JSON `{"1":"playerId",...}` slot→playerId map (nullable) |
| default_starting_rotation | INTEGER | 1–6, nullable |
| created_at | INTEGER | |

### `players`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| team_id | TEXT FK→teams | CASCADE delete |
| name | TEXT | |
| number | INTEGER | Jersey number, nullable |
| position | TEXT | `OH \| MB \| RS \| S \| L \| DS` |
| is_active | INTEGER | 0/1 boolean |
| created_at | INTEGER | |

### `seasons`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| team_id | TEXT FK→teams | CASCADE delete |
| name | TEXT | |
| start_date | TEXT | ISO date string, nullable |
| end_date | TEXT | ISO date string, nullable |
| created_at | INTEGER | |

### `matches`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| home_team_id | TEXT FK→teams | Nullable (SET NULL on delete) |
| away_team_id | TEXT FK→teams | Nullable (SET NULL on delete) |
| opponent_name | TEXT | For untracked opponents, nullable |
| season_id | TEXT FK→seasons | Nullable |
| match_date | TEXT | ISO date string |
| location | TEXT | Nullable |
| notes | TEXT | Nullable |
| status | TEXT | `planned \| in_progress \| complete` |
| created_at | INTEGER | |

### `sets`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| match_id | TEXT FK→matches | CASCADE delete |
| set_number | INTEGER | 1–5 |
| home_score | INTEGER | Current score |
| away_score | INTEGER | Current score |
| home_starting_rotation | INTEGER | 1–6, nullable |
| away_starting_rotation | INTEGER | 1–6, nullable |
| first_serving_team_id | TEXT FK→teams | Nullable |
| status | TEXT | `planned \| in_progress \| complete` |
| created_at | INTEGER | |
| | | UNIQUE(match_id, set_number) |

### `set_lineups`
Which player occupies each rotation slot for a given set/team combo.
Rotation slots: 1=right back (server), 2=right front, 3=middle front, 4=left front, 5=left back, 6=middle back.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| set_id | TEXT FK→sets | CASCADE delete |
| team_id | TEXT FK→teams | |
| player_id | TEXT FK→players | |
| rotation_slot | INTEGER | 1–6 |
| created_at | INTEGER | |
| | | UNIQUE(set_id, team_id, rotation_slot) |
| | | UNIQUE(set_id, team_id, player_id) |

### `substitutions`
Player swap events during a set.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| set_id | TEXT FK→sets | CASCADE delete |
| team_id | TEXT FK→teams | |
| player_out_id | TEXT FK→players | |
| player_in_id | TEXT FK→players | |
| rotation_slot | INTEGER | 1–6 |
| rally_number | INTEGER | Nullable — when in the set it happened |
| created_at | INTEGER | |

### `rallies`
One row per point played.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| set_id | TEXT FK→sets | CASCADE delete |
| rally_number | INTEGER | Sequential within set |
| serving_team_id | TEXT FK→teams | Nullable (0005 migration) |
| home_rotation | INTEGER | 1–6 — rotation at start of rally |
| away_rotation | INTEGER | 1–6 |
| home_score_before | INTEGER | Score before this point |
| away_score_before | INTEGER | Score before this point |
| winning_team_id | TEXT FK→teams | Null until submitted |
| point_type | TEXT | `kill \| ace \| block \| error \| other`, null until submitted |
| created_at | INTEGER | |
| | | UNIQUE(set_id, rally_number) |

> A rally shell (winning_team_id IS NULL, point_type IS NULL) is created at rally start and deleted/replaced if the user navigates away without submitting.

### `rally_actions`
Every touch in every rally. This is the core stat table.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| rally_id | TEXT FK→rallies | CASCADE delete |
| action_sequence | INTEGER | 1-based order within rally |
| action_type | TEXT | `serve \| pass \| set \| attack \| dig \| block \| overpass` |
| player_id | TEXT FK→players | Nullable (unknown player) |
| team_id | TEXT FK→teams | Nullable (untracked opponent) |
| serve_quality | INTEGER | 0–4 (0=error, 1=easy, 2=pressured, 3=out-of-system, 4=ace) |
| pass_quality | INTEGER | 0–3 (0=aced, 1=poor, 2=good, 3=perfect) |
| set_type | TEXT | `quick \| outside \| right_side \| pipe \| back_row \| other` |
| set_quality | TEXT | `on_target \| tight \| off_net \| error` |
| is_assist | INTEGER | 0/1 — set auto-flagged when the next attack is a kill |
| is_front_row | INTEGER | 0/1 — for attacks |
| attack_zone | INTEGER | 1–9 net zone (front row) or 1/5/6 (back row) |
| dest_x | REAL | 0–1 normalized X of attack destination |
| dest_y | REAL | 0–1 normalized Y of attack destination |
| attack_result | TEXT | `kill \| error \| in_play \| blocked` |
| linked_action_id | TEXT FK→rally_actions | Block/dig links back to the attack it responded to |
| block_result | TEXT | `solo_block \| assisted_block \| block_touch \| block_error` |
| dig_x | REAL | 0–1 normalized X of dig position |
| dig_y | REAL | 0–1 normalized Y of dig position |
| dig_result | TEXT | `good_dig \| poor_dig \| no_dig` |
| freeball_result | TEXT | `over \| error` — for `overpass` action_type only |
| created_at | INTEGER | |
| | | UNIQUE(rally_id, action_sequence) |

### `rotation_stats`
Denormalized per-rotation aggregates, updated atomically with each rally submit.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| set_id | TEXT FK→sets | CASCADE delete |
| team_id | TEXT FK→teams | |
| rotation_slot | INTEGER | 1–6 |
| points_scored | INTEGER | Points won in this rotation |
| rallies_total | INTEGER | Total rallies played in this rotation |
| sideout_won | INTEGER | Sideouts won (receiving team won the point) |
| sideout_total | INTEGER | Total sideout opportunities |
| scoring_won | INTEGER | Scoring runs won (serving team won the point) |
| scoring_total | INTEGER | Total scoring run opportunities |
| updated_at | INTEGER | |
| | | UNIQUE(set_id, team_id, rotation_slot) |

### `users`
Admin accounts only. No public registration.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | PBKDF2-SHA256, stored as `salt:hash` base64 |
| role | TEXT | Always `admin` |
| created_at | INTEGER | |

### `sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | 32 random bytes as hex |
| user_id | TEXT FK→users | CASCADE delete |
| expires_at | INTEGER | Unix ms |
| created_at | INTEGER | |

### `proposals`
Public change request queue. Anyone can submit; admins review.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| proposer_name | TEXT | |
| proposer_email | TEXT | Nullable |
| entity_type | TEXT | `team \| player \| match \| score_correction \| suggestion` |
| action_type | TEXT | `create \| update \| delete \| correct \| general` |
| entity_id | TEXT | Null for create/suggestion |
| payload | TEXT | JSON (structured) or free text (manual) |
| manual_review | INTEGER | 0=auto-apply on approval, 1=admin applies by hand |
| status | TEXT | `pending \| approved \| rejected \| applied` |
| reject_reason | TEXT | Nullable |
| reviewed_by | TEXT FK→users | Nullable |
| reviewed_at | INTEGER | Nullable |
| created_at | INTEGER | |

---

## Migration History

| File | What it does |
|------|-------------|
| `0001_initial.sql` | Full initial schema: teams, players, seasons, matches, sets, set_lineups, rallies, rally_actions, rotation_stats |
| `0002_indexes.sql` | Performance indexes on foreign keys |
| `0003_nullable_team_id.sql` | rally_actions.team_id made nullable (for untracked opponents) |
| `0004_substitutions.sql` | Adds `substitutions` table |
| `0005_nullable_serving_team.sql` | rallies.serving_team_id made nullable |
| `0006_team_default_lineup.sql` | Adds `default_lineup` (JSON TEXT) and `default_starting_rotation` to teams |
| `0007_auth.sql` | Adds `users` + `sessions` tables |
| `0008_proposals.sql` | Adds `proposals` table |
| `0009_freeball.sql` | Recreates `rally_actions` to add `freeball_result` column + `overpass` to action_type CHECK |

> **SQLite note:** Columns with CHECK constraints cannot be added via `ALTER TABLE ADD COLUMN`. Migration 0009 recreates the table via `CREATE TABLE ... AS SELECT` pattern with `PRAGMA foreign_keys = OFF`.

---

## API Routes

All routes are prefixed `/api/v1/`. GET routes are public. Write routes (`POST/PUT/PATCH/DELETE`) require `Authorization: Bearer <token>` except `POST /proposals` (public) and `POST /auth/setup` (gated by `SETUP_SECRET`).

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/setup` | SETUP_SECRET | Bootstrap first admin (only works when users table is empty) |
| POST | `/auth/login` | — | Returns session token |
| POST | `/auth/logout` | Bearer token | Deletes session |
| GET | `/auth/me` | Bearer token | Returns current user |

### Teams
| Method | Path | Description |
|--------|------|-------------|
| GET | `/teams` | List all teams |
| POST | `/teams` | Create team |
| GET | `/teams/:teamId` | Get team |
| PUT | `/teams/:teamId` | Update team |
| GET | `/teams/:teamId/players` | List players |
| POST | `/teams/:teamId/players` | Create player |
| GET | `/teams/:teamId/stats` | Aggregated player stats |
| PUT | `/teams/:teamId/default-lineup` | Save default lineup |

### Seasons / Matches / Sets
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/teams/:teamId/seasons` | List/create seasons |
| GET/POST | `/matches` | List/create matches |
| GET | `/matches/:matchId` | Get match |
| PUT | `/matches/:matchId` | Update match |
| GET | `/matches/:matchId/sets` | List sets |
| POST | `/matches/:matchId/sets` | Create set |
| PUT | `/sets/:setId` | Update set (score, status, etc.) |
| GET/POST | `/sets/:setId/lineup` | Get/upsert set lineup |
| GET/POST | `/sets/:setId/substitutions` | Get/create substitution |

### Rallies
| Method | Path | Description |
|--------|------|-------------|
| GET | `/sets/:setId/rallies` | List rallies in set |
| POST | `/sets/:setId/rallies` | Create rally shell (pre-submission) — cleans up orphaned shells first |
| POST | `/rallies/:rallyId/submit` | Submit rally with all actions + point outcome (atomic batch) |
| GET | `/rallies/:rallyId` | Get rally |
| GET | `/rallies/:rallyId/actions` | List actions for rally |
| DELETE | `/rallies/:rallyId` | Delete rally + reverse scores + reverse rotation_stats |

### Stats
| Method | Path | Description |
|--------|------|-------------|
| GET | `/sets/:setId/stats` | Per-player stats for a set |
| GET | `/matches/:matchId/stats` | Per-player stats for a match |
| GET | `/teams/:teamId/heatmap` | Attack/dig coordinate data for heatmap |
| GET | `/sets/:setId/rotation-breakdown` | Rotation stats for a set |

### Proposals
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/proposals` | — | Submit proposal (public) |
| GET | `/proposals` | Admin | List proposals |
| GET | `/proposals/count` | Admin | Pending count (for badge) |
| GET | `/proposals/:id` | Admin | Get proposal |
| PATCH | `/proposals/:id` | Admin | Review (approve/reject/applied) |

---

## Entry Flow State Machine

Rally entry is managed by `rallyStore` (Zustand) in `frontend/src/store/rallyStore.ts`.

### Steps
`idle → serve → pass → set → attack → (dig | block) → point_outcome → idle`

### `nextStepAfterAction` routing
| Action | Condition | Next step |
|--------|-----------|-----------|
| serve | quality=4 (ace) or quality=0 (error) | point_outcome |
| serve | quality 1–3 | pass |
| pass | quality=0 (aced) | point_outcome |
| pass | quality 1–3 | set |
| set | any | attack |
| attack | kill or error | point_outcome |
| attack | blocked | block |
| attack | in_play | dig |
| block | solo_block, assisted_block, block_error | point_outcome |
| block | block_touch | dig |
| dig | good_dig | set |
| dig | poor_dig or no_dig | point_outcome |
| overpass | freeballResult=error | point_outcome |
| overpass | freeballResult=over | dig |

### `switchStep` vs `goToStep`
- `goToStep(step)` — used when committing an action; pushes to `stepHistory`
- `switchStep(step)` — used by the touch type bar; changes step without touching history (state resets on unmount/remount)
- `goBack()` — pops `stepHistory`, removes last action from `actions[]`

### Team detection per step (auto, overridable via TeamToggle)
| Step | Auto-detection logic |
|------|---------------------|
| PassStep | Opponent of serving team |
| SetStep | Team of last pass or dig action |
| AttackStep | After set → set team; after overpass → opponent of overpass team; after pass/dig → that team |
| DigStep | Opponent of last attack/overpass; if no attack yet → team of last pass/dig |
| BlockStep | Opponent of last attack/overpass |

---

## Domain Constants

Defined in `packages/shared/src/constants.ts`, also exported from `@vst/shared`:

| Constant | Values |
|----------|--------|
| `SERVE_QUALITY_LABELS` | 0=Serve Error, 1=Easy Pass, 2=Pressured, 3=Out of System, 4=Ace |
| `PASS_QUALITY_LABELS` | 0=Aced, 1=Poor (Out of System), 2=Good (In System), 3=Perfect |
| `SET_TYPES` | quick, outside, right_side, pipe, back_row, other |
| `SET_QUALITY_OPTIONS` | on_target, tight, off_net, error |
| `ATTACK_RESULTS` | kill, error, in_play, blocked |
| `BLOCK_RESULTS` | solo_block, assisted_block, block_touch, block_error |
| `DIG_RESULTS` | good_dig, poor_dig, no_dig |
| `FREEBALL_RESULTS` | over, error |
| `POINT_TYPES` | kill, ace, block, error, other |
| `NET_ZONE_LABELS` | Zone 1–9 along the net (1=left pin, 5=middle, 9=right pin) |
| `BACK_ROW_ZONES` | Zone 5=left back, 6=middle/pipe, 1=right back/bic |

---

## Key Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/store/rallyStore.ts` | Entry flow state machine, `nextStepAfterAction`, `inferPointOutcome` |
| `frontend/src/store/matchStore.ts` | Active match context: scores, rotations, lineups, servingTeamId |
| `frontend/src/store/authStore.ts` | Auth state, token persisted to localStorage |
| `frontend/src/api/client.ts` | Injects `Authorization: Bearer` on every request |
| `frontend/src/features/entry/EntryPage.tsx` | Main entry orchestrator: creates rally, submits rally, touch type bar |
| `frontend/src/features/entry/steps/StepShell.tsx` | Shared UI components: StepShell, PlayerPicker, QualityPicker, TeamToggle |
| `frontend/src/features/entry/steps/ServeStep.tsx` | Serve recording |
| `frontend/src/features/entry/steps/PassStep.tsx` | Pass + freeball/overpass recording with mode toggle |
| `frontend/src/features/entry/steps/SetStep.tsx` | Set recording |
| `frontend/src/features/entry/steps/AttackStep.tsx` | Attack + freeball mode recording |
| `frontend/src/features/entry/steps/DigStep.tsx` | Dig recording (handles block cover context) |
| `frontend/src/features/entry/steps/BlockStep.tsx` | Block recording |
| `frontend/src/features/entry/PointOutcomeStep.tsx` | Final point outcome (auto-inferred or manual) |
| `frontend/src/features/entry/RallyTimeline.tsx` | Right panel: current rally actions + set history |
| `frontend/src/components/court/CourtSVG.tsx` | SVG court: zone select, coord pick, heatmap modes |
| `frontend/src/router.tsx` | All routes |

---

## Key Worker Files

| File | Purpose |
|------|---------|
| `worker/src/index.ts` | App entrypoint, middleware, route mounting, SPA fallback |
| `worker/src/db/client.ts` | D1 helpers: `query`, `queryOne`, `execute`, `newId`, `Env` type |
| `worker/src/routes/rallies.ts` | Rally CRUD, batch action insert, rotation_stats upsert |
| `worker/src/routes/sets.ts` | Set CRUD, lineup upsert, substitutions |
| `worker/src/routes/auth.ts` | Login, logout, me, setup |
| `worker/src/routes/proposals.ts` | Proposal queue CRUD + auto-apply on approval |
| `worker/src/routes/stats.ts` | Player stats, heatmap, rotation breakdown aggregations |
| `worker/src/services/rotationService.ts` | `computeNextRotations` — sideout logic |
| `worker/src/services/crypto.ts` | PBKDF2 `hashPassword`, `verifyPassword`, `generateToken` |
| `worker/src/middleware/auth.ts` | `requireAuth`, `optionalAuth` middleware |
| `worker/migrations/` | All D1 migration SQL files |

---

## Wrangler Config Notes

- DB binding name: `DB` (database: `volleyball-stats-prod` in production)
- ASSETS binding: `ASSETS` (required for SPA fallback — serves `index.html` for non-API paths)
- Secret: `SETUP_SECRET` (set via `npx wrangler secret put SETUP_SECRET --env production`)
- Production env: `--env production` flag required for all deploy/migration commands
