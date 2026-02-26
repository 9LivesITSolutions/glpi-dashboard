import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TicketsChart({ data, loading }) {
  if (loading) return <ChartSkeleton />;
  if (!data?.length) return <Empty />;

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-700 mb-4">📈 Évolution des tickets</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="resolved" name="Résolus" fill="#22c55e" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="card">
      <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="h-[240px] bg-gray-100 rounded animate-pulse" />
    </div>
  );
}

function Empty() {
  return (
    <div className="card flex items-center justify-center h-[290px] text-gray-400">
      <div className="text-center">
        <div className="text-3xl mb-2">📊</div>
        <p className="text-sm">Aucune donnée sur cette période</p>
      </div>
    </div>
  );
}
