/**
 * pauseCalculator.js
 * 
 * Calcule les durées de pause (status=4 En attente) pour un ensemble de tickets
 * en utilisant glpi_tickets_logs (id_search_option=12 = changement de statut).
 * 
 * Optimisé : une seule requête SQL pour tous les tickets de la période,
 * groupement et calcul en JS.
 */

const STATUS_PENDING = '4';

/**
 * Charge les logs de changement de statut pour une liste de ticket IDs
 * Retourne un Map<ticketId, [{date_mod, old_value, new_value}]>
 */
async function loadStatusLogs(db, ticketIds) {
  if (!ticketIds || ticketIds.length === 0) return new Map();

  // Découper en chunks de 1000 pour éviter des requêtes trop larges
  const CHUNK = 1000;
  const allLogs = [];

  for (let i = 0; i < ticketIds.length; i += CHUNK) {
    const chunk = ticketIds.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(',');

    const [rows] = await db.execute(`
      SELECT tickets_id, date_mod, old_value, new_value
      FROM glpi_tickets_logs
      WHERE id_search_option = 12
        AND tickets_id IN (${placeholders})
      ORDER BY tickets_id ASC, date_mod ASC
    `, chunk);

    allLogs.push(...rows);
  }

  // Grouper par tickets_id
  const logsMap = new Map();
  for (const row of allLogs) {
    const id = row.tickets_id;
    if (!logsMap.has(id)) logsMap.set(id, []);
    logsMap.get(id).push({
      date_mod:  new Date(row.date_mod),
      old_value: String(row.old_value),
      new_value: String(row.new_value),
    });
  }

  return logsMap;
}

/**
 * Calcule la durée totale en pause (minutes) pour un ticket
 * à partir de son historique de statuts trié par date ASC.
 * 
 * Gère plusieurs cycles pause/reprise sur le même ticket.
 * Gère le cas où le ticket est encore en pause au moment du solvedate
 * (ne devrait pas arriver mais sécurité).
 * 
 * @param {Array}  logs       - [{date_mod, old_value, new_value}]
 * @param {Date}   solvedate  - date de résolution du ticket
 * @returns {number}           - minutes en pause
 */
function calcPauseMinutes(logs, solvedate) {
  if (!logs || logs.length === 0) return 0;

  let pauseStart = null;
  let totalPauseMinutes = 0;

  for (const log of logs) {
    // Entrée en pause : new_value devient 4
    if (log.new_value === STATUS_PENDING && pauseStart === null) {
      pauseStart = log.date_mod;
    }

    // Sortie de pause : old_value était 4 et on passe à autre chose
    if (log.old_value === STATUS_PENDING && log.new_value !== STATUS_PENDING && pauseStart !== null) {
      const pauseEnd = log.date_mod;
      const diff = (pauseEnd - pauseStart) / 60000; // ms → minutes
      if (diff > 0) totalPauseMinutes += diff;
      pauseStart = null;
    }
  }

  // Si on termine encore en pause (cas limite), on compte jusqu'au solvedate
  if (pauseStart !== null && solvedate) {
    const diff = (new Date(solvedate) - pauseStart) / 60000;
    if (diff > 0) totalPauseMinutes += diff;
  }

  return Math.round(totalPauseMinutes);
}

/**
 * Enrichit une liste de tickets avec :
 * - pause_minutes        : durée cumulée en pause
 * - active_minutes       : durée active (brut - pause)
 * - active_hours         : même chose en heures arrondies
 * 
 * @param {Array}  tickets  - [{id, date, solvedate, ...}]
 * @param {Map}    logsMap  - Map<ticketId, logs[]>
 * @returns {Array}          - tickets enrichis
 */
function enrichWithActiveDuration(tickets, logsMap) {
  return tickets.map(ticket => {
    const logs       = logsMap.get(ticket.id) || [];
    const solvedate  = ticket.solvedate ? new Date(ticket.solvedate) : null;
    const dateCreate = new Date(ticket.date);

    const brut_minutes  = solvedate
      ? Math.max(0, Math.round((solvedate - dateCreate) / 60000))
      : null;

    const pause_minutes = solvedate
      ? calcPauseMinutes(logs, solvedate)
      : 0;

    const active_minutes = brut_minutes !== null
      ? Math.max(0, brut_minutes - pause_minutes)
      : null;

    return {
      ...ticket,
      pause_minutes,
      active_minutes,
      active_hours:  active_minutes !== null ? Math.round(active_minutes / 60 * 100) / 100 : null,
      brut_minutes,
      brut_hours:    brut_minutes   !== null ? Math.round(brut_minutes   / 60 * 100) / 100 : null,
    };
  });
}

/**
 * Calcule les statistiques agrégées de temps actif sur un tableau de tickets enrichis
 */
function computeActiveStats(enrichedTickets) {
  const resolved = enrichedTickets.filter(t => t.active_minutes !== null);
  if (resolved.length === 0) {
    return {
      count: 0,
      avg_active_hours:  null,
      min_active_hours:  null,
      max_active_hours:  null,
      avg_brut_hours:    null,
      avg_pause_minutes: null,
    };
  }

  const totalActive = resolved.reduce((s, t) => s + t.active_minutes, 0);
  const totalBrut   = resolved.reduce((s, t) => s + t.brut_minutes, 0);
  const totalPause  = resolved.reduce((s, t) => s + t.pause_minutes, 0);
  const minActive   = Math.min(...resolved.map(t => t.active_minutes));
  const maxActive   = Math.max(...resolved.map(t => t.active_minutes));

  return {
    count:             resolved.length,
    avg_active_hours:  Math.round(totalActive / resolved.length / 60 * 100) / 100,
    min_active_hours:  Math.round(minActive / 60 * 100) / 100,
    max_active_hours:  Math.round(maxActive / 60 * 100) / 100,
    avg_brut_hours:    Math.round(totalBrut  / resolved.length / 60 * 100) / 100,
    avg_pause_minutes: Math.round(totalPause / resolved.length),
  };
}

module.exports = { loadStatusLogs, calcPauseMinutes, enrichWithActiveDuration, computeActiveStats };
