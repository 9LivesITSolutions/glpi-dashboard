import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-1.5 truncate">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function TechnicienChart({ data, groupData, loading }) {
  const [view, setView] = useState('tech'); // 'tech' | 'group'

  if (loading) return <Skeleton />;

  const activeData = view === 'tech' ? data : groupData;
  const nameKey = view === 'tech' ? 'fullname' : 'group_name';

  if (!activeData?.length) return (
    <div className="card">
      <Header view={view} setView={setView} />
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Aucune donnée</div>
    </div>
  );

  // Top 10 pour la lisibilité
  const chartData = activeData.slice(0, 10).map(d => ({
    name: truncate(d[nameKey] || 'Inconnu', 20),
    Assignés: d.total_assigned,
    Résolus: d.resolved,
    'En cours': d.open,
  }));

  return (
    <div className="card">
      <Header view={view} setView={setView} />
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 11, fill: '#374151' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Assignés" fill="#3b82f6" radius={[0, 3, 3, 0]} barSize={8} />
          <Bar dataKey="Résolus" fill="#22c55e" radius={[0, 3, 3, 0]} barSize={8} />
          <Bar dataKey="En cours" fill="#f59e0b" radius={[0, 3, 3, 0]} barSize={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Header({ view, setView }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-gray-700">👥 Charge de travail</h3>
      <div className="flex bg-gray-100 p-0.5 rounded-lg">
        {[{ id: 'tech', label: 'Techniciens' }, { id: 'group', label: 'Groupes' }].map(opt => (
          <button
            key={opt.id}
            onClick={() => setView(opt.id)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              view === opt.id ? 'bg-white shadow text-brand-700' : 'text-gray-500'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const truncate = (str, n) => str.length > n ? str.slice(0, n) + '…' : str;

const Skeleton = () => (
  <div className="card"><div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-4" /><div className="h-[280px] bg-gray-100 rounded animate-pulse" /></div>
);
