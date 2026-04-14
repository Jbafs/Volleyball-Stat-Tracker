import { create } from 'zustand'
import type { RallyActionDraft, PointType } from '@vst/shared'

export type EntryStep =
  | 'serve'
  | 'receive'
  | 'set'
  | 'attack'
  | 'pass'
  | 'block'
  | 'point_outcome'
  | 'idle'

interface RallyState {
  // Current step in the entry flow
  step: EntryStep
  // Draft actions accumulated before submission
  actions: RallyActionDraft[]
  // Stack of steps for navigating back
  stepHistory: EntryStep[]
  // Parallel to stepHistory: actions.length at the time of each push.
  // goBack restores actions to this count, so switchStep (which adds no action)
  // doesn't accidentally pop a committed action.
  actionsAtStep: number[]
  // The rally ID received after POST /sets/:setId/rallies
  rallyId: string | null
  // Point outcome
  winningTeamId: string | null
  pointType: PointType | null

  // Actions
  startRally: (rallyId: string) => void
  goToStep: (step: EntryStep) => void
  switchStep: (step: EntryStep) => void
  goBack: () => void
  addAction: (action: RallyActionDraft) => void
  setPointOutcome: (winningTeamId: string, pointType: PointType) => void
  resetRally: () => void
  restoreActions: (actions: RallyActionDraft[], rallyId: string) => void
}

export const useRallyStore = create<RallyState>((set) => ({
  step: 'idle',
  actions: [],
  stepHistory: [],
  actionsAtStep: [],
  rallyId: null,
  winningTeamId: null,
  pointType: null,

  startRally: (rallyId) =>
    set({ rallyId, step: 'serve', actions: [], stepHistory: [], actionsAtStep: [], winningTeamId: null, pointType: null }),

  // goToStep is called after an action is added — records current action count
  // so goBack can restore to exactly that count.
  goToStep: (step) =>
    set((s) => ({
      step,
      stepHistory: [...s.stepHistory, s.step],
      actionsAtStep: [...s.actionsAtStep, s.actions.length],
    })),

  // switchStep is a tab-switch with no associated action — also records current
  // action count so goBack doesn't pop a committed action when unwinding.
  switchStep: (step) =>
    set((s) => ({
      step,
      stepHistory: [...s.stepHistory, s.step],
      actionsAtStep: [...s.actionsAtStep, s.actions.length],
    })),

  goBack: () =>
    set((s) => {
      const history = [...s.stepHistory]
      const counts = [...s.actionsAtStep]
      const prev = history.pop() ?? 'idle'
      const actionCount = counts.pop() ?? 0
      return {
        step: prev,
        stepHistory: history,
        actionsAtStep: counts,
        actions: s.actions.slice(0, actionCount),
      }
    }),

  addAction: (action) =>
    set((s) => ({ actions: [...s.actions, action] })),

  setPointOutcome: (winningTeamId, pointType) =>
    set({ winningTeamId, pointType, step: 'idle' }),

  resetRally: () =>
    set({ step: 'idle', actions: [], stepHistory: [], actionsAtStep: [], rallyId: null, winningTeamId: null, pointType: null }),

  // Restore a previously saved draft (e.g. after page reload following a failed submit).
  // Puts the store into point_outcome step so the user can retry immediately.
  restoreActions: (actions, rallyId) =>
    set({ actions, rallyId, step: 'point_outcome', stepHistory: [], actionsAtStep: [], winningTeamId: null, pointType: null }),
}))

/**
 * Infer point winner + type from the rally actions already committed.
 * Returns null when outcome is ambiguous (user must pick manually).
 *
 * servingTeamId is used as fallback for the "other team" when awayTeamId is
 * null (untracked opponent) — e.g. an ace means the server wins even if the
 * receiving team has no tracked ID.
 */
