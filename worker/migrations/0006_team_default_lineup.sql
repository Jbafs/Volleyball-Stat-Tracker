-- Add default lineup storage to teams
ALTER TABLE teams ADD COLUMN default_lineup TEXT;              -- JSON: {"1":"playerId","2":"playerId",...}
ALTER TABLE teams ADD COLUMN default_starting_rotation INTEGER;
