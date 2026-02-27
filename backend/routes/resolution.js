const express = require('express');
const router  = express.Router();
const authMiddleware = require('../middleware/auth');
const { getGlpiDb } = require('../db/glpiDb');
const {
  loadStatusLogs,
  enrichWithActiveDuration,
  computeActiveStats,
} = require('../services/pauseCalculator');

// ── GET /api/resolution/average ───────────────────────────────────────────────
// Temps moyen de résolution — brut ET actif (hors pauses)
router.get('/average', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const [tickets] = await db.execute(`
      SELECT id, date, solvedate, status
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND status IN (5, 6)
        AND solvedate IS NOT NULL
        AND date >= ? AND date <= ?
        AND TIMESTAMPDIFF(MINUTE, date, solvedate) > 0
    `, [from, to]);

    if (tickets.length === 0) {
      return res.json({
        total_resolved:    0,
        avg_active_hours:  null,
        min_active_hours:  null,
        max_active_hours:  null,
        avg_brut_hours:    null,
        avg_pause_minutes: null,
      });
    }

    const logsMap = await loadStatusLogs(db, tickets.map(t => t.id));
    const enriched = enrichWithActiveDuration(tickets, logsMap);
    const stats    = computeActiveStats(enriched);

    res.json({
      total_resolved:    stats.count,
      avg_active_hours:  stats.avg_active_hours,
      min_active_hours:  stats.min_active_hours,
      max_active_hours:  stats.max_active_hours,
      avg_brut_hours:    stats.avg_brut_hours,
      avg_pause_minutes: stats.avg_pause_minutes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/resolution/evolution ─────────────────────────────────────────────
// Évolution temporelle — brut ET actif par période
router.get('/evolution', authMiddleware, async (req, res) => {
  try {
    const { from, to, granularity } = getDateRange(req);
    const db = await getGlpiDb();

    const [tickets] = await db.execute(`
      SELECT id, date, solvedate, status
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND status IN (5, 6)
        AND solvedate IS NOT NULL
        AND date >= ? AND date <= ?
        AND TIMESTAMPDIFF(MINUTE, date, solvedate) > 0
    `, [from, to]);

    if (tickets.length === 0) return res.json([]);

    const logsMap  = await loadStatusLogs(db, tickets.map(t => t.id));
    const enriched = enrichWithActiveDuration(tickets, logsMap);

    // Grouper par période
    const periodMap = new Map();

    for (const t of enriched) {
      const d = new Date(t.date);
      let period;
      if (granularity === 'month') {
        period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (granularity === 'week') {
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
        period = `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`;
      } else {
        period = d.toISOString().split('T')[0];
      }

      if (!periodMap.has(period)) periodMap.set(period, []);
      periodMap.get(period).push(t);
    }

    const result = [];
    for (const [period, group] of [...periodMap.entries()].sort()) {
      const stats = computeActiveStats(group);
      result.push({
        period,
        resolved_count:   stats.count,
        avg_active_hours: stats.avg_active_hours,
        avg_brut_hours:   stats.avg_brut_hours,
        avg_pause_minutes:stats.avg_pause_minutes,
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/resolution/by-priority ──────────────────────────────────────────
// Temps moyen actif par priorité
router.get('/by-priority', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const PRIORITY_LABELS = {
      1: 'Très haute', 2: 'Haute', 3: 'Moyenne',
      4: 'Basse', 5: 'Très basse', 6: 'Majeure',
    };

    const [tickets] = await db.execute(`
      SELECT id, date, solvedate, status, priority
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND status IN (5, 6)
        AND solvedate IS NOT NULL
        AND date >= ? AND date <= ?
        AND TIMESTAMPDIFF(MINUTE, date, solvedate) > 0
    `, [from, to]);

    if (tickets.length === 0) return res.json([]);

    const logsMap  = await loadStatusLogs(db, tickets.map(t => t.id));
    const enriched = enrichWithActiveDuration(tickets, logsMap);

    // Grouper par priorité
    const prioMap = new Map();
    for (const t of enriched) {
      if (!prioMap.has(t.priority)) prioMap.set(t.priority, []);
      prioMap.get(t.priority).push(t);
    }

    const result = [];
    for (const [prio, group] of [...prioMap.entries()].sort((a, b) => a[0] - b[0])) {
      const stats = computeActiveStats(group);
      result.push({
        priority:         parseInt(prio),
        label:            PRIORITY_LABELS[prio] || `P${prio}`,
        count:            stats.count,
        avg_active_hours: stats.avg_active_hours,
        avg_brut_hours:   stats.avg_brut_hours,
        avg_pause_minutes:stats.avg_pause_minutes,
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
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

  const daysDiff  = Math.ceil((new Date(to) - new Date(from)) / 86400000);
  let granularity = 'day';
  if (daysDiff > 90)  granularity = 'week';
  if (daysDiff > 365) granularity = 'month';

  return { from: `${from} 00:00:00`, to: `${to} 23:59:59`, granularity };
}

module.exports = router;
