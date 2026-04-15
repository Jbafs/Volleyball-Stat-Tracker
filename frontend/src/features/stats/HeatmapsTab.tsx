import { useState } from 'react'
import { CourtSVG } from '../../components/court/CourtSVG'
import { downloadCsvRows } from '../../utils/csv'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { HeatMapPoint, PlayerStats, ServeQualityBucket } from '@vst/shared'

interface HeatmapsTabProps {
  attackPoints: HeatMapPoint[]
  digPoints: HeatMapPoint[]
  receptionPoints: HeatMapPoint[]
  servePoints: HeatMapPoint[]
  serveQualityBuckets: ServeQualityBucket[]
  sideoutData?: { sideoutWon: number; sideoutTotal: number; sideoutPct: number }
  teamId: string
  seasonId: string
  matchId: string
  playerNames: Map<string, string>
  matchPlayers: PlayerStats[]
}

type AttackFilter = 'all' | 'kill' | 'error' | 'in_play' | 'blocked'
type DigFilter = 'all' | 'good_dig' | 'poor_dig' | 'no_dig'
type ServeFilter = 'all' | 'kill' | 'in_play' | 'error'
type ZoneMetric = 'count' | 'efficiency'

const SERVE_QUALITY_LABELS: Record<number, string> = {
  0: 'Error',
  1: 'Fair',
  2: 'Good',
  3: 'Great',
  4: 'Ace',
}
const SERVE_QUALITY_COLORS: Record<number, string> = {
  0: '#EF4444',
  1: '#F97316',
  2: '#FBBF24',
  3: '#84CC16',
  4: '#10B981',
}

