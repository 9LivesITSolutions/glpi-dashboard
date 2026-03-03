import React, { useState } from 'react';

export default function RequesterTable({ data, loading }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? data : (data || []).slice(0, 8);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 rounded mb-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Top demandeurs</h3>
        <div className="flex items-center justify-center h-24 text-gray-400 text-sm">Aucune donnée</div>
      </div>
    );
  }

  const max = data[0]?.total || 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Top demandeurs</h3>
        <span className="text-xs text-gray-400">{data.length} utilisateur{data.length > 1 ? 's' : ''}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="text-left pb-2 font-medium">#</th>
              <th className="text-left pb-2 font-medium">Demandeur</th>
              <th className="text-right pb-2 font-medium w-16">Total</th>
              <th className="text-right pb-2 font-medium w-16 hidden sm:table-cell">Ouverts</th>
              <th className="text-right pb-2 font-medium w-16 hidden sm:table-cell">Résolus</th>
              <th className="text-right pb-2 font-medium w-20 hidden md:table-cell">Moy. résol.</th>
              <th className="pb-2 w-24 hidden lg:table-cell" />
            </tr>
          </thead>
          <tbody>
            {displayed.map((r, i) => {
              const pct = Math.round((r.total / max) * 100);
              return (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2 pr-2 text-xs text-gray-400 font-medium">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {r.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{r.name}</p>
                        {r.email && <p className="text-xs text-gray-400 truncate">{r.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2 text-right text-sm font-bold text-gray-800">{r.total}</td>
                  <td className="py-2 text-right text-xs hidden sm:table-cell">
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{r.open}</span>
                  </td>
                  <td className="py-2 text-right text-xs hidden sm:table-cell">
                    <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">{r.solved}</span>
                  </td>
                  <td className="py-2 text-right text-xs text-gray-500 hidden md:table-cell">
                    {r.avg_resolution_hours ? `${r.avg_resolution_hours}h` : '—'}
                  </td>
                  <td className="py-2 hidden lg:table-cell pl-3">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.length > 8 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 w-full text-xs text-gray-500 hover:text-blue-600 py-1.5 border border-gray-100 rounded-lg hover:border-blue-200 transition-colors"
        >
          {showAll ? 'Réduire' : `Voir les ${data.length - 8} autres`}
        </button>
      )}
    </div>
  );
}
