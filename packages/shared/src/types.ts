import type { POSITIONS, SET_TYPES, SET_QUALITY_OPTIONS, ATTACK_RESULTS, BLOCK_RESULTS, DIG_RESULTS, ACTION_TYPES, POINT_TYPES, PASS_CONTEXTS } from './constants'

// ─── Primitives ─────────────────────────────────────────────────────────────

export type Position = (typeof POSITIONS)[number]
export type SetType = (typeof SET_TYPES)[number]
export type SetQuality = (typeof SET_QUALITY_OPTIONS)[number]
export type AttackResult = (typeof ATTACK_RESULTS)[number]
export type BlockResult = (typeof BLOCK_RESULTS)[number]
export type DigResult = (typeof DIG_RESULTS)[number]
export type ActionType = (typeof ACTION_TYPES)[number]
export type PointType = (typeof POINT_TYPES)[number]

/** Serve quality 0-4 */
export type ServeQuality = 0 | 1 | 2 | 3 | 4

/** Pass quality 0-3 */
export type PassQuality = 0 | 1 | 2 | 3

export type PassContext = (typeof PASS_CONTEXTS)[number]

// ─── Domain Entities ─────────────────────────────────────────────────────────

export interface Team {
  id: string
  name: string
  shortName: string
  color: string
  createdAt: number
}

export interface Player {
  id: string
  teamId: string
  name: string
  number: number | null
  position: Position
  isActive: boolean
  createdAt: number
}

export interface Season {
  id: string
  teamId: string
  name: string
  startDate: string | null
  endDate: string | null
  createdAt: number
}

export interface Match {
  id: string
  homeTeamId: string | null
  awayTeamId: string | null
  opponentName: string | null
  seasonId: string | null
  matchDate: string
  location: string | null
  notes: string | null
  format: 'bo3' | 'bo5'
  status: 'planned' | 'in_progress' | 'complete'
  createdAt: number
}

export interface SetRecord {
  id: string
  matchId: string
  setNumber: number
  homeScore: number
  awayScore: number
  homeStartingRotation: number | null
  awayStartingRotation: number | null
  firstServingTeamId: string | null
  status: 'planned' | 'in_progress' | 'complete'
  createdAt: number
}

export interface SetLineup {
  id: string
  setId: string
  teamId: string
  playerId: string
  rotationSlot: number
  createdAt: number
}

export interface Rally {
  id: string
  setId: string
  rallyNumber: number
  servingTeamId: string
  homeRotation: number
  awayRotation: number
  homeScoreBefore: number
  awayScoreBefore: number
  winningTeamId: string | null
  pointType: PointType | null
  createdAt: number
}

export interface RallyAction {
  id: string
  rallyId: string
  actionSequence: number
  actionType: ActionType
  playerId: string | null
  teamId: string

  // Serve
  serveQuality: ServeQuality | null

  // Pass
  passQuality: PassQuality | null

  // Set
  setType: SetType | null
  setQuality: SetQuality | null
  isAssist: boolean | null

  // Attack
  isFrontRow: boolean | null
  attackZone: number | null
  destX: number | null
  destY: number | null
  attackResult: AttackResult | null

  // Block / Dig (linked to attack)
  linkedActionId: string | null

  // Block
  blockResult: BlockResult | null

  // Dig
  digX: number | null
  digY: number | null
  digResult: DigResult | null

  createdAt: number
}

export interface RotationStats {
  id: string
  setId: string
  teamId: string
  rotationSlot: number
  pointsScored: number
  ralliesTotal: number
  sideoutWon: number
  sideoutTotal: number
  scoringWon: number
  scoringTotal: number
  updatedAt: number
}

// ─── Rally Draft (client-side only, not persisted until submit) ──────────────

export interface RallyActionDraft {
  actionType: ActionType
  playerId: string | null
  teamId: string | null

  // Serve
  serveQuality?: ServeQuality

  // Pass
  passQuality?: PassQuality
  passContext?: PassContext

  // Set
  setType?: SetType
  setQuality?: SetQuality

  // Attack
  isFrontRow?: boolean
  attackZone?: number
  destX?: number
  destY?: number
  attackResult?: AttackResult

  // Block
  linkedActionSequence?: number
  blockResult?: BlockResult

