import { useState } from 'react'
import { StepShell, PlayerPicker, QualityPicker, TeamToggle } from './StepShell'
import { useRallyStore, nextStepAfterAction } from '../../../store/rallyStore'
import { useTeamPlayers } from '../../../api/players'
import { BLOCK_RESULTS, BLOCK_RESULT_LABELS } from '@vst/shared'
import type { BlockResult } from '@vst/shared'

const BLOCK_OPTIONS = BLOCK_RESULTS.map((v) => ({
  value: v,
  label: BLOCK_RESULT_LABELS[v],
  color: v === 'solo_block' || v === 'assisted_block' ? '#059669'
    : v === 'block_error' ? '#DC2626' : undefined,
}))

interface Props {
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  servingTeamId: string | null
}

export function BlockStep({ homeTeamId, awayTeamId, homeTeamName, awayTeamName, servingTeamId }: Props) {
  const [teamOverride, setTeamOverride] = useState<string | null | undefined>(undefined)
  const [blocker1, setBLocker1] = useState<string | null>(null)
  const [blocker2, setBLocker2] = useState<string | null>(null)
  const [blockResult, setBlockResult] = useState<BlockResult | null>(null)

  const rallyStore = useRallyStore()

  // The blocker is the team that DIDN'T attack — opponent of whoever last sent the ball over.
  const lastAttack = [...rallyStore.actions].reverse()
    .find(a => a.actionType === 'attack' || a.actionType === 'overpass')
  const autoTeamId = !lastAttack
    ? (servingTeamId === homeTeamId ? awayTeamId : homeTeamId)
    : lastAttack.teamId === homeTeamId
      ? awayTeamId
      : homeTeamId

  const teamId = teamOverride !== undefined ? teamOverride : autoTeamId

  const { data: blockingPlayers = [] } = useTeamPlayers(teamId ?? '')
  const frontRowBlockers = blockingPlayers.filter((p) => ['OH', 'MB', 'RS'].includes(p.position))

  // Link to the last attack/overpass
  const lastAttackIdx = [...rallyStore.actions].reverse()
    .findIndex((a) => a.actionType === 'attack' || a.actionType === 'overpass')
  const linkedSeq = lastAttackIdx >= 0 ? rallyStore.actions.length - 1 - lastAttackIdx : undefined

  function handleSkip() {
    rallyStore.goToStep('point_outcome')
  }

  function handleTeamSelect(id: string | null) {
    setTeamOverride(id)
    setBLocker1(null)
    setBLocker2(null)
  }

  function handleBlockResultSelect(r: BlockResult) {
    setBlockResult(r)
    // Clear second blocker when switching away from assisted block to avoid stale state
    if (r !== 'assisted_block') setBLocker2(null)
  }

  function handleCommit() {
    if (!blockResult) return
    const isAssisted = blockResult === 'assisted_block' && blocker2 !== null

    const action1 = {
      actionType: 'block' as const,
      playerId: blocker1,
      teamId,
      blockResult: isAssisted ? 'assisted_block' as const : blockResult,
      linkedActionSequence: linkedSeq,
    }
    rallyStore.addAction(action1)

    if (isAssisted && blocker2) {
      rallyStore.addAction({
        actionType: 'block' as const,
        playerId: blocker2,
        teamId,
        blockResult: 'assisted_block',
        linkedActionSequence: linkedSeq,
      })
    }

    rallyStore.goToStep(nextStepAfterAction(action1, rallyStore.actions))
  }

  return (
    <StepShell title="Block" description="Record the block attempt">
      <TeamToggle
        homeTeamId={homeTeamId}
        awayTeamId={awayTeamId}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        selectedTeamId={teamId}
        onSelect={handleTeamSelect}
        label="Blocking team"
      />

      <PlayerPicker
        players={frontRowBlockers}
        selectedId={blocker1}
        onSelect={setBLocker1}
        label="Primary blocker"
        allowNone
      />

      {blockResult === 'assisted_block' && (
        <PlayerPicker
          players={frontRowBlockers.filter((p) => p.id !== blocker1)}
          selectedId={blocker2}
          onSelect={setBLocker2}
          label="Secondary blocker (assisted)"
          allowNone
        />
      )}

      <QualityPicker
        options={BLOCK_OPTIONS}
        selected={blockResult}
        onSelect={handleBlockResultSelect}
        label="Block result"
      />

      {!teamId ? (
        <button onClick={handleSkip} className="btn-secondary w-full py-3">
          Skip — opponent untracked
        </button>
      ) : (
        <button
          onClick={handleCommit}
          disabled={!blockResult || (blockResult === 'assisted_block' && blocker2 === null)}
          className="btn-primary w-full py-3"
        >
          {blockResult === 'block_touch' ? 'Block Touch → Pass Step' : 'Continue to Point Outcome →'}
        </button>
      )}
    </StepShell>
  )
}
