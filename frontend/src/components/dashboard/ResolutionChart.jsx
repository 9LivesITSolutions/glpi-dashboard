import React, { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

/**
 * ResolutionChart — reçoit les données depuis Dashboard.jsx
 * Props :
 *   data    : [{ period, resolved_count, avg_active_hours, avg_brut_hours, avg_pause_minutes }]
 *   average : { avg_active_hours, avg_brut_hours, avg_pause_minutes, total_resolved }
 *   loading : bool
 */
export default function ResolutionChart({ data = [], average = null, loading = false }) {
  const [mode, setMode] = useState('active'); // 'active' | 'brut'

  const dataKey   = mode === 'active' ? 'avg_active_hours' : 'avg_brut_hours';
  const avgValue  = mode === 'active' ? average?.avg_active_hours : average?.avg_brut_hours;
  const lineColor = mode === 'active' ? '#6366f1' : '#94a3b8';

  const pauseHours = average?.avg_pause_minutes
    ? Math.round(average.avg_pause_minutes / 60 * 10) / 10
    : 0;

  const formatTooltip = (value, name) => {
    if (name === 'Temps moyen (h)') return [`${value}h`, name];
    if (name === 'Tickets résolus') return [value, name];
    return [value, name];
  };

  if (loading) return <div className="card h-72 animate-pulse bg-gray-100" />;

  return (
    <div className="card">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Temps de résolution</h3>
          {average && (
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs text-gray-500">
                Moy.{' '}
                <span className="font-semibold text-gray-700">
                  {mode === 'active'
                    ? `${average.avg_active_hours ?? '—'}h actif`
                    : `${average.avg_brut_hours ?? '—'}h brut`}
                </span>
              </p>
              {pauseHours > 0 && mode === 'active' && (
                <span className="text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                  ⏸ {pauseHours}h de pause exclues
                </span>
              )}
            </div>
          )}
        </div>

        {/* Toggle actif / brut */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg text-xs shrink-0">
          <button
            onClick={() => setMode('active')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              mode === 'active' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ⏱ Actif
          </button>
          <button
            onClick={() => setMode('brut')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              mode === 'brut' ? 'bg-white shadow text-gray-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Brut
          </button>
        </div>
      </div>

      {/* Légende pause */}
      {mode === 'active' && pauseHours > 0 && (
        <div className="mb-3 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-600">
          ℹ️ Le temps actif exclut les périodes où le ticket était en statut <strong>En attente</strong>.
          La moyenne de pause est de <strong>{average.avg_pause_minutes} min</strong> par ticket.
        </div>
      )}

      {data.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
          Aucune donnée sur cette période
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left"  tick={{ fontSize: 11 }} unit="h" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip formatter={formatTooltip} />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            <Bar
              yAxisId="right"
              dataKey="resolved_count"
              name="Tickets résolus"
              fill="#e0e7ff"
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey={dataKey}
              name="Temps moyen (h)"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            {avgValue && (
              <ReferenceLine
                yAxisId="left"
                y={avgValue}
                stroke={lineColor}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: `moy ${avgValue}h`,
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: lineColor,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Comparatif brut vs actif si les deux sont disponibles */}
      {average?.avg_active_hours && average?.avg_brut_hours && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-gray-400">Temps brut</p>
            <p className="font-semibold text-gray-600">{average.avg_brut_hours}h</p>
          </div>
          <div>
            <p className="text-amber-500">⏸ Pause moy.</p>
            <p className="font-semibold text-amber-600">
              {average.avg_pause_minutes > 0
                ? `${Math.round(average.avg_pause_minutes / 60 * 10) / 10}h`
                : '0h'}
            </p>
          </div>
          <div>
            <p className="text-indigo-500">Temps actif</p>
            <p className="font-semibold text-indigo-600">{average.avg_active_hours}h</p>
          </div>
        </div>
      )}
    </div>
  );
}
