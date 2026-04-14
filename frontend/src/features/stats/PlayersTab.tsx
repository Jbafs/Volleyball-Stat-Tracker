import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { PlayerStats, PlayerStatsWithTeam } from '@vst/shared'

interface PlayersTabProps {
  players: PlayerStats[] | PlayerStatsWithTeam[]
  showLeaderboard: boolean
}

type ColumnGroup = 'attack' | 'serve' | 'receive' | 'defense'
type SortKey = keyof PlayerStats | 'teamName'

interface ColumnDef {
  key: SortKey
  label: string
  decimals?: number
}

const COLUMN_GROUPS: Record<ColumnGroup, ColumnDef[]> = {
  attack: [
    { key: 'attackEfficiency', label: 'Atk Eff', decimals: 3 },
    { key: 'attackKills', label: 'Kills' },
    { key: 'attackErrors', label: 'Errors' },
    { key: 'attackAttempts', label: 'Atts' },
  ],
  serve: [
    { key: 'serveAces', label: 'Aces' },
    { key: 'serveErrors', label: 'Errors' },
    { key: 'serveQualityAvg', label: 'Qual Avg', decimals: 2 },
    { key: 'serveTotalAttempts', label: 'Atts' },
  ],
  receive: [
    { key: 'passQualityAvg', label: 'Rcv Avg', decimals: 2 },
    { key: 'passTotalAttempts', label: 'Atts' },
    { key: 'passAced', label: 'Aced' },
  ],
  defense: [
    { key: 'digAttempts', label: 'Digs' },
    { key: 'soloBlocks', label: 'Solo Blk' },
    { key: 'assistedBlocks', label: 'Ast Blk' },
  ],
}

const MIN_ATTEMPTS_FIELD: Record<ColumnGroup, SortKey> = {
  attack: 'attackAttempts',
  serve: 'serveTotalAttempts',
  receive: 'passTotalAttempts',
  defense: 'digAttempts',
}

const POSITIONS = ['OH', 'MB', 'RS', 'S', 'L', 'DS'] as const

function fmtVal(val: number, decimals?: number): string {
  if (val === 0 && decimals === undefined) return '—'
  if (decimals !== undefined) return val.toFixed(decimals)
  return String(val)
}

function isWithTeam(p: PlayerStats): p is PlayerStatsWithTeam {
  return 'teamId' in p
}

