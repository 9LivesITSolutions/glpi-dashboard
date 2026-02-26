import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DateRangePicker from '../components/dashboard/DateRangePicker';
import KPICard from '../components/dashboard/KPICard';
import TicketsChart from '../components/dashboard/TicketsChart';
import StatutDonut from '../components/dashboard/StatutDonut';
import SLAGauge from '../components/dashboard/SLAGauge';
import ResolutionChart from '../components/dashboard/ResolutionChart';
import TechnicienChart from '../components/dashboard/TechnicienChart';
import TechnicienStats from './TechnicienStats';
import AdminPanel from './AdminPanel';

const DEFAULT_PERIOD = { period: 'month' };

const PERIOD_LABELS = {
  today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois',
  last_month: 'Mois précédent', quarter: 'Ce trimestre', semester: 'Ce semestre',
};

export default function Dashboard() {
  const [activeView, setActiveView] = useState('dashboard');
  const [dateFilter, setDateFilter] = useState(DEFAULT_PERIOD);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);

  const [summary, setSummary] = useState(null);
  const [byStatus, setByStatus] = useState([]);
  const [evolution, setEvolution] = useState([]);
  const [sla, setSla] = useState({ global_rate: null, by_priority: [] });
  const [resolution, setResolution] = useState({ average: null, evolution: [] });
  const [techniciens, setTechniciens] = useState([]);
  const [groupes, setGroupes] = useState([]);

  const buildParams = useCallback(() =>
    dateFilter.period === 'custom'
      ? { from: dateFilter.from, to: dateFilter.to }
      : { period: dateFilter.period }
  , [dateFilter]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = buildParams();
    try {
      const [summaryRes, statusRes, evolutionRes, slaRes, resAvgRes, resEvolRes, techRes, grpRes] =
        await Promise.all([
          axios.get('/tickets/summary', { params }),
          axios.get('/tickets/by-status', { params }),
          axios.get('/tickets/evolution', { params }),
          axios.get('/sla/summary', { params }),
          axios.get('/resolution/average', { params }),
          axios.get('/resolution/evolution', { params }),
          axios.get('/techniciens', { params }),
          axios.get('/techniciens/groupes', { params }),
        ]);
      setSummary(summaryRes.data);
      setByStatus(statusRes.data);
      setEvolution(evolutionRes.data);
      setSla(slaRes.data);
      setResolution({ average: resAvgRes.data.avg_hours, evolution: resEvolRes.data });
      setTechniciens(techRes.data);
      setGroupes(grpRes.data);
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

  return (
    <Layout activeView={activeView} onViewChange={setActiveView}>

      {/* ── Vue Admin ─────────────────────────────────────────────────────── */}
      {activeView === 'admin' && <AdminPanel />}

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
          <TechnicienStats dateFilter={dateFilter} />
        </div>
      )}

      {/* ── Vue Dashboard globale ─────────────────────────────────────────── */}
      {activeView === 'dashboard' && (
        <>
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
            <button onClick={fetchAll} disabled={loading} className="btn-secondary text-sm py-1.5 px-3" title="Actualiser">
              {loading
                ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                : '🔄'}
            </button>
          </div>

          <div className="mb-6">
            <DateRangePicker value={dateFilter} onChange={setDateFilter} />
          </div>

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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard icon="🎫" label="Total tickets"
              value={summary?.total?.toLocaleString('fr-FR')}
              subtitle={`${summary?.in_progress || 0} en cours`} color="blue" loading={loading} />
            <KPICard icon="✅" label="Résolus / Clôturés"
              value={summary ? (parseInt(summary.solved || 0) + parseInt(summary.closed || 0)).toLocaleString('fr-FR') : null}
              subtitle={summary?.total ? `${Math.round(((parseInt(summary.solved || 0) + parseInt(summary.closed || 0)) / summary.total) * 100)}% du total` : ''}
              color="green" loading={loading} />
            <KPICard icon="🎯" label="Taux SLA global"
              value={sla?.global_rate !== null ? `${sla.global_rate}%` : 'N/A'}
              subtitle="Résolutions dans les délais"
              color={sla?.global_rate >= 90 ? 'green' : sla?.global_rate >= 70 ? 'amber' : 'red'} loading={loading} />
            <KPICard icon="⏱" label="Temps moyen résolution"
              value={resolution.average ? `${resolution.average}h` : 'N/A'}
              subtitle="Tickets résolus sur la période" color="purple" loading={loading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2">
              <TicketsChart data={evolution} loading={loading} />
            </div>
            <StatutDonut data={byStatus} loading={loading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <SLAGauge data={sla?.by_priority} globalRate={sla?.global_rate} loading={loading} />
            <ResolutionChart data={resolution.evolution} average={resolution.average} loading={loading} />
          </div>

          <TechnicienChart data={techniciens} groupData={groupes} loading={loading} />
        </>
      )}
    </Layout>
  );
}
