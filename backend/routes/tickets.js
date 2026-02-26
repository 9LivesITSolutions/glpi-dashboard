const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getGlpiDb } = require('../db/glpiDb');

// Statuts GLPI
const STATUS_LABELS = {
  1: 'Nouveau',
  2: 'En cours (assigné)',
  3: 'En cours (planifié)',
  4: 'En attente',
  5: 'Résolu',
  6: 'Clôturé',
};

// ── GET /api/tickets/summary ──────────────────────────────────────────────────
// KPI bandeau : total, par statut, taux clôture
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const [rows] = await db.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 1) AS new_count,
        SUM(status IN (2,3)) AS in_progress,
        SUM(status = 4) AS pending,
        SUM(status = 5) AS solved,
        SUM(status = 6) AS closed
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND date >= ? AND date <= ?
    `, [from, to]);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tickets/by-status ────────────────────────────────────────────────
// Répartition par statut pour le donut
router.get('/by-status', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const [rows] = await db.execute(`
      SELECT status, COUNT(*) AS count
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND date >= ? AND date <= ?
      GROUP BY status
      ORDER BY status
    `, [from, to]);

    const result = rows.map(r => ({
      status: r.status,
      label: STATUS_LABELS[r.status] || `Statut ${r.status}`,
      count: r.count,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tickets/evolution ────────────────────────────────────────────────
// Volume de tickets par jour/semaine selon la plage
router.get('/evolution', authMiddleware, async (req, res) => {
  try {
    const { from, to, granularity } = getDateRange(req);
    const db = await getGlpiDb();

    let dateFormat;
    if (granularity === 'week') dateFormat = '%Y-%u'; // année-semaine ISO
    else if (granularity === 'month') dateFormat = '%Y-%m';
    else dateFormat = '%Y-%m-%d';

    const [rows] = await db.execute(`
      SELECT
        DATE_FORMAT(date, ?) AS period,
        COUNT(*) AS total,
        SUM(status IN (5,6)) AS resolved
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND date >= ? AND date <= ?
      GROUP BY period
      ORDER BY period
    `, [dateFormat, from, to]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tickets/by-priority ─────────────────────────────────────────────
router.get('/by-priority', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const PRIORITY_LABELS = { 1: 'Très haute', 2: 'Haute', 3: 'Moyenne', 4: 'Basse', 5: 'Très basse', 6: 'Majeure' };

    const [rows] = await db.execute(`
      SELECT priority, COUNT(*) AS count
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND date >= ? AND date <= ?
      GROUP BY priority
      ORDER BY priority
    `, [from, to]);

    res.json(rows.map(r => ({
      priority: r.priority,
      label: PRIORITY_LABELS[r.priority] || `P${r.priority}`,
      count: r.count,
    })));
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

    if (period === 'today') {
      from = to = today;
    } else if (period === 'week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      from = monday.toISOString().split('T')[0];
      to = today;
    } else if (period === 'month') {
      from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      to = today;
    } else if (period === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      from = first.toISOString().split('T')[0];
      to = last.toISOString().split('T')[0];
    } else if (period === 'quarter') {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      from = qStart.toISOString().split('T')[0];
      to = today;
    } else if (period === 'semester') {
      const sStart = new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
      from = sStart.toISOString().split('T')[0];
      to = today;
    }
  }

  // Defaults
  if (!from) from = '2020-01-01';
  if (!to) {
    const now = new Date();
    to = now.toISOString().split('T')[0];
  }

  // Granularité automatique
  const daysDiff = Math.ceil((new Date(to) - new Date(from)) / 86400000);
  let granularity = 'day';
  if (daysDiff > 90) granularity = 'week';
  if (daysDiff > 365) granularity = 'month';

  return {
    from: `${from} 00:00:00`,
    to: `${to} 23:59:59`,
    granularity,
  };
}

module.exports = router;
