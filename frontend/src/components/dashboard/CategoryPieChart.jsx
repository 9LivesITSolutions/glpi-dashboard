import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = [
  '#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444',
  '#06b6d4','#84cc16','#f97316','#ec4899','#6366f1',
  '#14b8a6','#a855f7','#eab308','#22c55e','#e11d48',
];

const RADIAN = Math.PI / 180;

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.04) return null;
  const r  = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x  = cx + r * Math.cos(-midAngle * RADIAN);
  const y  = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: '11px', fontWeight: 600 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 12px', boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }}>
      <p style={{ fontWeight:600, color:'#111', fontSize:13 }}>{d.name}</p>
      <p style={{ color: d.payload.fill, fontSize:13 }}>
        {d.value} ticket{d.value > 1 ? 's' : ''} — {(d.payload.percent * 100).toFixed(1)}%
      </p>
    </div>
  );
}

export default function CategoryPieChart({ data, loading }) {
  const [activeIdx, setActiveIdx] = useState(null);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Top catégories</h3>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Aucune donnée</div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d, i) => ({
    name:    d.name,
    value:   d.count,
    percent: d.count / total,
    fill:    COLORS[i % COLORS.length],
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Top catégories</h3>
        <span className="text-xs text-gray-400">{total} tickets · {data.length} catégories</span>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={CustomLabel}
            onMouseEnter={(_, i) => setActiveIdx(i)}
            onMouseLeave={() => setActiveIdx(null)}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.fill}
                opacity={activeIdx === null || activeIdx === i ? 1 : 0.55}
                stroke={activeIdx === i ? '#fff' : 'transparent'}
                strokeWidth={activeIdx === i ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Légende manuelle scrollable */}
      <div className="mt-3 space-y-1 max-h-40 overflow-y-auto pr-1">
        {chartData.map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-2 py-0.5">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.fill }} />
              <span className="text-xs text-gray-600 truncate">{d.name}</span>
            </span>
            <span className="text-xs font-medium text-gray-700 shrink-0">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
