import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import type { SeriesPoint } from '@/lib/analytics.functions'

/**
 * Heavy recharts area chart, isolated in its own module so it can be
 * pulled in with React.lazy and kept out of the initial bundle.
 */
export default function AreaTrendChart({ data, color }: { data: SeriesPoint[]; color: string }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={30} allowDecimals={false} />
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }} />
          <Area type="monotone" dataKey="value" stroke={color} fill={`url(#g-${color})`} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