export function HeatmapsTab({
  attackPoints,
  digPoints,
  receptionPoints,
  servePoints,
  serveQualityBuckets,
  sideoutData,
  teamId,
  playerNames,
  matchPlayers,
}: HeatmapsTabProps) {
  const [heatmapTab, setHeatmapTab] = useState<'attack' | 'dig' | 'receive' | 'serve'>('attack')
  const [attackFilter, setAttackFilter] = useState<AttackFilter>('all')
  const [digFilter, setDigFilter] = useState<DigFilter>('all')
  const [serveFilter, setServeFilter] = useState<ServeFilter>('all')
  const [hoveredAttack, setHoveredAttack] = useState<HeatMapPoint | null>(null)
  const [hoveredDig, setHoveredDig] = useState<HeatMapPoint | null>(null)
  const [hoveredReceive, setHoveredReceive] = useState<HeatMapPoint | null>(null)
  const [hoveredServe, setHoveredServe] = useState<HeatMapPoint | null>(null)
  const [zoneMetric, setZoneMetric] = useState<ZoneMetric>('count')

  const filteredAttackPoints = attackFilter === 'all'
    ? attackPoints
    : attackPoints.filter((p) => p.result === attackFilter)

  const filteredDigPoints = digFilter === 'all'
    ? digPoints
    : digPoints.filter((p) => p.result === digFilter)

  const attackResultCounts = attackPoints.reduce<Record<string, number>>((acc, pt) => {
    acc[pt.result] = (acc[pt.result] ?? 0) + 1
    return acc
  }, {})

  const totalAttacks = attackPoints.length
  const killCount = attackResultCounts['kill'] ?? 0
  const errorCount = attackResultCounts['error'] ?? 0
  const efficiency = totalAttacks > 0 ? (killCount - errorCount) / totalAttacks : 0

  const barData = [
    { name: 'Kill', value: killCount, color: '#10B981' },
    { name: 'Error', value: errorCount, color: '#EF4444' },
    { name: 'In Play', value: attackResultCounts['in_play'] ?? 0, color: '#FBBF24' },
    { name: 'Blocked', value: attackResultCounts['blocked'] ?? 0, color: '#F97316' },
  ]

  // Attack zone breakdown (zones 1–9)
  const zoneStats = Array.from({ length: 9 }, (_, i) => i + 1).map((zone) => {
    const pts = attackPoints.filter((p) => p.zone === zone)
    const kills = pts.filter((p) => p.result === 'kill').length
    const errors = pts.filter((p) => p.result === 'error').length
    const eff = pts.length > 0 ? (kills - errors) / pts.length : 0
    return {
      zone: `Z${zone}`,
      kills,
      errors,
      attempts: pts.length,
      efficiency: eff,
      // Color by efficiency: red (< 0) → yellow (0) → green (> 0.3)
      color: eff > 0.25 ? '#10B981' : eff > 0 ? '#84CC16' : eff < 0 ? '#EF4444' : '#6B7280',
    }
  })
  const hasZoneData = zoneStats.some((z) => z.attempts > 0)

  // Serve quality chart data — fill all 5 buckets
  const serveQualityMap = new Map(serveQualityBuckets.map((b) => [b.quality, b.count]))
  const serveBarData = [0, 1, 2, 3, 4].map((q) => ({
    name: SERVE_QUALITY_LABELS[q],
    value: serveQualityMap.get(q) ?? 0,
    color: SERVE_QUALITY_COLORS[q],
  }))
  const hasSevereData = serveBarData.some((d) => d.value > 0)

  const filteredServePoints = serveFilter === 'all'
    ? servePoints
    : servePoints.filter((p) => p.result === serveFilter)

  const noData = attackPoints.length === 0 && digPoints.length === 0 && receptionPoints.length === 0 && servePoints.length === 0

  function pointLabel(pt: HeatMapPoint | null): string | null {
    if (!pt) return null
    const name = pt.playerId ? (playerNames.get(pt.playerId) ?? 'Unknown') : 'No player'
    const zone = pt.zone !== undefined ? ` · Zone ${pt.zone}` : ''
    return `${name} — ${pt.result}${zone}`
  }

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      {(totalAttacks > 0 || (sideoutData && sideoutData.sideoutTotal > 0)) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {totalAttacks > 0 && (
            <>
              <div className="card p-4">
                <p className="stat-value">{efficiency.toFixed(3)}</p>
                <p className="stat-label">Attack Efficiency</p>
              </div>
              <div className="card p-4">
                <p className="stat-value">{totalAttacks}</p>
                <p className="stat-label">Total Attacks</p>
              </div>
            </>
          )}
          {teamId && sideoutData && sideoutData.sideoutTotal > 0 && (
            <>
              <div className="card p-4">
                <p className="stat-value">{(sideoutData.sideoutPct * 100).toFixed(1)}%</p>
                <p className="stat-label">Sideout %</p>
              </div>
              <div className="card p-4">
                <p className="stat-value">{sideoutData.sideoutWon}/{sideoutData.sideoutTotal}</p>
                <p className="stat-label">Sideouts Won/Total</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Attack result bar chart */}
      {totalAttacks > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Attack Results</h2>
            <button
              onClick={() => downloadCsvRows('attack-stats.csv', ['Result', 'Count'], barData.map((r) => [r.name, r.value]))}
              className="btn-ghost text-xs px-3 py-1.5 border border-gray-700 rounded-lg"
            >
              Export CSV
            </button>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Mobile heatmap tab bar */}
      <div className="flex sm:hidden bg-gray-900 rounded-xl p-1 w-fit gap-1">
        {(['attack', 'dig', 'receive', 'serve'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setHeatmapTab(tab)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
              heatmapTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'attack' ? 'Attack' : tab === 'dig' ? 'Dig' : tab === 'receive' ? 'Receive' : 'Serve'}
          </button>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Attack heatmap */}
        <div className={`card p-4 ${heatmapTab !== 'attack' ? 'hidden sm:block' : ''}`}>
          <h2 className="text-base font-semibold text-white mb-3">Attack Destinations</h2>
          {/* Result filter pills */}
          <div className="flex flex-wrap gap-1 mb-3">
            {(['all', 'kill', 'error', 'in_play', 'blocked'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAttackFilter(f)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  attackFilter === f
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f === 'in_play' ? 'In Play' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <CourtSVG
            mode="heatmap"
            heatMapPoints={filteredAttackPoints}
            onPointHover={setHoveredAttack}
            playerNames={playerNames}
          />
          {hoveredAttack && (
            <div className="mt-2 text-xs text-gray-300 bg-gray-800 rounded-lg px-3 py-1.5">
              {pointLabel(hoveredAttack)}
            </div>
          )}
        </div>

        {/* Dig heatmap */}
        <div className={`card p-4 ${heatmapTab !== 'dig' ? 'hidden sm:block' : ''}`}>
          <h2 className="text-base font-semibold text-white mb-3">Dig Positions</h2>
          <div className="flex flex-wrap gap-1 mb-3">
            {(['all', 'good_dig', 'poor_dig', 'no_dig'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setDigFilter(f)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  digFilter === f
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f === 'good_dig' ? 'Good' : f === 'poor_dig' ? 'Poor' : 'No Dig'}
              </button>
            ))}
          </div>
          <CourtSVG
            mode="heatmap"
            heatMapPoints={filteredDigPoints}
            onPointHover={setHoveredDig}
            playerNames={playerNames}
          />
          {hoveredDig && (
            <div className="mt-2 text-xs text-gray-300 bg-gray-800 rounded-lg px-3 py-1.5">
              {pointLabel(hoveredDig)}
            </div>
          )}
        </div>

        {/* Receive heatmap */}
        <div className={`card p-4 ${heatmapTab !== 'receive' ? 'hidden sm:block' : ''}`}>
          <h2 className="text-base font-semibold text-white mb-3">Serve Receive Positions</h2>
          <div className="h-6 mb-3" /> {/* spacer to align with other cards' filter pills */}
          <CourtSVG
            mode="heatmap"
            heatMapPoints={receptionPoints}
            onPointHover={setHoveredReceive}
            playerNames={playerNames}
          />
          {hoveredReceive ? (
            <div className="mt-2 text-xs text-gray-300 bg-gray-800 rounded-lg px-3 py-1.5">
              {pointLabel(hoveredReceive)}
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-2">Green = perfect, yellow = ok, red = aced</p>
          )}
        </div>

        {/* Serve heatmap */}
        <div className={`card p-4 ${heatmapTab !== 'serve' ? 'hidden sm:block' : ''}`}>
          <h2 className="text-base font-semibold text-white mb-3">Serve Destinations</h2>
          <div className="flex flex-wrap gap-1 mb-3">
            {([
              { key: 'all', label: 'All' },
              { key: 'kill', label: 'Effective' },
              { key: 'in_play', label: 'Neutral' },
              { key: 'error', label: 'Ineffective' },
            ] as { key: ServeFilter; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setServeFilter(key)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  serveFilter === key
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <CourtSVG
            mode="heatmap"
            heatMapPoints={filteredServePoints}
            onPointHover={setHoveredServe}
            playerNames={playerNames}
          />
          {hoveredServe ? (
            <div className="mt-2 text-xs text-gray-300 bg-gray-800 rounded-lg px-3 py-1.5">
              {pointLabel(hoveredServe)}
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-2">Green = ace / poor pass · Yellow = pressured · Red = perfect pass</p>
          )}
        </div>
      </div>

      {/* Attack zone chart */}
      {hasZoneData && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Attack by Zone</h2>
            <div className="flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
              {(['count', 'efficiency'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setZoneMetric(m)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors capitalize ${
                    zoneMetric === m ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {m === 'count' ? 'Attempts' : 'Efficiency'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={zoneStats}>
              <XAxis dataKey="zone" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                tickFormatter={zoneMetric === 'efficiency' ? (v: number) => v.toFixed(2) : undefined}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                formatter={(value: number) =>
                  zoneMetric === 'efficiency' ? value.toFixed(3) : value
                }
              />
              <Bar dataKey={zoneMetric === 'count' ? 'attempts' : 'efficiency'} radius={[4, 4, 0, 0]}>
                {zoneStats.map((entry, idx) => (
                  <Cell key={idx} fill={zoneMetric === 'count' ? '#3B82F6' : entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2">Zones 1–9 left to right (attacker's perspective)</p>
        </div>
      )}

      {/* No data empty state */}
      {noData && (
        <div className="card p-8 text-center">
          <p className="text-gray-400">Select a team, player, season, or match above to view heatmaps.</p>
        </div>
      )}

      {/* Serve quality distribution */}
      {hasSevereData && (
        <div className="card p-4">
          <h2 className="text-base font-semibold text-white mb-4">Serve Quality Distribution</h2>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={serveBarData}>
              <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {serveBarData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2">0 = error, 4 = ace</p>
        </div>
      )}

      {/* Serve receive by player (match scope) */}
      {matchPlayers.filter((p) => p.passTotalAttempts > 0).length > 0 && (
        <div className="card p-4">
          <h2 className="text-base font-semibold text-white mb-4">Serve Receive by Player</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-700">
                  <th className="pb-2 pr-4">Player</th>
                  <th className="pb-2 pr-4 text-right">Attempts</th>
                  <th className="pb-2 pr-4 text-right">Avg Quality</th>
                  <th className="pb-2 text-right">Aced</th>
                </tr>
              </thead>
              <tbody>
                {matchPlayers
                  .filter((p) => p.passTotalAttempts > 0)
                  .sort((a, b) => b.passTotalAttempts - a.passTotalAttempts)
                  .map((p) => (
                    <tr key={p.playerId} className="border-b border-gray-800 last:border-0">
                      <td className="py-2 pr-4 text-white">{p.playerName}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{p.passTotalAttempts}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{p.passQualityAvg.toFixed(2)}</td>
                      <td className="py-2 text-right text-red-400">{p.passAced}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
