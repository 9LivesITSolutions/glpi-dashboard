import React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts';

const PRIORITY_COLORS = {
  1: '#ef4444', // Très haute — rouge
  2: '#f97316', // Haute — orange
  3: '#eab308', // Moyenne — jaune
  4: '#22c55e', // Basse — vert
  5: '#64748b', // Très basse — gris
  6: '#7c3aed', // Majeure — violet
};

export default function SLAGauge({ data, globalRate, loading }) {
  if (loading) return <Skeleton />;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-700">🎯 Taux SLA</h3>
        {globalRate !== null && globalRate !== undefined && (
          <span className={`text-xl font-bold ${
            globalRate >= 90 ? 'text-green-600' : globalRate >= 70 ? 'text-amber-600' : 'text-red-600'
          }`}>
            {globalRate}%
          </span>
        )}
      </div>

      {/* Barre de progression globale */}
      {globalRate !== null && globalRate !== undefined && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Global</span>
            <span>{globalRate}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                globalRate >= 90 ? 'bg-green-500' : globalRate >= 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${globalRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Détail par priorité */}
      <div className="space-y-2">
        {data?.map(p => (
          <div key={p.priority}>
            <div className="flex justify-between items-center text-xs mb-0.5">
              <span className="font-medium text-gray-600">{p.label}</span>
              <span className="text-gray-500 flex gap-2">
                <span className="text-gray-400">{p.target_hours}h cible</span>
                <span className={`font-semibold ${
                  p.sla_rate === null ? 'text-gray-400' :
                  p.sla_rate >= 90 ? 'text-green-600' :
                  p.sla_rate >= 70 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {p.sla_rate !== null ? `${p.sla_rate}%` : 'N/A'}
                </span>
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  p.sla_rate === null ? 'w-0' :
                  p.sla_rate >= 90 ? 'bg-green-500' :
                  p.sla_rate >= 70 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${p.sla_rate ?? 0}%` }}
              />
            </div>
            <div className="flex gap-3 text-[10px] text-gray-400 mt-0.5">
              <span>{p.within_sla} ok</span>
              <span>{p.breached_sla} hors délai</span>
              <span>{p.still_open} en cours</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const Skeleton = () => (
  <div className="card space-y-3">
    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
    {[...Array(4)].map((_, i) => (
      <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
    ))}
  </div>
);
