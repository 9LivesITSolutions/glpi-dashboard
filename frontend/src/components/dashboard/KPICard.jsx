import React from 'react';

export default function KPICard({ icon, label, value, subtitle, color = 'blue', loading, trend }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   val: 'text-blue-700'  },
    green:  { bg: 'bg-green-50',  icon: 'text-green-500',  val: 'text-green-700' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-500',  val: 'text-amber-700' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-500',    val: 'text-red-700'   },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-500', val: 'text-purple-700'},
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="card flex items-start gap-4">
      <div className={`p-3 rounded-xl ${c.bg} shrink-0`}>
        <span className={`text-2xl ${c.icon}`}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
        {loading ? (
          <div className="h-7 w-20 bg-gray-200 rounded animate-pulse mt-1" />
        ) : (
          <p className={`text-2xl font-bold mt-0.5 ${c.val}`}>{value ?? '–'}</p>
        )}
        {subtitle && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
        )}
        {trend !== undefined && !loading && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium mt-1 ${
            trend >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs période préc.
          </span>
        )}
      </div>
    </div>
  );
}
