/**
 * pauseCalculator.js
 *
 * Calcule les durées de pause (status=4 En attente) pour un ensemble de tickets.
 *
 * GLPI stocke l'historique dans glpi_logs :
 *   itemtype = 'Ticket'
 *   items_id = id du ticket
 *   id_search_option = 12  (champ statut)
 *   old_value / new_value  = labels texte ("En attente", "En cours (assigné)"...)
 *
 * Les valeurs possibles du statut dans les logs GLPI sont des labels traduits
 * OU des entiers selon la version. On détecte les deux.
 */

// Labels GLPI pour "En attente" selon la langue configurée
const PENDING_LABELS = ['en attente', 'pending', 'waiting', '4'];

function isPending(val) {
  if (!val) return false;
  return PENDING_LABELS.includes(String(val).toLowerCase().trim());
}

/**
 * Charge les logs de changement de statut depuis glpi_logs
 * Retourne un Map<ticketId, [{date_mod, old_value, new_value}]>
 */
async function loadStatusLogs(db, ticketIds) {
  if (!ticketIds || ticketIds.length === 0) return new Map();

  const CHUNK = 1000;
  const allLogs = [];

  for (let i = 0; i < ticketIds.length; i += CHUNK) {
    const chunk = ticketIds.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(',');

    // Essai 1 : glpi_logs (GLPI 10.x standard)
    let rows = [];
    try {
      [rows] = await db.execute(`
        SELECT items_id AS tickets_id, date_mod, old_value, new_value
        FROM glpi_logs
        WHERE itemtype = 'Ticket'
          AND id_search_option = 12
          AND items_id IN (${placeholders})
        ORDER BY items_id ASC, date_mod ASC
      `, chunk);
    } catch (e1) {
      // Essai 2 : glpi_tickets_logs (certaines versions)
      try {
        [rows] = await db.execute(`
          SELECT tickets_id, date_mod, old_value, new_value
          FROM glpi_tickets_logs
          WHERE id_search_option = 12
            AND tickets_id IN (${placeholders})
          ORDER BY tickets_id ASC, date_mod ASC
        `, chunk);
      } catch (e2) {
        console.warn('[pauseCalculator] Aucune table de logs accessible:', e2.message);
        return new Map();
      }
    }

    allLogs.push(...rows);
  }

  // Grouper par tickets_id
  const logsMap = new Map();
  for (const row of allLogs) {
    const id = row.tickets_id;
    if (!logsMap.has(id)) logsMap.set(id, []);
    logsMap.get(id).push({
      date_mod:  new Date(row.date_mod),
      old_value: String(row.old_value ?? ''),
      new_value: String(row.new_value ?? ''),
    });
  }

  return logsMap;
}

/**
 * Calcule la durée totale en pause (minutes) pour un ticket
 */
function calcPauseMinutes(logs, solvedate) {
  if (!logs || logs.length === 0) return 0;

  let pauseStart = null;
  let totalPauseMinutes = 0;

  for (const log of logs) {
    // Entrée en pause
    if (isPending(log.new_value) && !isPending(log.old_value) && pauseStart === null) {
      pauseStart = log.date_mod;
    }
    // Sortie de pause
    if (isPending(log.old_value) && !isPending(log.new_value) && pauseStart !== null) {
      const diff = (log.date_mod - pauseStart) / 60000;
      if (diff > 0) totalPauseMinutes += diff;
      pauseStart = null;
    }
  }

  // Encore en pause au moment du solvedate (cas limite)
  if (pauseStart !== null && solvedate) {
    const diff = (new Date(solvedate) - pauseStart) / 60000;
    if (diff > 0) totalPauseMinutes += diff;
  }

  return Math.round(totalPauseMinutes);
}

/**
 * Enrichit une liste de tickets avec pause_minutes, active_minutes, active_hours
 */
function enrichWithActiveDuration(tickets, logsMap) {
  return tickets.map(ticket => {
    const logs       = logsMap.get(ticket.id) || [];
    const solvedate  = ticket.solvedate ? new Date(ticket.solvedate) : null;
    const dateCreate = new Date(ticket.date);

    const brut_minutes = solvedate
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
      active_hours: active_minutes !== null ? Math.round(active_minutes / 60 * 100) / 100 : null,
      brut_minutes,
      brut_hours:   brut_minutes   !== null ? Math.round(brut_minutes   / 60 * 100) / 100 : null,
    };
  });
}

/**
 * Stats agrégées sur un tableau de tickets enrichis
 */
function computeActiveStats(enrichedTickets) {
  const resolved = enrichedTickets.filter(t => t.active_minutes !== null);
  if (resolved.length === 0) {
    return { count: 0, avg_active_hours: null, min_active_hours: null, max_active_hours: null, avg_brut_hours: null, avg_pause_minutes: null };
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
