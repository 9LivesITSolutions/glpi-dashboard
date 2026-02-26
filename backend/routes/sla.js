const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getGlpiDb } = require('../db/glpiDb');
const { getConfig } = require('../services/config');

// Délais cibles par défaut (en heures) — configurables via /api/sla/config
const DEFAULT_SLA_TARGETS = {
  1: 4,    // Très haute
  2: 8,    // Haute
  3: 24,   // Moyenne
  4: 72,   // Basse
  5: 168,  // Très basse
  6: 2,    // Majeure
};

const PRIORITY_LABELS = { 1: 'Très haute', 2: 'Haute', 3: 'Moyenne', 4: 'Basse', 5: 'Très basse', 6: 'Majeure' };

// ── GET /api/sla/summary ──────────────────────────────────────────────────────
// Taux SLA global et par priorité
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    // Chargement des cibles configurées (ou défauts)
    const savedTargets = await getConfig('sla_targets') || {};
    const targets = { ...DEFAULT_SLA_TARGETS, ...savedTargets };

    // Construction du CASE pour vérifier le respect SLA par priorité
    const caseExpr = Object.entries(targets)
      .map(([prio, hours]) => `WHEN priority = ${prio} THEN ${hours * 60}`)
      .join(' ');

    const [rows] = await db.execute(`
      SELECT
        priority,
        COUNT(*) AS total,
        SUM(
          CASE WHEN status IN (5,6) AND solvedate IS NOT NULL
            AND TIMESTAMPDIFF(MINUTE, date, solvedate) <= (CASE ${caseExpr} ELSE 1440 END)
            THEN 1 ELSE 0
          END
        ) AS within_sla,
        SUM(
          CASE WHEN status IN (5,6) AND solvedate IS NOT NULL
            AND TIMESTAMPDIFF(MINUTE, date, solvedate) > (CASE ${caseExpr} ELSE 1440 END)
            THEN 1 ELSE 0
          END
        ) AS breached_sla,
        SUM(status NOT IN (5,6)) AS still_open
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND date >= ? AND date <= ?
      GROUP BY priority
      ORDER BY priority
    `, [from, to]);

    const result = rows.map(r => {
      const resolved = parseInt(r.within_sla) + parseInt(r.breached_sla);
      const rate = resolved > 0 ? Math.round((r.within_sla / resolved) * 100 * 10) / 10 : null;
      return {
        priority: r.priority,
        label: PRIORITY_LABELS[r.priority] || `P${r.priority}`,
        target_hours: targets[r.priority] || null,
        total: r.total,
        within_sla: r.within_sla,
        breached_sla: r.breached_sla,
        still_open: r.still_open,
        sla_rate: rate,
      };
    });

    // KPI global (toutes priorités confondues)
    const totalResolved = result.reduce((s, r) => s + parseInt(r.within_sla) + parseInt(r.breached_sla), 0);
    const totalWithin = result.reduce((s, r) => s + parseInt(r.within_sla), 0);
    const globalRate = totalResolved > 0 ? Math.round((totalWithin / totalResolved) * 100 * 10) / 10 : null;

    res.json({ global_rate: globalRate, by_priority: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sla/targets ──────────────────────────────────────────────────────
router.get('/targets', authMiddleware, async (req, res) => {
  const saved = await getConfig('sla_targets') || {};
  const targets = { ...DEFAULT_SLA_TARGETS, ...saved };
  const result = Object.entries(targets).map(([prio, hours]) => ({
    priority: parseInt(prio),
    label: PRIORITY_LABELS[prio] || `P${prio}`,
    target_hours: hours,
  }));
  res.json(result);
});

// ── PUT /api/sla/targets ──────────────────────────────────────────────────────
router.put('/targets', authMiddleware, async (req, res) => {
  try {
    const { setConfig } = require('../services/config');
    const targets = req.body; // { "1": 4, "2": 8, ... }
    await setConfig('sla_targets', targets);
    res.json({ success: true, message: 'Cibles SLA sauvegardées' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getDateRange(req) {
  let { from, to, period } = req.query;

  if (period) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
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
      to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (period === 'quarter') {
      from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().split('T')[0];
      to = today;
    } else if (period === 'semester') {
      from = new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1).toISOString().split('T')[0];
      to = today;
    }
  }

  if (!from) from = '2020-01-01';
  if (!to) to = new Date().toISOString().split('T')[0];

  return { from: `${from} 00:00:00`, to: `${to} 23:59:59` };
}

module.exports = router;
