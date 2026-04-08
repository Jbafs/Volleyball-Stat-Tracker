-- Add pass_context column to rally_actions to distinguish dig / freeball / block_cover passes.
-- Full table recreation required because of the existing CHECK constraint on action_type.

PRAGMA foreign_keys = OFF;

CREATE TABLE rally_actions_new (
  id                TEXT PRIMARY KEY,
  rally_id          TEXT NOT NULL REFERENCES rallies(id) ON DELETE CASCADE,
  action_sequence   INTEGER NOT NULL,
  action_type       TEXT NOT NULL CHECK(action_type IN (
                      'serve','reception','pass','set','attack','dig','block','overpass'
                    )),
  pass_context      TEXT CHECK(pass_context IN ('dig','freeball','block_cover')),
  player_id         TEXT REFERENCES players(id),
  team_id           TEXT REFERENCES teams(id),
  serve_quality     INTEGER CHECK(serve_quality BETWEEN 0 AND 4),
  pass_quality      INTEGER CHECK(pass_quality BETWEEN 0 AND 3),
  set_type          TEXT CHECK(set_type IN ('quick','outside','right_side','pipe','back_row','other')),
  set_quality       TEXT CHECK(set_quality IN ('on_target','tight','off_net','error')),
  is_assist         INTEGER,
  is_front_row      INTEGER,
  attack_zone       INTEGER CHECK(attack_zone BETWEEN 1 AND 9),
  dest_x            REAL,
  dest_y            REAL,
  attack_result     TEXT CHECK(attack_result IN ('kill','error','in_play','blocked')),
  linked_action_id  TEXT REFERENCES rally_actions_new(id),
  block_result      TEXT CHECK(block_result IN ('solo_block','assisted_block','block_touch','block_error')),
  dig_x             REAL,
  dig_y             REAL,
  dig_result        TEXT CHECK(dig_result IN ('good_dig','poor_dig','no_dig')),
  freeball_result   TEXT CHECK(freeball_result IN ('over','error')),
  created_at        INTEGER NOT NULL,
  UNIQUE(rally_id, action_sequence)
);

INSERT INTO rally_actions_new SELECT
  id, rally_id, action_sequence, action_type,
  NULL,
  player_id, team_id,
  serve_quality, pass_quality,
  set_type, set_quality, is_assist,
  is_front_row, attack_zone, dest_x, dest_y, attack_result,
  linked_action_id,
  block_result,
  dig_x, dig_y, dig_result,
  freeball_result,
  created_at
FROM rally_actions;

DROP TABLE rally_actions;
ALTER TABLE rally_actions_new RENAME TO rally_actions;

PRAGMA foreign_keys = ON;

CREATE INDEX idx_rally_actions_rally  ON rally_actions(rally_id);
CREATE INDEX idx_rally_actions_player ON rally_actions(player_id);
CREATE INDEX idx_rally_actions_type   ON rally_actions(action_type);
CREATE INDEX idx_rally_actions_linked ON rally_actions(linked_action_id);
