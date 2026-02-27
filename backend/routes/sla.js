/**
 * routes/sla.js
 * 
 * SLA hybride : priorité au SLA natif GLPI (time_to_resolve),
 * calcul manuel pour les tickets sans SLA configuré.
 * 
 * Dans les deux cas, le temps en pause (status=4) est exclu du délai :
 *  - SLA GLPI : GLPI recalcule time_to_resolve à chaque sortie de pause ✓
 *  - SLA manuel : on ajoute la durée de pause à la deadline calculée ✓
 */

const express = require('express');
const router  = express.Router();
const authMiddleware = require('../middleware/auth');
const { getGlpiDb }  = require('../db/glpiDb');
const { getConfig, setConfig } = require('../services/config');
const { loadStatusLogs, calcPauseMinutes } = require('../services/pauseCalculator');

const DEFAULT_SLA_TARGETS = {
  1: 4, 2: 8, 3: 24, 4: 72, 5: 168, 6: 2,
};

const PRIORITY_LABELS = {
  1: 'Très haute', 2: 'Haute', 3: 'Moyenne',
  4: 'Basse', 5: 'Très basse', 6: 'Majeure',
};

// ── GET /api/sla/summary ──────────────────────────────────────────────────────
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const savedTargets = await getConfig('sla_targets') || {};
    const targets = { ...DEFAULT_SLA_TARGETS, ...savedTargets };

    // Récupérer tous les tickets résolus + en cours de la période
    // avec leurs champs SLA GLPI natifs
    const [tickets] = await db.execute(`
      SELECT
        id, date, solvedate, priority, status,
        slas_id_ttr,
        time_to_resolve
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND date >= ? AND date <= ?
    `, [from, to]);

    if (tickets.length === 0) {
      return res.json({
        global_rate:        null,
        global_glpi_rate:   null,
        global_manual_rate: null,
        by_priority:        [],
        meta: { total_resolved: 0, tickets_glpi_sla: 0, tickets_manual_sla: 0 },
      });
    }

    // Tickets résolus uniquement pour le calcul SLA
    const resolved = tickets.filter(t => [5, 6].includes(t.status) && t.solvedate);

    // Charger les logs de pause en batch pour les tickets sans SLA GLPI natif
    const manualTickets = resolved.filter(
      t => !t.slas_id_ttr || t.slas_id_ttr === 0 || !t.time_to_resolve
    );
    const logsMap = await loadStatusLogs(db, manualTickets.map(t => t.id));

    // Calculer le résultat SLA pour chaque ticket
    const results = resolved.map(ticket => {
      const solvedate  = new Date(ticket.solvedate);
      const dateCreate = new Date(ticket.date);
      const hasGlpiSla = ticket.slas_id_ttr > 0 && ticket.time_to_resolve;

      let deadline, sla_source;

      if (hasGlpiSla) {
        // CAS 1 : SLA GLPI natif — deadline précalculée par GLPI (pauses déjà exclues)
        deadline   = new Date(ticket.time_to_resolve);
        sla_source = 'glpi';
      } else {
        // CAS 2 : SLA manuel — deadline = création + délai_priorité + pauses
        const targetMinutes = (targets[ticket.priority] || 24) * 60;
        const logs          = logsMap.get(ticket.id) || [];
        const pauseMinutes  = calcPauseMinutes(logs, solvedate);
        deadline   = new Date(dateCreate.getTime() + (targetMinutes + pauseMinutes) * 60000);
        sla_source = 'manual';
      }

      const sla_ok = solvedate <= deadline;

      return {
        priority:   ticket.priority,
        sla_source,
        sla_ok,
        hasGlpiSla,
      };
    });

    // Agrégation par priorité
    const prioMap = new Map();

    for (const t of tickets) {
      if (!prioMap.has(t.priority)) {
        prioMap.set(t.priority, {
          total: 0, still_open: 0,
          glpi_within: 0, glpi_breached: 0,
          manual_within: 0, manual_breached: 0,
        });
      }
      const p = prioMap.get(t.priority);
      p.total++;
      if (![5, 6].includes(t.status) || !t.solvedate) p.still_open++;
    }

    for (const r of results) {
      const p = prioMap.get(r.priority);
      if (!p) continue;
      if (r.sla_source === 'glpi') {
        r.sla_ok ? p.glpi_within++ : p.glpi_breached++;
      } else {
        r.sla_ok ? p.manual_within++ : p.manual_breached++;
      }
    }

    const by_priority = [...prioMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([priority, p]) => {
        const within_sla  = p.glpi_within  + p.manual_within;
        const breached_sla = p.glpi_breached + p.manual_breached;
        const total_resolved = within_sla + breached_sla;

        const sla_rate        = total_resolved > 0 ? round1(within_sla / total_resolved * 100) : null;
        const glpi_total      = p.glpi_within + p.glpi_breached;
        const manual_total    = p.manual_within + p.manual_breached;
        const glpi_sla_rate   = glpi_total   > 0 ? round1(p.glpi_within   / glpi_total   * 100) : null;
        const manual_sla_rate = manual_total > 0 ? round1(p.manual_within / manual_total * 100) : null;

        return {
          priority:         parseInt(priority),
          label:            PRIORITY_LABELS[priority] || `P${priority}`,
          target_hours:     targets[priority] || null,
          total:            p.total,
          within_sla,
          breached_sla,
          still_open:       p.still_open,
          sla_rate,
          glpi_within:      p.glpi_within,
          glpi_breached:    p.glpi_breached,
          glpi_sla_rate,
          manual_within:    p.manual_within,
          manual_breached:  p.manual_breached,
          manual_sla_rate,
        };
      });

    // Métriques globales
    const totalResolved   = results.length;
    const totalWithin     = results.filter(r => r.sla_ok).length;
    const glpiResults     = results.filter(r => r.sla_source === 'glpi');
    const manualResults   = results.filter(r => r.sla_source === 'manual');
    const glpiWithin      = glpiResults.filter(r => r.sla_ok).length;
    const manualWithin    = manualResults.filter(r => r.sla_ok).length;

    res.json({
      global_rate:        totalResolved  > 0 ? round1(totalWithin  / totalResolved  * 100) : null,
      global_glpi_rate:   glpiResults.length > 0 ? round1(glpiWithin   / glpiResults.length * 100) : null,
      global_manual_rate: manualResults.length > 0 ? round1(manualWithin / manualResults.length * 100) : null,
      by_priority,
      meta: {
        total_resolved:    totalResolved,
        tickets_glpi_sla:  glpiResults.length,
        tickets_manual_sla: manualResults.length,
      },
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sla/targets ──────────────────────────────────────────────────────
router.get('/targets', authMiddleware, async (req, res) => {
  const saved   = await getConfig('sla_targets') || {};
  const targets = { ...DEFAULT_SLA_TARGETS, ...saved };
  res.json(Object.entries(targets).map(([prio, hours]) => ({
    priority:     parseInt(prio),
    label:        PRIORITY_LABELS[prio] || `P${prio}`,
    target_hours: hours,
  })));
});

// ── PUT /api/sla/targets ──────────────────────────────────────────────────────
router.put('/targets', authMiddleware, async (req, res) => {
  try {
    await setConfig('sla_targets', req.body);
    res.json({ success: true, message: 'Cibles SLA sauvegardées' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const round1 = (n) => Math.round(n * 10) / 10;

function getDateRange(req) {
  let { from, to, period } = req.query;
  if (period) {
    const now  = new Date();
    const pad  = (n) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (period === 'today') { from = to = today; }
    else if (period === 'week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      from = monday.toISOString().split('T')[0]; to = today;
    } else if (period === 'month') {
      from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`; to = today;
    } else if (period === 'last_month') {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      to   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (period === 'quarter') {
      from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().split('T')[0];
      to = today;
    } else if (period === 'semester') {
      from = new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1).toISOString().split('T')[0];
      to = today;
    }
  }
  if (!from) from = '2020-01-01';
  if (!to)   to   = new Date().toISOString().split('T')[0];
  return { from: `${from} 00:00:00`, to: `${to} 23:59:59` };
}

module.exports = router;
