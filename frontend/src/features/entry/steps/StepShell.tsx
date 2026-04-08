import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  children: ReactNode
}

export function StepShell({ title, description, children }: Props) {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  )
}

interface PlayerPickerProps {
  players: Array<{ id: string; name: string; number: number | null; position: string }>
  selectedId: string | null
  onSelect: (id: string | null) => void
  label?: string
  allowNone?: boolean
}

export function PlayerPicker({ players, selectedId, onSelect, label = 'Select player', allowNone }: PlayerPickerProps) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-2">
        {allowNone && (
          <button
            onClick={() => onSelect(null)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              selectedId === null
                ? 'bg-gray-600 border-gray-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            Unknown
          </button>
        )}
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              selectedId === p.id
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            {p.number !== null ? `#${p.number} ` : ''}{p.name}
            <span className="ml-1 text-xs opacity-60">{p.position}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

interface TeamToggleProps {
  homeTeamId: string | null
  awayTeamId: string | null
  homeTeamName: string
  awayTeamName: string
  selectedTeamId: string | null
  onSelect: (id: string | null) => void
  label?: string
}

export function TeamToggle({ homeTeamId, awayTeamId, homeTeamName, awayTeamName, selectedTeamId, onSelect, label = 'Which team?' }: TeamToggleProps) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex gap-2">
        {[{ id: homeTeamId, name: homeTeamName }, { id: awayTeamId, name: awayTeamName }].map(({ id, name }) => (
          <button
            key={id ?? name}
            onClick={() => onSelect(id)}
            className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
              selectedTeamId === id
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}

interface QualityPickerProps<T extends number | string> {
  options: Array<{ value: T; label: string; color?: string }>
  selected: T | null
  onSelect: (v: T) => void
  label?: string
}

export function QualityPicker<T extends number | string>({
  options, selected, onSelect, label
}: QualityPickerProps<T>) {
  return (
    <div>
      {label && <p className="label">{label}</p>}
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => onSelect(opt.value)}
            className={`flex-1 min-w-[80px] py-3 rounded-xl text-sm font-medium border transition-colors ${
              selected === opt.value
                ? 'border-blue-500 bg-blue-600 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
            }`}
            style={selected === opt.value && opt.color ? { backgroundColor: opt.color, borderColor: opt.color } : {}}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
