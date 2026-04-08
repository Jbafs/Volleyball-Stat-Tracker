-- Performance indexes for common query patterns

CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_seasons_team ON seasons(team_id);
CREATE INDEX idx_matches_season ON matches(season_id);
CREATE INDEX idx_matches_home_team ON matches(home_team_id);
CREATE INDEX idx_matches_away_team ON matches(away_team_id);
CREATE INDEX idx_sets_match ON sets(match_id);
CREATE INDEX idx_set_lineups_set ON set_lineups(set_id);
CREATE INDEX idx_rallies_set ON rallies(set_id);
CREATE INDEX idx_rally_actions_rally ON rally_actions(rally_id);
CREATE INDEX idx_rally_actions_player ON rally_actions(player_id);
CREATE INDEX idx_rally_actions_type ON rally_actions(action_type);
CREATE INDEX idx_rally_actions_linked ON rally_actions(linked_action_id);
CREATE INDEX idx_rotation_stats_set_team ON rotation_stats(set_id, team_id);
