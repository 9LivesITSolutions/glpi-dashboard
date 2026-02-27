import React, { useState } from 'react';

/**
 * SLAGauge — reçoit les données depuis Dashboard.jsx
 * Props :
 *   data       : by_priority[] depuis /api/sla/summary
 *   globalRate : { global_rate, global_glpi_rate, global_manual_rate, meta }
 *   loading    : bool
 */
export default function SLAGauge({ data = [], globalRate = null, loading = false }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) return <div className="card h-72 animate-pulse bg-gray-100" />;

  // Support des deux formes d'appel :
  // 1. data = by_priority[], globalRate = object (depuis Dashboard)
  // 2. data = full sla object (rétrocompat)
  let by_priority, global_rate, global_glpi_rate, global_manual_rate, meta;

  if (Array.isArray(data)) {
    by_priority        = data;
    global_rate        = globalRate?.global_rate        ?? globalRate;
    global_glpi_rate   = globalRate?.global_glpi_rate;
    global_manual_rate = globalRate?.global_manual_rate;
    meta               = globalRate?.meta;
  } else {
    by_priority        = data?.by_priority        || [];
    global_rate        = data?.global_rate;
    global_glpi_rate   = data?.global_glpi_rate;
    global_manual_rate = data?.global_manual_rate;
    meta               = data?.meta;
  }

  const hasGlpi   = (meta?.tickets_glpi_sla   || 0) > 0;
  const hasManual = (meta?.tickets_manual_sla  || 0) > 0;

  const rateColor = (rate) => {
    if (rate === null || rate === undefined) return 'text-gray-400';
    if (rate >= 90) return 'text-green-600';
    if (rate >= 75) return 'text-amber-500';
    return 'text-red-500';
  };

  const barColor = (rate) => {
    if (rate === null || rate === undefined) return 'bg-gray-200';
    if (rate >= 90) return 'bg-green-500';
    if (rate >= 75) return 'bg-amber-400';
    return 'bg-red-400';
  };

  return (
    <div className="card">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">SLA</h3>
          <p className="text-xs text-gray-400 mt-0.5">Hors temps en pause (En attente)</p>
        </div>
        <div className="text-right">
          <span className={`text-3xl font-bold ${rateColor(global_rate)}`}>
            {global_rate !== null && global_rate !== undefined ? `${global_rate}%` : '—'}
          </span>
          <p className="text-xs text-gray-400">global · {meta?.total_resolved ?? 0} tickets</p>
        </div>
      </div>

      {/* Détail par source SLA */}
      {(hasGlpi || hasManual) && (
        <div className="flex gap-2 mb-4">
          {hasGlpi && (
            <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className={`text-xl font-bold ${rateColor(global_glpi_rate)}`}>
                {global_glpi_rate !== null && global_glpi_rate !== undefined ? `${global_glpi_rate}%` : '—'}
              </p>
              <p className="text-xs text-blue-600 font-medium mt-0.5">🔗 SLA GLPI natif</p>
              <p className="text-xs text-gray-400">{meta.tickets_glpi_sla} tickets</p>
            </div>
          )}
          {hasManual && (
            <div className="flex-1 bg-violet-50 border border-violet-100 rounded-xl p-3 text-center">
              <p className={`text-xl font-bold ${rateColor(global_manual_rate)}`}>
                {global_manual_rate !== null && global_manual_rate !== undefined ? `${global_manual_rate}%` : '—'}
              </p>
              <p className="text-xs text-violet-600 font-medium mt-0.5">⚙️ SLA Manuel</p>
              <p className="text-xs text-gray-400">{meta.tickets_manual_sla} tickets</p>
            </div>
          )}
        </div>
      )}

      {/* Info : tous sans SLA GLPI */}
      {!hasGlpi && hasManual && (
        <div className="mb-4 px-3 py-2 bg-violet-50 border border-violet-100 rounded-lg text-xs text-violet-600">
          ⚙️ Aucun SLA GLPI configuré — calcul basé sur les délais du dashboard, pauses exclues.
        </div>
      )}

      {/* Détail par priorité */}
      <div className="space-y-3">
        {(expanded ? by_priority : by_priority.slice(0, 4)).map(p => (
          <div key={p.priority}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 w-20">{p.label}</span>
                {p.target_hours && (
                  <span className="text-xs text-gray-400">
                    cible {p.target_hours >= 24
                      ? `${p.target_hours / 24}j`
                      : `${p.target_hours}h`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Badges source */}
                <div className="flex gap-1">
                  {(p.glpi_within + p.glpi_breached) > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">
                      GLPI {p.glpi_sla_rate !== null ? `${p.glpi_sla_rate}%` : ''}
                    </span>
                  )}
                  {(p.manual_within + p.manual_breached) > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-600">
                      Manuel {p.manual_sla_rate !== null ? `${p.manual_sla_rate}%` : ''}
                    </span>
                  )}
                </div>
                <span className={`text-sm font-bold w-12 text-right ${rateColor(p.sla_rate)}`}>
                  {p.sla_rate !== null ? `${p.sla_rate}%` : '—'}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor(p.sla_rate)}`}
                style={{ width: p.sla_rate !== null ? `${p.sla_rate}%` : '0%' }}
              />
            </div>

            {/* Compteurs */}
            <div className="flex justify-between mt-1 text-[10px] text-gray-400">
              <span>✓ {p.within_sla ?? 0} dans délai</span>
              {(p.breached_sla ?? 0) > 0 && (
                <span className="text-red-400">✗ {p.breached_sla} dépassé</span>
              )}
              {(p.still_open ?? 0) > 0 && (
                <span>⏳ {p.still_open} en cours</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Voir plus/moins */}
      {by_priority.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 text-xs text-brand-600 hover:text-brand-700 w-full text-center"
        >
          {expanded ? '▲ Réduire' : `▼ Voir toutes les priorités (${by_priority.length})`}
        </button>
      )}

      {/* Légende source */}
      {hasGlpi && hasManual && (
        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1 text-[10px] text-gray-400">
          <p>🔗 <strong>SLA GLPI</strong> — deadline <code>time_to_resolve</code> calculée par GLPI (pauses déjà exclues par GLPI)</p>
          <p>⚙️ <strong>SLA Manuel</strong> — délai configuré dans le dashboard + durée de pause ajoutée à la deadline</p>
        </div>
      )}
    </div>
  );
}
