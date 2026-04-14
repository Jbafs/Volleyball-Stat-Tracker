-- Make seasons global (independent of teams).
-- Previously seasons had team_id NOT NULL; now they are time periods that any
-- match can reference. A team's seasons are derived via the matches they played.
--
-- Full table recreation required because SQLite does not support DROP COLUMN.

PRAGMA foreign_keys = OFF;

CREATE TABLE seasons_new (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  start_date TEXT,
  end_date   TEXT,
  created_at INTEGER NOT NULL
);

INSERT INTO seasons_new
  SELECT id, name, start_date, end_date, created_at
  FROM seasons;

DROP TABLE seasons;
ALTER TABLE seasons_new RENAME TO seasons;

DROP INDEX IF EXISTS idx_seasons_team;

PRAGMA foreign_keys = ON;
