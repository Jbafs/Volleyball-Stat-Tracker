import { ArrowLeft } from 'lucide-react'

interface Props {
  homeTeamName: string
  awayTeamName: string
  homeScore: number
  awayScore: number
  homeRotation: number
  awayRotation: number
  setNumber: number
  onBack: () => void
}

function RotationDot({ slot, active }: { slot: number; active: boolean }) {
  // Standard rotation visualization: 6 slots in a 2x3 grid
  // Front row: 2,3,4 | Back row: 5,6,1
  return (
    <div
      className={`w-4 h-4 rounded-full border ${
        active ? 'bg-blue-500 border-blue-400' : 'bg-gray-700 border-gray-600'
      }`}
      title={`Slot ${slot}`}
    />
  )
}

function RotationDisplay({ rotation, label }: { rotation: number; label: string }) {
  // Rotation 1 means setter is in position 1 (right back)
  // Display a simplified 6-dot grid
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="grid grid-cols-3 gap-1">
        {/* Front row: slots 2, 3, 4 */}
        {[4, 3, 2].map((slot) => (
          <RotationDot key={slot} slot={slot} active={rotation === slot} />
        ))}
        {/* Back row: slots 5, 6, 1 */}
        {[5, 6, 1].map((slot) => (
          <RotationDot key={slot} slot={slot} active={rotation === slot} />
        ))}
      </div>
      <p className="text-xs font-bold text-blue-400">R{rotation}</p>
    </div>
  )
}

export function EntryHeader({
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  homeRotation,
  awayRotation,
  setNumber,
  onBack,
}: Props) {
  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-6">
      <button onClick={onBack} className="btn-ghost p-2">
        <ArrowLeft className="w-4 h-4" />
      </button>

      {/* Score bug */}
      <div className="flex items-center gap-3 flex-1">
        <div className="text-center">
          <p className="text-xs text-gray-400 truncate max-w-[80px]">{homeTeamName}</p>
          <p className="text-3xl font-bold text-white tabular-nums">{homeScore}</p>
        </div>

        <div className="text-center px-2">
          <p className="text-xs text-gray-500 mb-1">SET {setNumber}</p>
          <p className="text-gray-500 font-bold">–</p>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-400 truncate max-w-[80px]">{awayTeamName}</p>
          <p className="text-3xl font-bold text-white tabular-nums">{awayScore}</p>
        </div>
      </div>

      {/* Rotation displays */}
      <div className="flex gap-6">
        <RotationDisplay rotation={homeRotation} label={homeTeamName.slice(0, 6)} />
        <RotationDisplay rotation={awayRotation} label={awayTeamName.slice(0, 6)} />
      </div>
    </header>
  )
}
