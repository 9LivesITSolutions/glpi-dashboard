import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DateRangePicker from '../components/dashboard/DateRangePicker';

const STATUS_CONFIG = {
  0: { label: 'Tous',               color: 'gray',   bg: 'bg-gray-100',   text: 'text-gray-700',   row: 'bg-white',         badge: 'bg-gray-100 text-gray-600'   },
  1: { label: 'Nouveau',            color: 'slate',  bg: 'bg-slate-100',  text: 'text-slate-700',  row: 'bg-slate-50',      badge: 'bg-slate-100 text-slate-700'  },
  2: { label: 'En cours (assigné)', color: 'blue',   bg: 'bg-blue-100',   text: 'text-blue-700',   row: 'bg-blue-50',       badge: 'bg-blue-100 text-blue-700'    },
  3: { label: 'En cours (planif.)', color: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-700', row: 'bg-indigo-50',     badge: 'bg-indigo-100 text-indigo-700'},
  4: { label: 'En attente',         color: 'amber',  bg: 'bg-amber-100',  text: 'text-amber-700',  row: 'bg-amber-50',      badge: 'bg-amber-100 text-amber-700'  },
  5: { label: 'Résolu',             color: 'green',  bg: 'bg-green-100',  text: 'text-green-700',  row: 'bg-green-50',      badge: 'bg-green-100 text-green-700'  },
  6: { label: 'Clôturé',            color: 'gray',   bg: 'bg-gray-200',   text: 'text-gray-600',   row: 'bg-gray-50',       badge: 'bg-gray-200 text-gray-600'    },
};

const PRIORITY_CONFIG = {
  1: { label: 'Très haute', dot: 'bg-red-500'    },
  2: { label: 'Haute',      dot: 'bg-orange-400' },
  3: { label: 'Moyenne',    dot: 'bg-yellow-400' },
  4: { label: 'Basse',      dot: 'bg-blue-400'   },
  5: { label: 'Très basse', dot: 'bg-gray-400'   },
  6: { label: 'Majeure',    dot: 'bg-purple-500' },
};

const LIMIT_OPTIONS = [50, 100, 200, 500, 'all'];

export default function TicketsView({ dateFilter, onDateChange }) {
  const [activeStatus, setActiveStatus] = useState(0);
  const [tickets, setTickets]           = useState([]);
  const [summary, setSummary]           = useState({});
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [pages, setPages]               = useState(1);
  const [limit, setLimit]               = useState(50);
  const [loading, setLoading]           = useState(true);
  const [glpiUrl, setGlpiUrl]           = useState('');

  const params = dateFilter?.period === 'custom'
    ? { from: dateFilter.from, to: dateFilter.to }
    : { period: dateFilter?.period || 'month' };

  // Charger l'URL GLPI une fois
  useEffect(() => {
    axios.get('/admin/glpi-url/public').then(r => setGlpiUrl(r.data.url || '')).catch(() => {});
  }, []);

  // Charger le résumé KPI par statut
  useEffect(() => {
    axios.get('/tickets/summary', { params })
      .then(r => setSummary(r.data))
      .catch(console.error);
  }, [JSON.stringify(params)]);

  // Charger le listing
  const fetchTickets = useCallback(() => {
    setLoading(true);
    axios.get('/tickets/list', {
      params: {
        ...params,
        status: activeStatus || undefined,
        page,
        limit,
      }
    }).then(r => {
      setTickets(r.data.tickets);
      setTotal(r.data.total);
      setPages(r.data.pages);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [JSON.stringify(params), activeStatus, page, limit]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Reset page quand on change de filtre
  const handleStatusFilter = (s) => { setActiveStatus(s); setPage(1); };
  const handleLimitChange  = (v) => { setLimit(v === 'all' ? 'all' : parseInt(v)); setPage(1); };

  const openTicket = (id) => {
    if (!glpiUrl) return alert('URL GLPI non configurée (Administration → GLPI)');
    window.open(`${glpiUrl}/front/ticket.form.php?id=${id}`, '_blank');
  };

  const fmt = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
  };

  // KPI cards data
  const kpiCards = [
    { status: 0, count: summary.total           || 0 },
    { status: 1, count: summary.new_count        || 0 },
    { status: 2, count: summary.in_progress      || 0 },
    { status: 4, count: summary.pending          || 0 },
    { status: 5, count: summary.solved           || 0 },
    { status: 6, count: summary.closed           || 0 },
  ];

  return (
    <div>
      {/* En-tête + DatePicker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">🎫 Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">Listing et KPIs par statut</p>
        </div>
      </div>

      <div className="mb-6">
        <DateRangePicker value={dateFilter} onChange={onDateChange} />
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {kpiCards.map(({ status, count }) => {
          const cfg     = STATUS_CONFIG[status];
          const active  = activeStatus === status;
          return (
            <button
              key={status}
              onClick={() => handleStatusFilter(status)}
              className={`rounded-xl p-3 text-left border-2 transition-all ${
                active
                  ? `${cfg.bg} ${cfg.text} border-current shadow-md scale-[1.02]`
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <p className={`text-2xl font-bold ${active ? cfg.text : 'text-gray-800'}`}>
                {count}
              </p>
              <p className={`text-xs font-medium mt-0.5 ${active ? cfg.text : 'text-gray-500'}`}>
                {cfg.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Tableau ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Barre tableau */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{total}</span> ticket{total > 1 ? 's' : ''}
            {activeStatus > 0 && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[activeStatus].badge}`}>
                {STATUS_CONFIG[activeStatus].label}
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <select
              value={limit}
              onChange={e => handleLimitChange(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white"
            >
              {LIMIT_OPTIONS.map(o => (
                <option key={o} value={o}>{o === 'all' ? 'Tout afficher' : `${o} par page`}</option>
              ))}
            </select>
            {!glpiUrl && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                ⚠️ URL GLPI non configurée
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium w-16">#</th>
                <th className="text-left px-4 py-2.5 font-medium">Titre</th>
                <th className="text-left px-4 py-2.5 font-medium w-36 hidden md:table-cell">Catégorie</th>
                <th className="text-left px-4 py-2.5 font-medium w-28">Priorité</th>
                <th className="text-left px-4 py-2.5 font-medium w-36">Statut</th>
                <th className="text-left px-4 py-2.5 font-medium w-36 hidden lg:table-cell">Technicien</th>
                <th className="text-left px-4 py-2.5 font-medium w-28 hidden xl:table-cell">Créé le</th>
                <th className="text-left px-4 py-2.5 font-medium w-28 hidden xl:table-cell">Modifié le</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400 text-sm">
                    Aucun ticket sur cette période
                  </td>
                </tr>
              ) : (
                tickets.map(ticket => {
                  const sCfg = STATUS_CONFIG[ticket.status]   || STATUS_CONFIG[0];
                  const pCfg = PRIORITY_CONFIG[ticket.priority] || {};
                  return (
                    <tr
                      key={ticket.id}
                      className={`border-b border-gray-100 hover:brightness-95 transition-all ${sCfg.row}`}
                    >
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{ticket.id}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-gray-800 line-clamp-1">{ticket.title}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs hidden md:table-cell">
                        <span className="truncate block max-w-[130px]">{ticket.category}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5">
                          {pCfg.dot && <span className={`w-2 h-2 rounded-full shrink-0 ${pCfg.dot}`} />}
                          <span className="text-xs text-gray-700">{ticket.priority_label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sCfg.badge}`}>
                          {ticket.status_label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs hidden lg:table-cell">
                        <span className="truncate block max-w-[130px]">{ticket.technicians}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs hidden xl:table-cell">{fmt(ticket.created_at)}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs hidden xl:table-cell">{fmt(ticket.updated_at)}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => openTicket(ticket.id)}
                          title="Ouvrir dans GLPI"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          disabled={!glpiUrl}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {limit !== 'all' && pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              Page {page} sur {pages} · {total} tickets
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-white">
                «
              </button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-white">
                ‹
              </button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                const p = Math.min(Math.max(page - 2 + i, 1), pages);
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      p === page ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 hover:bg-white'
                    }`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-white">
                ›
              </button>
              <button onClick={() => setPage(pages)} disabled={page === pages}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-white">
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
