-- Add indexes for frequently queried foreign-key columns that were missing.
-- rally_actions.team_id: stats queries filter by team_id
-- set_lineups.player_id: lineup joins on player_id

CREATE INDEX IF NOT EXISTS idx_rally_actions_team ON rally_actions(team_id);
CREATE INDEX IF NOT EXISTS idx_set_lineups_player ON set_lineups(player_id);
