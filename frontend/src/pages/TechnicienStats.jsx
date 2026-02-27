import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell, PieChart, Pie,
} from 'recharts';
import DateRangePicker from '../components/dashboard/DateRangePicker';

const STATUS_COLORS = { 1: '#94a3b8', 2: '#3b82f6', 3: '#6366f1', 4: '#f59e0b', 5: '#22c55e', 6: '#64748b' };

export default function TechnicienStats({ dateFilter, onDateChange }) {
  const [techList, setTechList] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [search, setSearch] = useState('');

  const params = dateFilter.period === 'custom'
    ? { from: dateFilter.from, to: dateFilter.to }
    : { period: dateFilter.period };

  // Chargement liste techniciens
  useEffect(() => {
    setLoadingList(true);
    axios.get('/technicien-stats/list', { params })
      .then(res => {
        setTechList(res.data);
        if (res.data.length && !selectedId) setSelectedId(res.data[0].id);
      })
      .catch(console.error)
      .finally(() => setLoadingList(false));
  }, [dateFilter]);

  // Chargement stats du technicien sélectionné
  useEffect(() => {
    if (!selectedId) return;
    setLoadingStats(true);
    setStats(null);
    axios.get(`/technicien-stats/${selectedId}`, { params })
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoadingStats(false));
  }, [selectedId, dateFilter]);

  const filtered = techList.filter(t =>
    t.fullname.toLowerCase().includes(search.toLowerCase()) ||
    t.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex gap-4 h-full">
      {/* ── Sidebar sélecteur ──────────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div className="card p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            👥 Techniciens ({techList.length})
          </p>
          <input
            className="input text-sm mb-2"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {loadingList ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                    selectedId === t.id
                      ? 'bg-brand-600 text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      selectedId === t.id ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700'
                    }`}>
                      {t.fullname[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate leading-tight">{t.fullname}</p>
                      <p className={`text-xs truncate ${selectedId === t.id ? 'text-blue-200' : 'text-gray-400'}`}>
                        {t.total_tickets} ticket{t.total_tickets > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">Aucun résultat</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Contenu stats ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {loadingStats && <StatsLoading />}
        {!loadingStats && !stats && (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-3">👤</div>
              <p>Sélectionnez un technicien</p>
            </div>
          </div>
        )}
        {!loadingStats && stats && <StatsContent stats={stats} />}
      </div>
    </div>
  );
}

function StatsContent({ stats }) {
  const { user, kpi, evolution, by_priority, by_status, categories, team_avg } = stats;

  // Comparaison technicien vs équipe pour le radar
  const radarData = [
    {
      metric: 'Volume',
      technicien: Math.min(100, Math.round((kpi.total / Math.max(team_avg.team_avg_tickets * 2, 1)) * 100)),
      equipe: 50,
    },
    {
      metric: 'Taux résolution',
      technicien: kpi.resolution_rate,
      equipe: 70,
    },
    {
      metric: 'Rapidité',
      technicien: team_avg.team_avg_brut_hours && kpi.avg_active_hours
        ? Math.min(100, Math.round((team_avg.team_avg_brut_hours / kpi.avg_active_hours) * 50))
        : 50,
      equipe: 50,
    },
  ];

  return (
    <div className="space-y-4">
      {/* En-tête technicien */}
      <div className="card flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {user.fullname[0]?.toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">{user.fullname}</h2>
          <p className="text-sm text-gray-500">@{user.username}</p>
        </div>
        <div className="ml-auto flex gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-brand-600">{kpi.total}</p>
            <p className="text-xs text-gray-500">Tickets</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{kpi.resolution_rate}%</p>
            <p className="text-xs text-gray-500">Résolution</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">
              {kpi.avg_active_hours ? `${kpi.avg_active_hours}h` : 'N/A'}
            </p>
            <p className="text-xs text-gray-500">Temps moyen</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{kpi.open}</p>
            <p className="text-xs text-gray-500">En cours</p>
          </div>
        </div>
      </div>

      {/* Comparaison équipe */}
      {team_avg.team_avg_tickets && (
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-3">📊 Comparaison vs équipe</h3>
          <div className="grid grid-cols-2 gap-4">
            <CompareBar
              label="Volume tickets"
              value={kpi.total}
              avg={team_avg.team_avg_tickets}
              unit="tickets"
              color="brand"
            />
            <CompareBar
              label="Temps résolution moyen"
              value={kpi.avg_active_hours}
              avg={team_avg.team_avg_brut_hours}
              unit="h"
              color="purple"
              lowerIsBetter
            />
          </div>
        </div>
      )}

      {/* Évolution */}
      <div className="card">
        <h3 className="font-semibold text-gray-700 mb-4">📈 Évolution de l'activité</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={evolution}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="total" name="Assignés" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="resolved" name="Résolus" fill="#22c55e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Répartition statuts */}
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-4">🍩 Statuts</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={by_status} dataKey="count" nameKey="label" outerRadius={65} innerRadius={30}
                label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}>
                {by_status.map(entry => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top catégories */}
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-4">🏷️ Catégories</h3>
          <div className="space-y-2">
            {categories.slice(0, 6).map((c, i) => {
              const max = categories[0]?.count || 1;
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                    <span className="truncate max-w-[160px]">{c.category}</span>
                    <span className="font-semibold">{c.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${(c.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Priorités */}
      <div className="card">
        <h3 className="font-semibold text-gray-700 mb-4">⚡ Répartition par priorité</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={by_priority} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="count" name="Total" fill="#6366f1" radius={[0, 3, 3, 0]} barSize={12} />
            <Bar dataKey="resolved" name="Résolus" fill="#22c55e" radius={[0, 3, 3, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CompareBar({ label, value, avg, unit, color, lowerIsBetter }) {
  if (!value || !avg) return null;
  const ratio = value / avg;
  const isGood = lowerIsBetter ? ratio <= 1 : ratio >= 1;
  const diff = Math.round(Math.abs(ratio - 1) * 100);

  return (
    <div className="p-3 bg-gray-50 rounded-xl">
      <p className="text-xs font-medium text-gray-600 mb-2">{label}</p>
      <div className="flex items-end gap-3">
        <div>
          <p className={`text-xl font-bold ${isGood ? 'text-green-600' : 'text-red-500'}`}>
            {value}{unit}
          </p>
          <p className="text-xs text-gray-400">Ce technicien</p>
        </div>
        <div className="text-gray-300 text-lg mb-1">vs</div>
        <div>
          <p className="text-xl font-bold text-gray-500">{parseFloat(avg).toFixed(1)}{unit}</p>
          <p className="text-xs text-gray-400">Moy. équipe</p>
        </div>
        <div className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full ${
          isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
        }`}>
          {isGood ? '↑' : '↓'} {diff}%
        </div>
      </div>
    </div>
  );
}

function StatsLoading() {
  return (
    <div className="space-y-4">
      <div className="card h-24 animate-pulse bg-gray-100" />
      <div className="grid grid-cols-2 gap-4">
        <div className="card h-40 animate-pulse bg-gray-100" />
        <div className="card h-40 animate-pulse bg-gray-100" />
      </div>
      <div className="card h-52 animate-pulse bg-gray-100" />
    </div>
  );
}
