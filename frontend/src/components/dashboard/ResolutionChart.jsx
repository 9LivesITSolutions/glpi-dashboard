import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-purple-600">⏱ Moy. : <strong>{payload[0]?.value}h</strong></p>
      {payload[1] && <p className="text-gray-500">Tickets : <strong>{payload[1]?.value}</strong></p>}
    </div>
  );
};

export default function ResolutionChart({ data, average, loading }) {
  if (loading) return <Skeleton />;
  if (!data?.length) return <Empty />;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-700">⏱ Temps moyen de résolution</h3>
        {average && (
          <span className="text-sm text-gray-500">
            Moy. période : <strong className="text-purple-600">{average}h</strong>
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            unit="h"
          />
          <Tooltip content={<CustomTooltip />} />
          {average && (
            <ReferenceLine
              y={average}
              stroke="#a78bfa"
              strokeDasharray="4 4"
              label={{ value: `Moy. ${average}h`, fill: '#7c3aed', fontSize: 10, position: 'right' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="avg_hours"
            name="Temps moyen (h)"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            dot={{ fill: '#8b5cf6', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const Skeleton = () => (
  <div className="card"><div className="h-4 w-56 bg-gray-200 rounded animate-pulse mb-4" /><div className="h-[220px] bg-gray-100 rounded animate-pulse" /></div>
);
const Empty = () => (
  <div className="card flex items-center justify-center h-[270px] text-gray-400 text-sm">Aucune donnée</div>
);
