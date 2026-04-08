import { useState } from 'react'
import { StepShell, PlayerPicker, QualityPicker, TeamToggle } from './StepShell'
import { CourtSVG } from '../../../components/court/CourtSVG'
import { useRallyStore, nextStepAfterAction } from '../../../store/rallyStore'
import { useTeamPlayers } from '../../../api/players'
import { RECEPTION_QUALITY_LABELS, FREEBALL_RESULTS, FREEBALL_RESULT_LABELS } from '@vst/shared'
import type { PassQuality } from '@vst/shared'

const RECEPTION_OPTIONS = ([0, 1, 2, 3] as PassQuality[]).map((v) => ({
  value: v,
  label: RECEPTION_QUALITY_LABELS[v],
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

export function ReceiveStep({ homeTeamId, awayTeamId, homeTeamName, awayTeamName, servingTeamId }: Props) {
  const rallyStore = useRallyStore()

  // Auto-suggest receive quality from the preceding serve quality (inverse scale):
  // serve 1 easy → suggest pass 3 perfect, serve 2 pressured → pass 2 good, serve 3 OOS → pass 1 poor
  const lastAction = rallyStore.actions[rallyStore.actions.length - 1]
  const suggestedQuality: PassQuality | null =
    lastAction?.actionType === 'serve'
      ? ({ 1: 3, 2: 2, 3: 1 } as Record<number, PassQuality>)[lastAction.serveQuality ?? -1] ?? null
      : null

  const [mode, setMode] = useState<'receive' | 'freeball'>('receive')
  const [teamOverride, setTeamOverride] = useState<string | null | undefined>(undefined)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [quality, setQuality] = useState<PassQuality | null>(suggestedQuality)
  const [posX, setPosX] = useState<number | null>(null)
  const [posY, setPosY] = useState<number | null>(null)
  const [freeballResult, setFreeballResult] = useState<'over' | 'error' | null>(null)

  // Receiving team is the opponent of the server by default
  const autoTeamId = servingTeamId === homeTeamId ? awayTeamId : homeTeamId
  const teamId = teamOverride !== undefined ? teamOverride : autoTeamId

  const { data: players = [] } = useTeamPlayers(teamId ?? '')

  function switchMode(m: 'receive' | 'freeball') {
    setMode(m)
    setPlayerId(null)
    setQuality(null)
    setPosX(null)
    setPosY(null)
    setFreeballResult(null)
  }

  function handleTeamSelect(id: string | null) {
    setTeamOverride(id)
    setPlayerId(null)
  }

  function handleCommitReceive() {
    if (quality === null) return
    const action = {
      actionType: 'reception' as const,
      playerId,
      teamId,
      passQuality: quality,
      digX: posX ?? undefined,
      digY: posY ?? undefined,
    }
    rallyStore.addAction(action)
    rallyStore.goToStep(nextStepAfterAction(action, rallyStore.actions))
  }

  function handleCommitFreeball() {
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

  const canCommit = mode === 'freeball' ? !!freeballResult : quality !== null

  function handleSkip() {
    // Opponent is untracked — advance without recording an action.
    // receive skip → set (rally continues); freeball skip → pass (other side handles it)
    rallyStore.goToStep(mode === 'freeball' ? 'pass' : 'set')
  }

  return (
    <StepShell title="Serve Receive" description="Record the first touch">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
        {([['receive', 'Serve Receive'], ['freeball', 'Freeball / Overpass']] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
              mode === m ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
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
        label={mode === 'freeball' ? 'Which team sent the freeball?' : 'Receiving team'}
      />

      <PlayerPicker
        players={players.filter((p) => ['L', 'DS', 'OH', 'MB', 'RS', 'S'].includes(p.position))}
        selectedId={playerId}
        onSelect={setPlayerId}
        label={mode === 'freeball' ? 'Who sent it?' : 'Who received?'}
        allowNone
      />

      {mode === 'receive' ? (
        <>
          <div>
            <p className="label mb-2">
              {posX === null ? 'Click receive position on the court (optional)' : 'Position recorded. Click to adjust.'}
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
            options={RECEPTION_OPTIONS}
            selected={quality}
            onSelect={setQuality}
            label="Receive quality"
          />
          {!teamId ? (
            <button onClick={handleSkip} className="btn-secondary w-full py-3">
              Skip — opponent untracked
            </button>
          ) : (
            <button onClick={handleCommitReceive} disabled={!canCommit} className="btn-primary w-full py-3">
              {quality === 0 ? 'Confirm Ace → Point Outcome' : 'Continue to Set →'}
            </button>
          )}
        </>
      ) : (
        <>
          <QualityPicker
            options={FREEBALL_OPTIONS}
            selected={freeballResult}
            onSelect={setFreeballResult}
            label="Freeball result"
          />
          {!teamId ? (
            <button onClick={handleSkip} className="btn-secondary w-full py-3">
              Skip — opponent untracked
            </button>
          ) : (
            <button onClick={handleCommitFreeball} disabled={!canCommit} className="btn-primary w-full py-3">
              {freeballResult === 'over' ? 'Freeball Over → Pass Step'
                : freeballResult === 'error' ? 'Freeball Error → Point Outcome'
                : 'Confirm Freeball'}
            </button>
          )}
        </>
      )}
    </StepShell>
  )
}
