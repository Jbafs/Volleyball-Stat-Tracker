import { z } from 'zod'
import { POSITIONS, SET_TYPES, SET_QUALITY_OPTIONS, ATTACK_RESULTS, BLOCK_RESULTS, DIG_RESULTS, ACTION_TYPES, POINT_TYPES, PASS_CONTEXTS } from './constants'

// ─── Primitives ───────────────────────────────────────────────────────────────

export const serveQualitySchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)
])

export const passQualitySchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3)
])

export const positionSchema = z.enum(POSITIONS)
export const setTypeSchema = z.enum(SET_TYPES)
export const setQualitySchema = z.enum(SET_QUALITY_OPTIONS)
export const attackResultSchema = z.enum(ATTACK_RESULTS)
export const blockResultSchema = z.enum(BLOCK_RESULTS)
export const digResultSchema = z.enum(DIG_RESULTS)
export const actionTypeSchema = z.enum(ACTION_TYPES)
export const pointTypeSchema = z.enum(POINT_TYPES)

// ─── Entity Creation Schemas ──────────────────────────────────────────────────

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  shortName: z.string().min(1).max(10),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#3B82F6'),
})

export const createPlayerSchema = z.object({
  name: z.string().min(1).max(100),
  number: z.number().int().min(0).max(99).nullable().optional(),
  position: positionSchema,
})

export const createSeasonSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})

export const createMatchSchema = z.object({
  homeTeamId: z.string().nullable().optional(),
  awayTeamId: z.string().nullable().optional(),
  opponentName: z.string().max(100).nullable().optional(),
  seasonId: z.string().nullable().optional(),
  matchDate: z.string().min(1),
  location: z.string().max(200).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  format: z.enum(['bo3', 'bo5']).default('bo3'),
}).refine(
  (d) => d.homeTeamId != null || d.awayTeamId != null,
  { message: 'At least one team must be a tracked team' }
)

export const createSetSchema = z.object({
  setNumber: z.number().int().min(1).max(5),
  homeStartingRotation: z.number().int().min(1).max(6).nullable().optional(),
  awayStartingRotation: z.number().int().min(1).max(6).nullable().optional(),
  firstServingTeamId: z.string().nullable().optional(),
})

export const updateSetSchema = z.object({
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
  homeStartingRotation: z.number().int().min(1).max(6).nullable().optional(),
  awayStartingRotation: z.number().int().min(1).max(6).nullable().optional(),
  firstServingTeamId: z.string().nullable().optional(),
  status: z.enum(['planned', 'in_progress', 'complete']).optional(),
})

export const updateMatchSchema = z.object({
  matchDate: z.string().min(1).optional(),
  location: z.string().max(200).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  seasonId: z.string().nullable().optional(),
  format: z.enum(['bo3', 'bo5']).optional(),
})

export const upsertLineupSchema = z.object({
  teamId: z.string(),
  slots: z.array(z.object({
    rotationSlot: z.number().int().min(1).max(6),
    playerId: z.string(),
  })).min(1).max(6),
})

// ─── Rally Action Draft Schema ────────────────────────────────────────────────

export const rallyActionDraftSchema = z.object({
  actionType: actionTypeSchema,
  playerId: z.string().nullable(),
  teamId: z.string().nullable(),

  // Serve
  serveQuality: serveQualitySchema.optional(),

  // Pass
  passQuality: passQualitySchema.optional(),
  passContext: z.enum(PASS_CONTEXTS).optional(),

  // Set
  setType: setTypeSchema.optional(),
  setQuality: setQualitySchema.optional(),

  // Attack
  isFrontRow: z.boolean().optional(),
  attackZone: z.number().int().min(1).max(9).optional(),
  destX: z.number().min(0).max(1).optional(),
  destY: z.number().min(0).max(1).optional(),
  attackResult: attackResultSchema.optional(),

  // Block
  linkedActionSequence: z.number().int().min(0).optional(),
  blockResult: blockResultSchema.optional(),

  // Dig
  digX: z.number().min(0).max(1).optional(),
  digY: z.number().min(0).max(1).optional(),
  digResult: digResultSchema.optional(),

  // Freeball / Overpass
  freeballResult: z.enum(['over', 'error']).optional(),
})

export const createSubstitutionSchema = z.object({
  teamId: z.string(),
  playerOutId: z.string(),
  playerInId: z.string(),
  rotationSlot: z.number().int().min(1).max(6),
  rallyNumber: z.number().int().min(1).nullable().optional(),
}).refine(
  (d) => d.playerOutId !== d.playerInId,
  { message: 'Player in and player out must be different', path: ['playerInId'] }
)

export const createRallySchema = z.object({
  servingTeamId: z.string().nullable(),
  homeScoreBefore: z.number().int().min(0),
  awayScoreBefore: z.number().int().min(0),
  homeRotation: z.number().int().min(1).max(6),
  awayRotation: z.number().int().min(1).max(6),
})

export const submitRallySchema = z.object({
  winningTeamId: z.string(),
  pointType: pointTypeSchema,
  actions: z.array(rallyActionDraftSchema).min(0),
})

export const createProposalSchema = z.object({
  proposerName: z.string().min(1).max(100),
  proposerEmail: z.string().email().optional(),
  entityType: z.enum(['team', 'player', 'match', 'score_correction', 'suggestion']),
  actionType: z.enum(['create', 'update', 'delete', 'correct', 'general']),
  entityId: z.string().optional(),
  // Structured payload (team/player/match changes) or free-text description
  payload: z.union([z.record(z.unknown()), z.string()]),
})

export const reviewProposalSchema = z.object({
  status: z.enum(['approved', 'rejected', 'applied']),
  rejectReason: z.string().max(500).optional(),
})

export const updateTeamDefaultLineupSchema = z.object({
  defaultLineup: z.record(z.string(), z.string()),
  defaultStartingRotation: z.number().int().min(1).max(6).optional(),
})
