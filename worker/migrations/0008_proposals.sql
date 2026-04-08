-- Change proposal queue. Anyone (no login required) can submit a proposal.
-- Admins review, approve, reject, or manually apply them.
--
-- entity_type: team | player | match | score_correction | suggestion
-- action_type: create | update | delete | correct | general
-- manual_review: 1 = admin must apply by hand (score corrections, suggestions)
--               0 = system auto-applies the payload on approval
-- status: pending | approved | rejected | applied
--   'approved'  = auto-applied successfully
--   'applied'   = manually applied by admin
--   'rejected'  = rejected with optional reason

CREATE TABLE proposals (
  id            TEXT PRIMARY KEY,
  proposer_name TEXT NOT NULL,
  proposer_email TEXT,
  entity_type   TEXT NOT NULL,
  action_type   TEXT NOT NULL,
  entity_id     TEXT,            -- null for create / suggestion
  payload       TEXT NOT NULL,   -- JSON for structured; free-text for manual
  manual_review INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','approved','rejected','applied')),
  reject_reason TEXT,
  reviewed_by   TEXT REFERENCES users(id),
  reviewed_at   INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_entity ON proposals(entity_type, entity_id);
