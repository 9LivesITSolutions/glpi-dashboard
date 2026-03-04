import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import DateRangePicker from '../components/dashboard/DateRangePicker';

const STATUS_CONFIG = {
  0: { label: 'Tous',                bg: 'bg-gray-100',   text: 'text-gray-700',   row: '',             badge: 'bg-gray-100 text-gray-600'    },
  1: { label: 'Nouveau',             bg: 'bg-slate-100',  text: 'text-slate-700',  row: 'bg-slate-50',  badge: 'bg-slate-100 text-slate-700'  },
  2: { label: 'En cours',            bg: 'bg-blue-100',   text: 'text-blue-700',   row: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700'    },
  3: { label: 'En cours (planif.)',  bg: 'bg-indigo-100', text: 'text-indigo-700', row: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700' },
  4: { label: 'En attente',          bg: 'bg-amber-100',  text: 'text-amber-700',  row: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700'  },
  5: { label: 'Resolu',              bg: 'bg-green-100',  text: 'text-green-700',  row: 'bg-green-50',  badge: 'bg-green-100 text-green-700'  },
  6: { label: 'Cloture',             bg: 'bg-gray-200',   text: 'text-gray-600',   row: 'bg-gray-50',   badge: 'bg-gray-200 text-gray-600'    },
};

const PRIORITY_CONFIG = {
  1: { label: 'Tres haute', dot: 'bg-red-500'    },
  2: { label: 'Haute',      dot: 'bg-orange-400' },
  3: { label: 'Moyenne',    dot: 'bg-yellow-400' },
  4: { label: 'Basse',      dot: 'bg-blue-400'   },
  5: { label: 'Tres basse', dot: 'bg-gray-400'   },
  6: { label: 'Majeure',    dot: 'bg-purple-500' },
};

const LIMIT_OPTIONS = [50, 100, 200, 500, 'all'];

const COLUMNS = [
  { key: 'id',          label: '#',          sortable: true,  width: 'w-16' },
  { key: 'title',       label: 'Titre',      sortable: true,  width: ''     },
  { key: 'category',    label: 'Categorie',  sortable: true,  width: 'w-36', hide: 'md' },
  { key: 'priority',    label: 'Priorite',   sortable: true,  width: 'w-28' },
  { key: 'status',      label: 'Statut',     sortable: true,  width: 'w-36' },
  { key: 'technicians', label: 'Technicien', sortable: true,  width: 'w-36', hide: 'lg' },
  { key: 'created_at',  label: 'Cree le',    sortable: true,  width: 'w-28', hide: 'xl' },
  { key: 'updated_at',  label: 'Modifie le', sortable: true,  width: 'w-28', hide: 'xl' },
];

export default function TicketsView({ dateFilter, onDateChange, refreshTick = 0 }) {
  const [activeStatus, setActiveStatus] = useState(0);
  const [tickets, setTickets]           = useState([]);
  const [summary, setSummary]           = useState({});
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [pages, setPages]               = useState(1);
  const [limit, setLimit]               = useState(50);
  const [loading, setLoading]           = useState(true);
  const [glpiUrl, setGlpiUrl]           = useState('');
  const [sortKey, setSortKey]           = useState('priority');
  const [sortDir, setSortDir]           = useState('asc');
  const [searchUser, setSearchUser]     = useState('');
  const [searchCat, setSearchCat]       = useState('');

  const params = dateFilter && dateFilter.period === 'custom'
    ? { from: dateFilter.from, to: dateFilter.to }
    : { period: (dateFilter && dateFilter.period) || 'month' };

  useEffect(() => {
    axios.get('/admin/glpi-url/public').then(function(r) { setGlpiUrl(r.data.url || ''); }).catch(function() {});
  }, []);

  useEffect(() => {
    axios.get('/tickets/summary', { params: params }).then(function(r) { setSummary(r.data); }).catch(console.error);
  }, [JSON.stringify(params)]);

  const fetchTickets = useCallback(function(silent) {
    if (!silent) setLoading(true);
    var q = Object.assign({}, params, { page: page, limit: limit, sort: sortKey, dir: sortDir });
    if (activeStatus) q.status = activeStatus;
    if (searchUser)   q.user     = searchUser;
    if (searchCat)    q.category = searchCat;
    axios.get('/tickets/list', { params: q })
      .then(function(r) {
        setTickets(r.data.tickets);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(console.error)
      .finally(function() { if (!silent) setLoading(false); });
  }, [JSON.stringify(params), activeStatus, page, limit, sortKey, sortDir, searchUser, searchCat]);

  // Ref toujours à jour pour le silent refresh (évite la closure périmée)
  var fetchTicketsRef = useRef(fetchTickets);
  useEffect(function() { fetchTicketsRef.current = fetchTickets; }, [fetchTickets]);

  useEffect(function() { fetchTickets(false); }, [fetchTickets]);

  // Silent refresh déclenché par le parent — utilise la ref pour avoir la version courante
  useEffect(function() {
    if (refreshTick > 0) fetchTicketsRef.current(true);
  }, [refreshTick]);

  function handleSort(key) {
    if (!key) return;
    if (sortKey === key) { setSortDir(function(d) { return d === 'asc' ? 'desc' : 'asc'; }); }
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  }

  function openTicket(id) {
    if (!glpiUrl) { alert('URL GLPI non configuree - Administration > GLPI'); return; }
    window.open(glpiUrl + '/front/ticket.form.php?id=' + id, '_blank');
  }

  function fmt(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function SortIcon(props) {
    var col = props.col;
    if (!col.sortable) return null;
    if (sortKey !== col.key) return React.createElement('svg', { className: 'w-3 h-3 text-gray-300 shrink-0', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
      React.createElement('path', { d: 'M7 15l5 5 5-5M7 9l5-5 5 5' })
    );
    return sortDir === 'asc'
      ? React.createElement('svg', { className: 'w-3 h-3 text-blue-500 shrink-0', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }, React.createElement('path', { d: 'M5 15l7-7 7 7' }))
      : React.createElement('svg', { className: 'w-3 h-3 text-blue-500 shrink-0', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }, React.createElement('path', { d: 'M19 9l-7 7-7-7' }));
  }

  var kpiCards = [
    { status: 0, count: summary.total       || 0 },
    { status: 1, count: summary.new_count   || 0 },
    { status: 2, count: summary.in_progress || 0 },
    { status: 4, count: summary.pending     || 0 },
    { status: 5, count: summary.solved      || 0 },
    { status: 6, count: summary.closed      || 0 },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">Listing et KPIs par statut</p>
        </div>
      </div>

      <div className="mb-6">
        <DateRangePicker value={dateFilter} onChange={onDateChange} />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {kpiCards.map(function(item) {
          var cfg    = STATUS_CONFIG[item.status];
          var active = activeStatus === item.status;
          return (
            <button key={item.status}
              onClick={function() { setActiveStatus(item.status); setPage(1); }}
              className={'rounded-xl p-3 text-left border-2 transition-all ' + (active ? cfg.bg + ' ' + cfg.text + ' border-current shadow-md scale-105' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm')}
            >
              <p className={'text-2xl font-bold ' + (active ? cfg.text : 'text-gray-800')}>{item.count}</p>
              <p className={'text-xs font-medium mt-0.5 ' + (active ? cfg.text : 'text-gray-500')}>{cfg.label}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <input type="text" placeholder="Filtrer par technicien..." value={searchUser}
            onChange={function(e) { setSearchUser(e.target.value); setPage(1); }}
            className="pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 w-52" />
          {searchUser && (
            <button onClick={function() { setSearchUser(''); setPage(1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-base leading-none">x</button>
          )}
        </div>
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h10M4 18h7"/>
          </svg>
          <input type="text" placeholder="Filtrer par categorie..." value={searchCat}
            onChange={function(e) { setSearchCat(e.target.value); setPage(1); }}
            className="pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 w-52" />
          {searchCat && (
            <button onClick={function() { setSearchCat(''); setPage(1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-base leading-none">x</button>
          )}
        </div>
        {(searchUser || searchCat) && (
          <button onClick={function() { setSearchUser(''); setSearchCat(''); setPage(1); }}
            className="text-xs text-gray-500 hover:text-red-500 px-3 py-2 border border-gray-200 rounded-lg bg-white transition-colors">
            Reinitialiser
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{total}</span> ticket{total > 1 ? 's' : ''}
            {activeStatus > 0 && (
              <span className={'ml-2 text-xs px-2 py-0.5 rounded-full ' + STATUS_CONFIG[activeStatus].badge}>
                {STATUS_CONFIG[activeStatus].label}
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <select value={limit}
              onChange={function(e) { setLimit(e.target.value === 'all' ? 'all' : parseInt(e.target.value)); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white">
              {LIMIT_OPTIONS.map(function(o) {
                return <option key={o} value={o}>{o === 'all' ? 'Tout afficher' : o + ' par page'}</option>;
              })}
            </select>
            {!glpiUrl && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                URL GLPI non configuree
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                {COLUMNS.map(function(col) {
                  return (
                    <th key={col.key}
                      onClick={function() { if (col.sortable) handleSort(col.key); }}
                      className={[
                        'text-left px-4 py-2.5 font-medium', col.width,
                        col.hide === 'md' ? 'hidden md:table-cell' : '',
                        col.hide === 'lg' ? 'hidden lg:table-cell' : '',
                        col.hide === 'xl' ? 'hidden xl:table-cell' : '',
                        col.sortable ? 'cursor-pointer hover:text-gray-700 select-none' : '',
                      ].join(' ')}>
                      <span className="flex items-center gap-1">
                        {col.label}
                        <SortIcon col={col} />
                      </span>
                    </th>
                  );
                })}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map(function(_, i) {
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: 9 }).map(function(__, j) {
                        return <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded animate-pulse" /></td>;
                      })}
                    </tr>
                  );
                })
              ) : tickets.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">Aucun ticket sur cette periode</td></tr>
              ) : (
                tickets.map(function(ticket) {
                  var sCfg = STATUS_CONFIG[ticket.status]     || STATUS_CONFIG[0];
                  var pCfg = PRIORITY_CONFIG[ticket.priority] || {};
                  return (
                    <tr key={ticket.id} className={'border-b border-gray-100 hover:brightness-95 transition-all ' + sCfg.row}>
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{ticket.id}</td>
                      <td className="px-4 py-2.5"><span className="font-medium text-gray-800 line-clamp-1">{ticket.title}</span></td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 hidden md:table-cell">
                        <span className="truncate block max-w-xs">{ticket.category}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5">
                          {pCfg.dot && <span className={'w-2 h-2 rounded-full shrink-0 ' + pCfg.dot} />}
                          <span className="text-xs text-gray-700">{ticket.priority_label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + sCfg.badge}>{ticket.status_label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 hidden lg:table-cell">
                        <span className="truncate block max-w-xs">{ticket.technicians}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 hidden xl:table-cell">{fmt(ticket.created_at)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 hidden xl:table-cell">{fmt(ticket.updated_at)}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={function() { openTicket(ticket.id); }} title="Ouvrir dans GLPI"
                          disabled={!glpiUrl}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-30">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
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

        {limit !== 'all' && pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">Page {page} sur {pages} - {total} tickets</p>
            <div className="flex gap-1">
              <button onClick={function() { setPage(1); }} disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-white">«</button>
              <button onClick={function() { setPage(function(p) { return Math.max(1, p - 1); }); }} disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-white">‹</button>
              {Array.from({ length: Math.min(5, pages) }, function(_, i) {
                var p = Math.min(Math.max(page - 2 + i, 1), pages);
                return (
                  <button key={p} onClick={function() { setPage(p); }}
                    className={'px-2.5 py-1 text-xs rounded border transition-colors ' + (p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-white')}>
                    {p}
                  </button>
                );
              })}
              <button onClick={function() { setPage(function(p) { return Math.min(pages, p + 1); }); }} disabled={page === pages}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-white">›</button>
              <button onClick={function() { setPage(pages); }} disabled={page === pages}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-white">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
