import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DateRangePicker from '../components/dashboard/DateRangePicker';
import KPICard from '../components/dashboard/KPICard';
import TicketsChart from '../components/dashboard/TicketsChart';
import StatutDonut from '../components/dashboard/StatutDonut';
import SLAGauge from '../components/dashboard/SLAGauge';
import ResolutionChart from '../components/dashboard/ResolutionChart';
import TechnicienChart from '../components/dashboard/TechnicienChart';
import CategoryPieChart from '../components/dashboard/CategoryPieChart';
import RequesterTable from '../components/dashboard/RequesterTable';
import TechnicienStats from './TechnicienStats';
import AdminPanel from './AdminPanel';
import TicketsView from './TicketsView';

const DEFAULT_PERIOD = { period: 'month' };

const PERIOD_LABELS = {
  today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois',
  last_month: 'Mois précédent', quarter: 'Ce trimestre', semester: 'Ce semestre',
};

export default function Dashboard() {
  const [activeView, setActiveView]     = useState('dashboard');
  const [dateFilter, setDateFilter]     = useState(DEFAULT_PERIOD);
  const [loading, setLoading]           = useState(true);
  const [lastRefresh, setLastRefresh]   = useState(null);
  const [error, setError]               = useState(null);
  const [autoRefresh, setAutoRefresh]   = useState(0);
  const [customSec, setCustomSec]       = useState('');
  const [refreshTick, setRefreshTick]   = useState(0);
  const intervalRef                     = useRef(null);

  // Données
  const [summary, setSummary]       = useState(null);
  const [byStatus, setByStatus]     = useState([]);
  const [evolution, setEvolution]   = useState([]);
  const [sla, setSla]               = useState({ global_rate: null, global_glpi_rate: null, global_manual_rate: null, by_priority: [], meta: {} });
  const [resAvg, setResAvg]         = useState(null);
  const [resEvol, setResEvol]       = useState([]);
  const [techniciens, setTechniciens] = useState([]);
  const [groupes, setGroupes]         = useState([]);
  const [topCategories, setTopCategories] = useState([]);
  const [topRequesters, setTopRequesters] = useState([]);

  const buildParams = useCallback(() =>
    dateFilter.period === 'custom'
      ? { from: dateFilter.from, to: dateFilter.to }
      : { period: dateFilter.period }
  , [dateFilter]);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    const params = buildParams();
    try {
      const [summaryRes, statusRes, evolutionRes, slaRes, resAvgRes, resEvolRes, techRes, grpRes, catRes, reqRes] =
        await Promise.all([
          axios.get('/tickets/summary',      { params }),
          axios.get('/tickets/by-status',    { params }),
          axios.get('/tickets/evolution',    { params }),
          axios.get('/sla/summary',          { params }),
          axios.get('/resolution/average',   { params }),
          axios.get('/resolution/evolution', { params }),
          axios.get('/techniciens',          { params }),
          axios.get('/techniciens/groupes',  { params }),
          axios.get('/tickets/top-categories', { params }),
          axios.get('/tickets/top-requesters', { params }),
        ]);

      setSummary(summaryRes.data);
      setByStatus(statusRes.data);
      setEvolution(evolutionRes.data);
      setSla(slaRes.data);
      setResAvg(resAvgRes.data);
      setResEvol(resEvolRes.data);
      setTechniciens(techRes.data);
      setGroupes(grpRes.data);
      setTopCategories(catRes.data);
      setTopRequesters(reqRes.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du chargement des données GLPI');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    if (activeView === 'dashboard') fetchAll();
  }, [fetchAll, activeView]);

  const periodLabel = dateFilter.period === 'custom'
    ? `${dateFilter.from} → ${dateFilter.to}`
    : PERIOD_LABELS[dateFilter.period] || dateFilter.period;

  // KPI temps affiché : actif en priorité, fallback brut
  const avgDisplay = resAvg?.avg_active_hours ?? resAvg?.avg_brut_hours;
  const avgLabel   = resAvg?.avg_active_hours
    ? `brut ${resAvg.avg_brut_hours}h · ⏸ ${
        Math.round((resAvg.avg_pause_minutes || 0) / 60 * 10) / 10
      }h pause exclue`
    : 'Tickets résolus sur la période';

  // Auto-refresh — toutes les vues, silencieux
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh > 0) {
      intervalRef.current = setInterval(() => {
        if (activeView === 'dashboard') fetchAll(true);
        else setRefreshTick(t => t + 1);
      }, autoRefresh * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, activeView, fetchAll]);

  return (
    <Layout activeView={activeView} onViewChange={setActiveView}>

      {/* ── Barre actualisation globale ──────────────────────────────────── */}
      {activeView !== 'admin' && (
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            {(loading || refreshTick > 0) && autoRefresh > 0 && (
              <span className="w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
            )}
            {lastRefresh && (
              <span>Actualisé à {lastRefresh.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span>
            )}
            {autoRefresh > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded font-medium">
                ↺ {autoRefresh}s
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1">
              <span className="text-gray-400 text-xs px-1.5">🔄</span>
              {[0, 1, 5, 10, 30].map(s => (
                <button key={s}
                  onClick={() => { setAutoRefresh(s); setCustomSec(''); }}
                  className={`px-2 py-1 text-xs rounded-md transition-all ${
                    autoRefresh === s && customSec === ''
                      ? 'bg-white shadow text-blue-600 font-semibold'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {s === 0 ? 'Off' : s + 's'}
                </button>
              ))}
              <input
                type="number" min="1" max="3600"
                placeholder="Xs"
                value={customSec}
                onChange={e => {
                  setCustomSec(e.target.value);
                  const v = parseInt(e.target.value);
                  if (v > 0) setAutoRefresh(v);
                }}
                className={`w-12 text-xs text-center border rounded-md py-1 outline-none transition-all ${
                  customSec
                    ? 'border-blue-400 bg-white text-blue-600 font-semibold shadow'
                    : 'border-transparent bg-transparent text-gray-500'
                }`}
              />
            </div>
            <button
              onClick={() => activeView === 'dashboard' ? fetchAll(false) : setRefreshTick(t => t + 1)}
              disabled={loading}
              className="btn-secondary text-xs py-1.5 px-2.5"
            >
              {loading ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" /> : '↺ Now'}
            </button>
          </div>
        </div>
      )}

      {/* ── Vue Admin ─────────────────────────────────────────────────────── */}
      {activeView === 'admin' && <AdminPanel />}

      {/* ── Vue Tickets ──────────────────────────────────────────────────── */}
      {activeView === 'tickets' && (
        <TicketsView dateFilter={dateFilter} onDateChange={setDateFilter} refreshTick={refreshTick} />
      )}

      {/* ── Vue Stats Technicien ──────────────────────────────────────────── */}
      {activeView === 'technicien' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Stats par technicien</h1>
              <p className="text-sm text-gray-500 mt-0.5">Période : <strong>{periodLabel}</strong></p>
            </div>
          </div>
          <div className="mb-5">
            <DateRangePicker value={dateFilter} onChange={setDateFilter} />
          </div>
          <TechnicienStats dateFilter={dateFilter} refreshTick={refreshTick} />
        </div>
      )}

      {/* ── Vue Dashboard globale ─────────────────────────────────────────── */}
      {activeView === 'dashboard' && (
        <>
          {/* En-tête */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Tableau de bord Helpdesk</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Période : <strong>{periodLabel}</strong>
                {lastRefresh && (
                  <span className="ml-2 text-gray-400">
                    · Actualisé à {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              {loading && <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-400 rounded-full animate-spin mr-1" />}
              {lastRefresh && <span>Actualisé {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
            </div>
          </div>

          <div className="mb-6">
            <DateRangePicker value={dateFilter} onChange={setDateFilter} />
          </div>

          {/* Erreur */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-medium">Erreur de chargement</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
              <button onClick={fetchAll} className="ml-auto text-xs underline">Réessayer</button>
            </div>
          )}

          {/* ── KPIs ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
              icon="🎫" label="Total tickets"
              value={summary?.total?.toLocaleString('fr-FR')}
              subtitle={`${summary?.in_progress || 0} en cours`}
              color="blue" loading={loading}
            />
            <KPICard
              icon="✅" label="Résolus / Clôturés"
              value={summary
                ? (parseInt(summary.solved || 0) + parseInt(summary.closed || 0)).toLocaleString('fr-FR')
                : null}
              subtitle={summary?.total
                ? `${Math.round(((parseInt(summary.solved || 0) + parseInt(summary.closed || 0)) / summary.total) * 100)}% du total`
                : ''}
              color="green" loading={loading}
            />
            <KPICard
              icon="🎯" label="Taux SLA global"
              value={sla?.global_rate !== null && sla?.global_rate !== undefined
                ? `${sla.global_rate}%`
                : 'N/A'}
              subtitle={
                sla?.meta?.tickets_glpi_sla > 0 && sla?.meta?.tickets_manual_sla > 0
                  ? `GLPI ${sla.global_glpi_rate ?? '—'}% · Manuel ${sla.global_manual_rate ?? '—'}%`
                  : sla?.meta?.tickets_glpi_sla > 0
                    ? `${sla.meta.tickets_glpi_sla} tickets SLA GLPI`
                    : 'Pauses exclues du délai'
              }
              color={sla?.global_rate >= 90 ? 'green' : sla?.global_rate >= 70 ? 'amber' : 'red'}
              loading={loading}
            />
            <KPICard
              icon="⏱" label="Temps moyen actif"
              value={avgDisplay ? `${avgDisplay}h` : 'N/A'}
              subtitle={avgLabel}
              color="purple" loading={loading}
            />
          </div>

          {/* ── Graphiques ligne 1 ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2">
              <TicketsChart data={evolution} loading={loading} />
            </div>
            <StatutDonut data={byStatus} loading={loading} />
          </div>

          {/* ── Graphiques ligne 2 ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <SLAGauge
              data={sla?.by_priority || []}
              globalRate={sla}
              loading={loading}
            />
            <ResolutionChart
              data={resEvol}
              average={resAvg}
              loading={loading}
            />
          </div>

          {/* ── Charge techniciens ────────────────────────────────────────── */}
          <TechnicienChart data={techniciens} groupData={groupes} loading={loading} />

          {/* ── Top catégories + Top demandeurs ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <CategoryPieChart data={topCategories} loading={loading} />
            <RequesterTable   data={topRequesters} loading={loading} />
          </div>
        </>
      )}
    </Layout>
  );
}
