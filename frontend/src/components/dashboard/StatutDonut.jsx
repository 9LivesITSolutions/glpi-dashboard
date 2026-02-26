import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const STATUS_COLORS = {
  1: '#94a3b8', // Nouveau — gris
  2: '#3b82f6', // En cours (assigné) — bleu
  3: '#6366f1', // En cours (planifié) — violet
  4: '#f59e0b', // En attente — orange
  5: '#22c55e', // Résolu — vert
  6: '#64748b', // Clôturé — gris foncé
};

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function StatutDonut({ data, loading }) {
  if (loading) return <Skeleton />;
  if (!data?.length) return <Empty />;

  const chartData = data.map(d => ({
    name: d.label,
    value: d.count,
    status: d.status,
  }));

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-700 mb-4">🍩 Répartition par statut</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={90}
            innerRadius={45}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell key={`cell-${entry.status}`} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [value, name]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

const Skeleton = () => (
  <div className="card"><div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-4" /><div className="h-[240px] bg-gray-100 rounded animate-pulse" /></div>
);
const Empty = () => (
  <div className="card flex items-center justify-center h-[290px] text-gray-400 text-sm">Aucune donnée</div>
);