export function inferPointOutcome(
  actions: RallyActionDraft[],
  homeTeamId: string | null,
  awayTeamId: string | null,
  servingTeamId: string | null = null,
): { winningTeamId: string; pointType: PointType } | null {
  const last = actions[actions.length - 1]
  if (!last) return null

  const other = (tid: string | null): string | null => {
    if (tid === homeTeamId) return awayTeamId
    if (tid === awayTeamId) return homeTeamId
    // Fallback: if one side is untracked (null id), the "other" team is whoever
    // isn't tid. Use servingTeamId to resolve aces.
    return null
  }

  // Resolve "other" team with serving context when awayTeamId is null.
  const otherOrServing = (tid: string | null): string | null => {
    const o = other(tid)
    if (o !== null) return o
    // Untracked opponent scenario: the non-tid tracked team wins.
    if (tid === servingTeamId) return homeTeamId === tid ? awayTeamId : homeTeamId
    return servingTeamId
  }

  switch (last.actionType) {
    case 'serve':
      if (last.serveQuality === 4 && last.teamId) return { winningTeamId: last.teamId, pointType: 'ace' }
      if (last.serveQuality === 0) {
        const w = otherOrServing(last.teamId)
        if (w) return { winningTeamId: w, pointType: 'error' }
      }
      break
    case 'reception':
      if (last.passQuality === 0) {
        // Aced — the serving team wins
        const w = servingTeamId ?? otherOrServing(last.teamId)
        if (w) return { winningTeamId: w, pointType: 'ace' }
      }
      break
    case 'attack':
      if (last.attackResult === 'kill' && last.teamId) return { winningTeamId: last.teamId, pointType: 'kill' }
      if (last.attackResult === 'error') {
        const w = otherOrServing(last.teamId)
        if (w) return { winningTeamId: w, pointType: 'error' }
      }
      break
    case 'block':
      if ((last.blockResult === 'solo_block' || last.blockResult === 'assisted_block') && last.teamId)
        return { winningTeamId: last.teamId, pointType: 'block' }
      if (last.blockResult === 'block_error') {
        const w = otherOrServing(last.teamId)
        if (w) return { winningTeamId: w, pointType: 'error' }
      }
      break
    case 'pass':
      if (last.passQuality === 0) {
        // Ball dropped — whoever sent it last (attack or overpass) wins
        const lastAttackOrOverpass = [...actions].reverse()
          .find((a) => a.actionType === 'attack' || a.actionType === 'overpass')
        if (lastAttackOrOverpass?.teamId) {
          const pointType = lastAttackOrOverpass.actionType === 'attack' ? 'kill' : 'other'
          return { winningTeamId: lastAttackOrOverpass.teamId, pointType }
        }
      }
      break
    case 'dig':
      // Historical records only — kept for backwards compat
      if (last.digResult === 'poor_dig' || last.digResult === 'no_dig') {
        const lastAttack = [...actions].reverse().find((a) => a.actionType === 'attack')
        if (lastAttack?.teamId) return { winningTeamId: lastAttack.teamId, pointType: 'kill' }
      }
      break
    case 'overpass':
      if (last.freeballResult === 'error') {
        const w = other(last.teamId)
        if (w) return { winningTeamId: w, pointType: 'error' }
      }
      return null
  }
  return null
}

/** Derive the next step after an action is committed */
export function nextStepAfterAction(
  action: RallyActionDraft,
  _currentActions: RallyActionDraft[]
): EntryStep {
  switch (action.actionType) {
    case 'serve':
      if (action.serveQuality === 4) return 'point_outcome'
      if (action.serveQuality === 0) return 'point_outcome'
      return 'receive'

    case 'reception':
      // Aced (quality=0) → point outcome, else → set
      if (action.passQuality === 0) return 'point_outcome'
      return 'set'

    case 'pass':
      // Error (quality=0) → point outcome, else → set
      if (action.passQuality === 0) return 'point_outcome'
      return 'set'

    case 'set':
      return 'attack'

    case 'attack':
      switch (action.attackResult) {
        case 'kill': return 'point_outcome'
        case 'error': return 'point_outcome'
        case 'blocked': return 'block'
        case 'in_play': return 'pass'
        default: return 'point_outcome'
      }

    case 'block':
      if (action.blockResult === 'solo_block' || action.blockResult === 'assisted_block') return 'point_outcome'
      if (action.blockResult === 'block_error') return 'point_outcome'
      // block_touch → pass continues
      return 'pass'

    case 'dig':
      // Historical records only — kept for backwards compat
      if (action.digResult === 'good_dig') return 'set'
      return 'point_outcome'

    case 'overpass':
      if (action.freeballResult === 'error') return 'point_outcome'
      return 'pass'

    default:
      return 'idle'
  }
}
