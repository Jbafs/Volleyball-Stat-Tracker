import { useState } from 'react'
import { StepShell, PlayerPicker, QualityPicker, TeamToggle } from './StepShell'
import { CourtSVG } from '../../../components/court/CourtSVG'
import { useRallyStore, nextStepAfterAction } from '../../../store/rallyStore'
import { useTeamPlayers } from '../../../api/players'
import { ATTACK_RESULT_LABELS, ATTACK_RESULTS, NET_ZONE_LABELS, BACK_ROW_ZONES, FREEBALL_RESULT_LABELS, FREEBALL_RESULTS } from '@vst/shared'
import type { AttackResult } from '@vst/shared'

const FREEBALL_OPTIONS = FREEBALL_RESULTS.map((v) => ({
  value: v,
  label: FREEBALL_RESULT_LABELS[v],
  color: v === 'error' ? '#DC2626' : '#059669',
}))

const RESULT_OPTIONS = ATTACK_RESULTS.map((v) => ({
  value: v,
  label: ATTACK_RESULT_LABELS[v],
  color: v === 'kill' ? '#059669' : v === 'error' ? '#DC2626' : undefined,
}))

interface Props {
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  servingTeamId: string | null
}

export function AttackStep({ homeTeamId, awayTeamId, homeTeamName, awayTeamName, servingTeamId }: Props) {
  const [mode, setMode] = useState<'attack' | 'freeball'>('attack')
  const [teamOverride, setTeamOverride] = useState<string | null | undefined>(undefined)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isFrontRow, setIsFrontRow] = useState<boolean>(true)
  const [attackZone, setAttackZone] = useState<number | null>(null)
  const [destX, setDestX] = useState<number | null>(null)
  const [destY, setDestY] = useState<number | null>(null)
  const [result, setResult] = useState<AttackResult | null>(null)
  const [freeballResult, setFreeballResult] = useState<'over' | 'error' | null>(null)
  const rallyStore = useRallyStore()

  // The attacker is whichever team last had possession before this attack.
  // After a set → that team attacks. After a pass/dig (no set) → that team attacks.
  // After an overpass → the OPPONENT of the team that overpass'd attacks (they receive the freeball).
  const acts = rallyStore.actions
  const lastSetIdx = acts.reduce((idx, a, i) => a.actionType === 'set' ? i : idx, -1)
  const lastPassOrDigIdx = acts.reduce((idx, a, i) => (a.actionType === 'pass' || a.actionType === 'dig') ? i : idx, -1)
  const lastOverpassIdx = acts.reduce((idx, a, i) => a.actionType === 'overpass' ? i : idx, -1)
  const maxIdx = Math.max(lastSetIdx, lastPassOrDigIdx, lastOverpassIdx)
  const autoAttackingTeamId = maxIdx === -1
    ? (servingTeamId === homeTeamId ? awayTeamId : homeTeamId)
    : maxIdx === lastOverpassIdx
      ? (acts[lastOverpassIdx].teamId === homeTeamId ? awayTeamId : homeTeamId)
      : maxIdx === lastSetIdx
        ? acts[lastSetIdx].teamId
        : acts[lastPassOrDigIdx].teamId

  const attackingTeamId = teamOverride !== undefined ? teamOverride : autoAttackingTeamId

  const { data: attackingPlayers = [] } = useTeamPlayers(attackingTeamId ?? '')
  const attackers = attackingPlayers.filter((p) =>
    isFrontRow ? ['OH', 'MB', 'RS', 'S'].includes(p.position) : ['OH', 'RS', 'S', 'DS'].includes(p.position)
  )

  function handleResultSelect(r: AttackResult) {
    setResult(r)
    if (r === 'blocked' || r === 'error') {
      setDestX(null)
      setDestY(null)
    }
  }

  function handleCommitAttack() {
    if (!attackZone || !result) return
    const action = {
      actionType: 'attack' as const,
      playerId,
      teamId: attackingTeamId,
      isFrontRow,
      attackZone,
      destX: destX ?? undefined,
      destY: destY ?? undefined,
      attackResult: result,
    }
    rallyStore.addAction(action)
    rallyStore.goToStep(nextStepAfterAction(action, rallyStore.actions))
  }

  function handleCommitFreeball() {
    if (!freeballResult) return
    const action = {
      actionType: 'overpass' as const,
      playerId,
      teamId: attackingTeamId,
      freeballResult,
    }
    rallyStore.addAction(action)
    rallyStore.goToStep(nextStepAfterAction(action, rallyStore.actions))
  }

  const canCommit = mode === 'freeball'
    ? !!freeballResult
    : !!attackZone && !!result

  function handleSkip() {
    // Opponent attacked but is untracked — go to point outcome to record who won
    rallyStore.goToStep('point_outcome')
  }

  return (
    <StepShell title="Attack / Freeball" description="Record the third touch">

      {/* Mode toggle */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
        {(['attack', 'freeball'] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setPlayerId(null); setResult(null); setFreeballResult(null) }}
            className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
              mode === m ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {m === 'attack' ? 'Attack' : 'Freeball / Overpass'}
          </button>
        ))}
      </div>

      <TeamToggle
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        selectedTeamId={attackingTeamId}
        onSelect={(id) => { setTeamOverride(id); setPlayerId(null) }}
        label="Attacking team"
      />

      <PlayerPicker
        players={attackers}
        selectedId={playerId}
        onSelect={setPlayerId}
        label={mode === 'freeball' ? 'Who sent the freeball?' : 'Who attacked?'}
        allowNone
      />

      {mode === 'attack' && (
        <>
          {/* Front/Back row toggle */}
          <div>
            <p className="label">Front or Back Row?</p>
            <div className="flex gap-2">
              {[{ v: true, l: 'Front Row' }, { v: false, l: 'Back Row' }].map(({ v, l }) => (
                <button
                  key={String(v)}
                  onClick={() => { setIsFrontRow(v); setAttackZone(null); setResult(null); setDestX(null); setDestY(null) }}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                    isFrontRow === v ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Zone pick court — hidden once zone is selected */}
          {attackZone === null && (
            <div>
              <p className="label mb-2">Click a {isFrontRow ? 'net zone (1-9)' : 'back row zone'}</p>
              <div className="max-w-md">
                <CourtSVG
                  mode={isFrontRow ? 'select_net_zone' : 'select_back_zone'}
                  onNetZoneSelect={(z) => setAttackZone(z)}
                  onBackZoneSelect={(z) => setAttackZone(z)}
                />
              </div>
            </div>
          )}

          {/* After zone is picked: label, result, optional destination */}
          {attackZone !== null && (
            <>
              {/* Zone label */}
              <div className="px-3 py-2 rounded-lg bg-blue-900/30 border border-blue-700 text-sm text-blue-300">
                Zone {attackZone}: {isFrontRow ? NET_ZONE_LABELS[attackZone] : BACK_ROW_ZONES.find((z) => z.zone === attackZone)?.label}
                <button
                  onClick={() => { setAttackZone(null); setResult(null); setDestX(null); setDestY(null) }}
                  className="ml-3 text-xs text-gray-500 hover:text-white"
                >
                  Change zone
                </button>
              </div>

              <QualityPicker
                options={RESULT_OPTIONS}
                selected={result}
                onSelect={handleResultSelect}
                label="Attack result"
              />

              {/* Destination court — only for kill/in_play (blocked goes back, error is out) */}
              {result !== null && result !== 'blocked' && result !== 'error' && (
                <div>
                  <p className="label mb-2">
                    {destX === null ? "Click destination on opponent's court (optional)" : 'Destination marked. Click to adjust.'}
                  </p>
                  <div className="max-w-md">
                    <CourtSVG
                      mode="pick_dest"
                      onCoordPick={(x, y) => { setDestX(x); setDestY(y) }}
                      markedCoord={destX !== null && destY !== null ? { normX: destX, normY: destY } : undefined}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {!attackingTeamId ? (
            <button onClick={handleSkip} className="btn-secondary w-full py-3">
              Skip — opponent untracked
            </button>
          ) : (
            <button onClick={handleCommitAttack} disabled={!canCommit} className="btn-primary w-full py-3">
              {result === 'kill' ? 'Kill → Point Outcome'
                : result === 'error' ? 'Error → Point Outcome'
                : result === 'blocked' ? 'Blocked → Block Step'
                : result === 'in_play' ? 'In Play → Pass Step'
                : 'Confirm Attack'}
            </button>
          )}
        </>
      )}

      {mode === 'freeball' && (
        <>
          <QualityPicker
            options={FREEBALL_OPTIONS}
            selected={freeballResult}
            onSelect={setFreeballResult}
            label="Freeball result"
          />

          {!attackingTeamId ? (
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
