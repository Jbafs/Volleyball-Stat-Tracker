import { useState } from 'react'
import { POINT_TYPES } from '@vst/shared'
import type { PointType, RallyActionDraft } from '@vst/shared'
import { inferPointOutcome } from '../../store/rallyStore'

const POINT_TYPE_LABELS: Record<PointType, string> = {
  kill: 'Kill',
  ace: 'Ace',
  block: 'Block',
  error: 'Error',
  other: 'Other',
}

interface Props {
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  servingTeamId: string | null
  actions: RallyActionDraft[]
  onSubmit: (winningTeamId: string | null, pointType: PointType) => void
  isSubmitting: boolean
}

export function PointOutcomeStep({
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  servingTeamId,
  actions,
  onSubmit,
  isSubmitting,
}: Props) {
  const inferred = inferPointOutcome(actions, homeTeamId, awayTeamId, servingTeamId)

  // undefined = not yet selected, null = opponent (untracked away team) selected
  const [winningTeamId, setWinningTeamId] = useState<string | null | undefined>(inferred?.winningTeamId)
  const [pointType, setPointType] = useState<PointType | null>(inferred?.pointType ?? null)

  const winnerName = winningTeamId === homeTeamId ? homeTeamName : awayTeamName
  // Use null as the away team's ID when it is untracked (opponent-only match)
  const awayButtonId = awayTeamId ?? null
  const canSubmit = winningTeamId !== undefined && !!pointType

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Point Outcome</h2>
        {inferred && (
          <p className="text-sm text-blue-400 mt-1">
            Auto-detected from rally — confirm or change below
          </p>
        )}
      </div>

      {/* Winner */}
      <div>
        <p className="label">Point winner</p>
        <div className="flex gap-3">
          {[
            { id: homeTeamId as string | null, name: homeTeamName, activeClass: 'bg-blue-600 border-blue-500' },
            { id: awayButtonId, name: awayTeamName, activeClass: 'bg-orange-600 border-orange-500' },
          ].map(({ id, name, activeClass }) => (
            <button
              key={id ?? '__opponent__'}
              onClick={() => setWinningTeamId(id)}
              className={`flex-1 py-4 rounded-xl text-base font-bold border transition-colors ${
                winningTeamId === id
                  ? `${activeClass} text-white`
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Point type */}
      <div>
        <p className="label">How was the point won?</p>
        <div className="flex flex-wrap gap-2">
          {POINT_TYPES.map((pt) => (
            <button
              key={pt}
              onClick={() => setPointType(pt)}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                pointType === pt
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              {POINT_TYPE_LABELS[pt]}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => canSubmit && onSubmit(winningTeamId as string | null, pointType!)}
        disabled={!canSubmit || isSubmitting}
        className="btn-primary w-full py-4 text-base"
      >
        {isSubmitting
          ? 'Saving...'
          : canSubmit
          ? `${winnerName} wins · ${POINT_TYPE_LABELS[pointType!]} → Next Rally`
          : 'Select winner and point type'}
      </button>
    </div>
  )
}
