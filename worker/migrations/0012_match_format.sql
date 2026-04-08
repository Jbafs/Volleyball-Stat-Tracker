-- Add format column to matches (bo3 / bo5).
-- Full table recreation required because the existing CHECK constraint on `status`
-- prevents ALTER TABLE ADD COLUMN.
PRAGMA foreign_keys = OFF;

CREATE TABLE matches_new (
  id              TEXT PRIMARY KEY,
  home_team_id    TEXT REFERENCES teams(id) ON DELETE SET NULL,
  away_team_id    TEXT REFERENCES teams(id) ON DELETE SET NULL,
  opponent_name   TEXT,
  season_id       TEXT REFERENCES seasons(id) ON DELETE SET NULL,
  match_date      TEXT NOT NULL,
  location        TEXT,
  notes           TEXT,
  format          TEXT NOT NULL DEFAULT 'bo3' CHECK(format IN ('bo3','bo5')),
  status          TEXT NOT NULL DEFAULT 'planned'
                  CHECK(status IN ('planned','in_progress','complete')),
  created_at      INTEGER NOT NULL
);

INSERT INTO matches_new
  SELECT id, home_team_id, away_team_id, opponent_name, season_id,
         match_date, location, notes, 'bo3', status, created_at
  FROM matches;

DROP TABLE matches;
ALTER TABLE matches_new RENAME TO matches;

PRAGMA foreign_keys = ON;