  // Dig
  digX?: number
  digY?: number
  digResult?: DigResult

  // Freeball / Overpass
  freeballResult?: 'over' | 'error'
}

/** Enriched lineup slot row returned by GET /sets/:setId/lineup (raw D1 snake_case) */
export interface LineupSlot {
  id: string
  set_id: string
  team_id: string
  player_id: string
  rotation_slot: number
  name: string
  number: number | null
  position: string
  created_at: number
}

/** Substitution event (raw D1 snake_case) */
export interface Substitution {
  id: string
  set_id: string
  team_id: string
  player_out_id: string
  player_in_id: string
  rotation_slot: number
  rally_number: number | null
  created_at: number
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

export interface PlayerStats {
  playerId: string
  playerName: string
  position: Position

  // Serving
  serveTotalAttempts: number
  serveErrors: number
  serveAces: number
  serveQualityAvg: number

  // Serve Receive (reception actions only)
  passTotalAttempts: number
  passQualityAvg: number
  passAced: number

  // Defensive passes — broken out by context
  digAttempts: number
  digQualityAvg: number
  freeballAttempts: number
  freeballQualityAvg: number
  blockCoverAttempts: number
  blockCoverQualityAvg: number

  // Overpasses (from any context)
  overpassAttempts: number
  overpassErrors: number

  // Setting
  setAssists: number
  setErrors: number
  setTotalAttempts: number

  // Attacking
  attackAttempts: number
  attackKills: number
  attackErrors: number
  attackEfficiency: number

  // Blocking
  soloBlocks: number
  assistedBlocks: number
  blockTouches: number
  blockErrors: number
}

export interface RotationBreakdown {
  slot: number
  sideoutPct: number
  scoringPct: number
  pointsScored: number
  ralliesTotal: number
}

export interface HeatMapPoint {
  x: number
  y: number
  result: AttackResult | DigResult
  playerId: string | null
}

// ─── API Payloads (for POST/PUT) ─────────────────────────────────────────────

export interface CreateTeamPayload {
  name: string
  shortName: string
  color?: string
}

export interface CreatePlayerPayload {
  name: string
  number?: number | null
  position: Position
}

export interface CreateSeasonPayload {
  name: string
  startDate?: string | null
  endDate?: string | null
}

export interface CreateMatchPayload {
  homeTeamId?: string | null
  awayTeamId?: string | null
  opponentName?: string | null
  seasonId?: string | null
  matchDate: string
  location?: string | null
  notes?: string | null
  format?: 'bo3' | 'bo5'
}

export interface CreateSetPayload {
  setNumber: number
  homeStartingRotation?: number | null
  awayStartingRotation?: number | null
  firstServingTeamId?: string | null
}

export interface UpsertLineupPayload {
  teamId: string
  slots: Array<{ rotationSlot: number; playerId: string }>
}

export interface CreateRallyPayload {
  servingTeamId: string | null
  homeScoreBefore: number
  awayScoreBefore: number
  homeRotation: number
  awayRotation: number
}

export interface SubmitRallyPayload {
  winningTeamId: string | null
  pointType: PointType
  actions: RallyActionDraft[]
}

export interface CreateRallyActionPayload {
  actions: RallyActionDraft[]
}

export type ProposalEntityType = 'team' | 'player' | 'match' | 'score_correction' | 'suggestion'
export type ProposalActionType = 'create' | 'update' | 'delete' | 'correct' | 'general'
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied'

export interface Proposal {
  id: string
  proposer_name: string
  proposer_email: string | null
  entity_type: ProposalEntityType
  action_type: ProposalActionType
  entity_id: string | null
  payload: string               // stored as JSON string or plain text
  manual_review: 0 | 1
  status: ProposalStatus
  reject_reason: string | null
  reviewed_by: string | null
  reviewed_at: number | null
  created_at: number
}

export interface CreateProposalPayload {
  proposerName: string
  proposerEmail?: string
  entityType: ProposalEntityType
  actionType: ProposalActionType
  entityId?: string
  payload: Record<string, unknown> | string
}

export interface CreateSubstitutionPayload {
  teamId: string
  playerOutId: string
  playerInId: string
  rotationSlot: number
  rallyNumber?: number | null
}
