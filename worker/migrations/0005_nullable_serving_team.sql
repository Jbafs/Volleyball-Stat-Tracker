-- Make rallies.serving_team_id nullable to support matches against untracked opponents.
-- When the opponent (untracked away team) wins a rally and earns the serve,
-- serving_team_id is NULL, meaning "untracked team is serving".
-- Recreating the table is required because SQLite does not support ALTER COLUMN.

PRAGMA foreign_keys = OFF;

CREATE TABLE rallies_new (
  id                  TEXT PRIMARY KEY,
  set_id              TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  rally_number        INTEGER NOT NULL,
  serving_team_id     TEXT REFERENCES teams(id),
  home_rotation       INTEGER NOT NULL CHECK(home_rotation BETWEEN 1 AND 6),
  away_rotation       INTEGER NOT NULL CHECK(away_rotation BETWEEN 1 AND 6),
  home_score_before   INTEGER NOT NULL DEFAULT 0,
  away_score_before   INTEGER NOT NULL DEFAULT 0,
  winning_team_id     TEXT REFERENCES teams(id),
  point_type          TEXT CHECK(point_type IN ('kill','ace','block','error','other')),
  created_at          INTEGER NOT NULL,
  UNIQUE(set_id, rally_number)
);

INSERT INTO rallies_new SELECT * FROM rallies;
DROP TABLE rallies;
ALTER TABLE rallies_new RENAME TO rallies;

CREATE INDEX idx_rallies_set ON rallies(set_id);

PRAGMA foreign_keys = ON;
