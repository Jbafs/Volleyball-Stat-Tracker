-- Track player substitutions during a set
CREATE TABLE substitutions (
  id              TEXT PRIMARY KEY,
  set_id          TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  team_id         TEXT NOT NULL REFERENCES teams(id),
  player_out_id   TEXT NOT NULL REFERENCES players(id),
  player_in_id    TEXT NOT NULL REFERENCES players(id),
  rotation_slot   INTEGER NOT NULL CHECK(rotation_slot BETWEEN 1 AND 6),
  rally_number    INTEGER,
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_substitutions_set_id ON substitutions(set_id);
CREATE INDEX idx_substitutions_team_id ON substitutions(team_id);