export function PlayersTab({ players, showLeaderboard }: PlayersTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>('attackEfficiency')
  const [sortDesc, setSortDesc] = useState(true)
  const [columnGroup, setColumnGroup] = useState<ColumnGroup>('attack')
  const [positionFilter, setPositionFilter] = useState('all')
  const [minAttempts, setMinAttempts] = useState(0)

  const columns = COLUMN_GROUPS[columnGroup]
  const minField = MIN_ATTEMPTS_FIELD[columnGroup]

  const sorted = useMemo(() => {
    let filtered = [...players]

    // Position filter
    if (positionFilter !== 'all') {
      filtered = filtered.filter(p => p.position === positionFilter)
    }

    // Min attempts filter
    if (minAttempts > 0) {
      filtered = filtered.filter(p => {
        const val = p[minField as keyof PlayerStats]
        return typeof val === 'number' && val >= minAttempts
      })
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      if (sortKey === 'teamName') {
        aVal = isWithTeam(a) ? a.teamName : ''
        bVal = isWithTeam(b) ? b.teamName : ''
      } else {
        const av = a[sortKey as keyof PlayerStats]
        const bv = b[sortKey as keyof PlayerStats]
        aVal = typeof av === 'number' ? av : 0
        bVal = typeof bv === 'number' ? bv : 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
      }
      return sortDesc
        ? (bVal as number) - (aVal as number)
        : (aVal as number) - (bVal as number)
    })

    return filtered
  }, [players, positionFilter, minAttempts, sortKey, sortDesc, minField])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDesc(d => !d)
    } else {
      setSortKey(key)
      setSortDesc(true)
    }
  }

  function SortHeader({ col }: { col: ColumnDef | { key: SortKey; label: string } }) {
    const active = sortKey === col.key
    return (
      <th
        className="px-3 py-2 text-right text-xs font-semibold text-gray-400 cursor-pointer hover:text-white select-none"
        onClick={() => handleSort(col.key)}
      >
        {col.label}
        {active && (
          <span className="ml-1 text-blue-400">{sortDesc ? '↓' : '↑'}</span>
        )}
      </th>
    )
  }

  if (players.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
        {showLeaderboard
          ? 'No player data found for this season.'
          : 'Select a team or season to view player stats.'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Column group pills */}
        <div className="flex bg-gray-900 rounded-lg p-0.5 gap-0.5">
          {(['attack', 'serve', 'receive', 'defense'] as ColumnGroup[]).map(g => (
            <button
              key={g}
              onClick={() => setColumnGroup(g)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors capitalize ${
                columnGroup === g
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>

        {/* Position filter pills */}
        <div className="flex bg-gray-900 rounded-lg p-0.5 gap-0.5">
          {['all', ...POSITIONS].map(pos => (
            <button
              key={pos}
              onClick={() => setPositionFilter(pos)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                positionFilter === pos
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {pos === 'all' ? 'All' : pos}
            </button>
          ))}
        </div>

        {/* Min attempts */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500">Min attempts:</span>
          <select
            value={minAttempts}
            onChange={e => setMinAttempts(Number(e.target.value))}
            className="bg-gray-800 text-gray-200 text-xs rounded-lg px-2 py-1 border border-gray-700 focus:outline-none"
          >
            {[0, 5, 10, 20].map(n => (
              <option key={n} value={n}>{n === 0 ? 'All' : `${n}+`}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result count */}
      <p className="text-xs text-gray-500">
        {sorted.length} player{sorted.length !== 1 ? 's' : ''}
        {positionFilter !== 'all' && ` · ${positionFilter}`}
        {minAttempts > 0 && ` · ≥${minAttempts} ${columnGroup} attempts`}
      </p>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th
                className="px-4 py-2 text-left text-xs font-semibold text-gray-400 cursor-pointer hover:text-white select-none"
                onClick={() => handleSort('playerName')}
              >
                Player{sortKey === 'playerName' && <span className="ml-1 text-blue-400">{sortDesc ? '↓' : '↑'}</span>}
              </th>
              {showLeaderboard && (
                <th
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-400 cursor-pointer hover:text-white select-none"
                  onClick={() => handleSort('teamName')}
                >
                  Team{sortKey === 'teamName' && <span className="ml-1 text-blue-400">{sortDesc ? '↓' : '↑'}</span>}
                </th>
              )}
              <th
                className="px-3 py-2 text-left text-xs font-semibold text-gray-400 cursor-pointer hover:text-white select-none"
                onClick={() => handleSort('position')}
              >
                Pos{sortKey === 'position' && <span className="ml-1 text-blue-400">{sortDesc ? '↓' : '↑'}</span>}
              </th>
              {columns.map(col => (
                <SortHeader key={col.key} col={col} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, i) => (
              <tr
                key={player.playerId}
                className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${
                  i % 2 === 0 ? '' : 'bg-gray-800/20'
                }`}
              >
                <td className="px-4 py-2.5">
                  <Link
                    to={`/players/${player.playerId}`}
                    className="text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {player.playerName}
                  </Link>
                </td>
                {showLeaderboard && isWithTeam(player) && (
                  <td className="px-3 py-2.5 text-gray-300 text-xs">
                    {player.teamName}
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <span className="bg-gray-800 text-gray-300 text-xs px-1.5 py-0.5 rounded">
                    {player.position}
                  </span>
                </td>
                {columns.map(col => {
                  const raw = player[col.key as keyof PlayerStats]
                  const num = typeof raw === 'number' ? raw : 0
                  return (
                    <td key={col.key} className="px-3 py-2.5 text-right tabular-nums text-gray-200">
                      {fmtVal(num, col.decimals)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
