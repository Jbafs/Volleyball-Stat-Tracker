-- ============================================================
-- TEAMS & PLAYERS
-- ============================================================

CREATE TABLE teams (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  short_name  TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#3B82F6',
  created_at  INTEGER NOT NULL
);

CREATE TABLE players (
  id          TEXT PRIMARY KEY,
  team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  number      INTEGER,
  position    TEXT NOT NULL CHECK(position IN ('OH','MB','RS','S','L','DS')),
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

-- ============================================================
-- SEASONS & MATCHES
-- ============================================================

CREATE TABLE seasons (
  id          TEXT PRIMARY KEY,
  team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  start_date  TEXT,
  end_date    TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE matches (
  id              TEXT PRIMARY KEY,
  home_team_id    TEXT REFERENCES teams(id) ON DELETE SET NULL,
  away_team_id    TEXT REFERENCES teams(id) ON DELETE SET NULL,
  opponent_name   TEXT,
  season_id       TEXT REFERENCES seasons(id) ON DELETE SET NULL,
  match_date      TEXT NOT NULL,
  location        TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'planned'
                  CHECK(status IN ('planned','in_progress','complete')),
  created_at      INTEGER NOT NULL
);

-- ============================================================
-- SETS
-- ============================================================

CREATE TABLE sets (
  id                      TEXT PRIMARY KEY,
  match_id                TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  set_number              INTEGER NOT NULL,
  home_score              INTEGER NOT NULL DEFAULT 0,
  away_score              INTEGER NOT NULL DEFAULT 0,
  home_starting_rotation  INTEGER CHECK(home_starting_rotation BETWEEN 1 AND 6),
  away_starting_rotation  INTEGER CHECK(away_starting_rotation BETWEEN 1 AND 6),
  first_serving_team_id   TEXT REFERENCES teams(id),
  status                  TEXT NOT NULL DEFAULT 'planned'
                          CHECK(status IN ('planned','in_progress','complete')),
  created_at              INTEGER NOT NULL,
  UNIQUE(match_id, set_number)
);

-- Which player occupies each rotation slot for a given set
-- rotation_slot: 1=right back, 2=right front, 3=middle front,
--               4=left front, 5=left back, 6=middle back
CREATE TABLE set_lineups (
  id            TEXT PRIMARY KEY,
  set_id        TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  team_id       TEXT NOT NULL REFERENCES teams(id),
  player_id     TEXT NOT NULL REFERENCES players(id),
  rotation_slot INTEGER NOT NULL CHECK(rotation_slot BETWEEN 1 AND 6),
  created_at    INTEGER NOT NULL,
  UNIQUE(set_id, team_id, rotation_slot),
  UNIQUE(set_id, team_id, player_id)
);

-- ============================================================
-- RALLIES
-- ============================================================

CREATE TABLE rallies (
  id                  TEXT PRIMARY KEY,
  set_id              TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  rally_number        INTEGER NOT NULL,
  serving_team_id     TEXT NOT NULL REFERENCES teams(id),
  home_rotation       INTEGER NOT NULL CHECK(home_rotation BETWEEN 1 AND 6),
  away_rotation       INTEGER NOT NULL CHECK(away_rotation BETWEEN 1 AND 6),
  home_score_before   INTEGER NOT NULL DEFAULT 0,
  away_score_before   INTEGER NOT NULL DEFAULT 0,
  winning_team_id     TEXT REFERENCES teams(id),
  point_type          TEXT CHECK(point_type IN ('kill','ace','block','error','other')),
  created_at          INTEGER NOT NULL,
  UNIQUE(set_id, rally_number)
);

-- ============================================================
-- RALLY ACTIONS (normalized multi-touch model)
-- ============================================================

CREATE TABLE rally_actions (
  id                TEXT PRIMARY KEY,
  rally_id          TEXT NOT NULL REFERENCES rallies(id) ON DELETE CASCADE,
  action_sequence   INTEGER NOT NULL,
  action_type       TEXT NOT NULL CHECK(action_type IN (
                      'serve','pass','set','attack','dig','block'
                    )),
  player_id         TEXT REFERENCES players(id),
  team_id           TEXT NOT NULL REFERENCES teams(id),

  -- Serve (action_type = 'serve')
  serve_quality     INTEGER CHECK(serve_quality BETWEEN 0 AND 4),

  -- Pass (action_type = 'pass')
  pass_quality      INTEGER CHECK(pass_quality BETWEEN 0 AND 3),

  -- Set (action_type = 'set')
  set_type          TEXT CHECK(set_type IN ('quick','outside','right_side','pipe','back_row','other')),
  set_quality       TEXT CHECK(set_quality IN ('on_target','tight','off_net','error')),
  is_assist         INTEGER,

  -- Attack (action_type = 'attack')
  is_front_row      INTEGER,
  attack_zone       INTEGER CHECK(attack_zone BETWEEN 1 AND 9),
  dest_x            REAL,
  dest_y            REAL,
  attack_result     TEXT CHECK(attack_result IN ('kill','error','in_play','blocked')),

  -- Linked action (for block/dig → points to the attack action)
  linked_action_id  TEXT REFERENCES rally_actions(id),

  -- Block (action_type = 'block')
  block_result      TEXT CHECK(block_result IN ('solo_block','assisted_block','block_touch','block_error')),

  -- Dig (action_type = 'dig')
  dig_x             REAL,
  dig_y             REAL,
  dig_result        TEXT CHECK(dig_result IN ('good_dig','poor_dig','no_dig')),

  created_at        INTEGER NOT NULL,
  UNIQUE(rally_id, action_sequence)
);

-- ============================================================
-- ROTATION STATS (denormalized for fast reads)
-- ============================================================

CREATE TABLE rotation_stats (
  id              TEXT PRIMARY KEY,
  set_id          TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  team_id         TEXT NOT NULL REFERENCES teams(id),
  rotation_slot   INTEGER NOT NULL CHECK(rotation_slot BETWEEN 1 AND 6),
  points_scored   INTEGER NOT NULL DEFAULT 0,
  rallies_total   INTEGER NOT NULL DEFAULT 0,
  sideout_won     INTEGER NOT NULL DEFAULT 0,
  sideout_total   INTEGER NOT NULL DEFAULT 0,
  scoring_won     INTEGER NOT NULL DEFAULT 0,
  scoring_total   INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL,
  UNIQUE(set_id, team_id, rotation_slot)
);
