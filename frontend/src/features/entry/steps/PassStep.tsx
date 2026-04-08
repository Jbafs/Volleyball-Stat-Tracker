import { useState } from 'react'
import { StepShell, PlayerPicker, QualityPicker, TeamToggle } from './StepShell'
import { CourtSVG } from '../../../components/court/CourtSVG'
import { useRallyStore, nextStepAfterAction } from '../../../store/rallyStore'
import { useTeamPlayers } from '../../../api/players'
import { PASS_QUALITY_LABELS, FREEBALL_RESULTS, FREEBALL_RESULT_LABELS } from '@vst/shared'
import type { PassQuality, PassContext } from '@vst/shared'

const PASS_OPTIONS = ([0, 1, 2, 3] as PassQuality[]).map((v) => ({
  value: v,
  label: PASS_QUALITY_LABELS[v],
  color: v === 0 ? '#DC2626' : v === 3 ? '#059669' : undefined,
}))

const FREEBALL_OPTIONS = FREEBALL_RESULTS.map((v) => ({
  value: v,
  label: FREEBALL_RESULT_LABELS[v],
  color: v === 'error' ? '#DC2626' : '#059669',
}))

interface Props {
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  servingTeamId: string | null
}

export function PassStep({ homeTeamId, awayTeamId, homeTeamName, awayTeamName, servingTeamId }: Props) {
  const [mode, setMode] = useState<'pass' | 'overpass'>('pass')
  const [teamOverride, setTeamOverride] = useState<string | null | undefined>(undefined)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [quality, setQuality] = useState<PassQuality | null>(null)
  const [freeballResult, setFreeballResult] = useState<'over' | 'error' | null>(null)

  const rallyStore = useRallyStore()
  const actions = rallyStore.actions

  // Find the most recent trigger action (attack, overpass, or block_touch) that
  // caused us to land on the pass step.
  const lastTriggerIdx = [...actions].reduce((found, a, i) => {
    if (
      a.actionType === 'attack' ||
      a.actionType === 'overpass' ||
      (a.actionType === 'block' && a.blockResult === 'block_touch')
    ) return i
    return found
  }, -1)
  const lastTrigger = lastTriggerIdx >= 0 ? actions[lastTriggerIdx] : undefined

  // Pre-fill dig position from attack destination — mirror diagonally because
  // destX/Y are on the opponent's court (attacker's view) but posX/Y are on the
  // digger's own court (their view), so both axes are flipped: (x,y) → (1-x, 1-y)
  const prefillX = lastTrigger?.actionType === 'attack' && lastTrigger.destX !== undefined ? 1 - lastTrigger.destX : null
  const prefillY = lastTrigger?.actionType === 'attack' && lastTrigger.destY !== undefined ? 1 - lastTrigger.destY : null
  const [posX, setPosX] = useState<number | null>(prefillX)
  const [posY, setPosY] = useState<number | null>(prefillY)

  // Auto-detect pass context from the trigger
  const autoPassContext: PassContext =
    lastTrigger?.actionType === 'overpass' ? 'freeball' :
    (lastTrigger?.actionType === 'block' && lastTrigger.blockResult === 'block_touch') ? 'block_cover' :
    'dig'

  const CONTEXT_LABELS: Record<PassContext, string> = {
    dig: 'Dig',
    freeball: 'Freeball Pass',
    block_cover: 'Block Cover',
  }

  // Auto-detect receiving team:
  //   - After attack or overpass: the opponent of the attacking/overpass team
  //   - After block_touch: the same team as the blocker (they cover their own block)
  //   - Fallback: last pass team or serving team
  const lastPassOrDig = [...actions].reverse()
    .find(a => a.actionType === 'pass' || a.actionType === 'reception' || a.actionType === 'dig')

  const autoTeamId =
    lastTrigger?.actionType === 'block'
      ? lastTrigger.teamId  // block cover: same team as blocker
      : lastTrigger?.actionType === 'attack' || lastTrigger?.actionType === 'overpass'
        ? (lastTrigger.teamId === homeTeamId ? awayTeamId : homeTeamId)
        : (lastPassOrDig?.teamId ?? servingTeamId)

  const teamId = teamOverride !== undefined ? teamOverride : autoTeamId

  const { data: players = [] } = useTeamPlayers(teamId ?? '')

  const linkedSeq = lastTriggerIdx >= 0 ? lastTriggerIdx : undefined

  function handleTeamSelect(id: string | null) {
    setTeamOverride(id)
    setPlayerId(null)
  }

  function handleModeChange(m: 'pass' | 'overpass') {
    setMode(m)
    setPlayerId(null)
    setQuality(null)
    setFreeballResult(null)
  }

  function handleCommitPass() {
    if (quality === null) return
    const action = {
      actionType: 'pass' as const,
      playerId,
      teamId,
      passQuality: quality,
      passContext: autoPassContext,
      digX: posX ?? undefined,
      digY: posY ?? undefined,
      linkedActionSequence: linkedSeq,
    }
    rallyStore.addAction(action)
    rallyStore.goToStep(nextStepAfterAction(action, rallyStore.actions))
  }

  function handleCommitOverpass() {
    if (!freeballResult) return
    const action = {
      actionType: 'overpass' as const,
      playerId,
      teamId,
      freeballResult,
    }
    rallyStore.addAction(action)
    rallyStore.goToStep(nextStepAfterAction(action, rallyStore.actions))
  }

  const contextLabel = CONTEXT_LABELS[autoPassContext]

  function handleSkip() {
    // Opponent is untracked — pass skip → set (rally continues); overpass skip → pass (other side receives it)
    rallyStore.goToStep(mode === 'overpass' ? 'pass' : 'set')
  }

  return (
    <StepShell title={`Pass — ${contextLabel}`} description="Record the pass attempt">

      {/* Mode toggle */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
        {(['pass', 'overpass'] as const).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
              mode === m ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {m === 'pass' ? contextLabel : 'Overpass / Freeball'}
          </button>
        ))}
      </div>

      <TeamToggle
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        selectedTeamId={teamId}
        onSelect={handleTeamSelect}
        label="Passing team"
      />

      <PlayerPicker
        players={players}
        selectedId={playerId}
        onSelect={setPlayerId}
        label={mode === 'overpass' ? 'Who sent it over?' : 'Who passed?'}
        allowNone
      />

      {mode === 'pass' && (
        <>
          <div>
            <p className="label mb-2">
              {posX === null ? 'Click pass position on the court (optional)' : 'Position recorded. Click to adjust.'}
            </p>
            <div className="max-w-md">
              <CourtSVG
                mode="pick_dig_pos"
                onCoordPick={(x, y) => { setPosX(x); setPosY(y) }}
                markedCoord={posX !== null && posY !== null ? { normX: posX, normY: posY } : undefined}
              />
            </div>
          </div>

          <QualityPicker
            options={PASS_OPTIONS}
            selected={quality}
            onSelect={setQuality}
            label="Pass quality"
          />

          {!teamId ? (
            <button onClick={handleSkip} className="btn-secondary w-full py-3">
              Skip — opponent untracked
            </button>
          ) : (
            <button onClick={handleCommitPass} disabled={quality === null} className="btn-primary w-full py-3">
              {quality === 0 ? 'Ball Dropped → Point Outcome' : 'Continue to Set →'}
            </button>
          )}
        </>
      )}

      {mode === 'overpass' && (
        <>
          <QualityPicker
            options={FREEBALL_OPTIONS}
            selected={freeballResult}
            onSelect={setFreeballResult}
            label="Overpass result"
          />

          {!teamId ? (
            <button onClick={handleSkip} className="btn-secondary w-full py-3">
              Skip — opponent untracked
            </button>
          ) : (
            <button onClick={handleCommitOverpass} disabled={!freeballResult} className="btn-primary w-full py-3">
              {freeballResult === 'over' ? 'Overpass Over → Pass Step'
                : freeballResult === 'error' ? 'Overpass Error → Point Outcome'
                : 'Confirm Overpass'}
            </button>
          )}
        </>
      )}
    </StepShell>
  )
}
