const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getGlpiDb } = require('../db/glpiDb');

// ── GET /api/resolution/average ───────────────────────────────────────────────
// Temps moyen de résolution global sur la période (en heures)
router.get('/average', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const [rows] = await db.execute(`
      SELECT
        COUNT(*) AS total_resolved,
        ROUND(AVG(TIMESTAMPDIFF(MINUTE, date, solvedate)) / 60.0, 2) AS avg_hours,
        ROUND(MIN(TIMESTAMPDIFF(MINUTE, date, solvedate)) / 60.0, 2) AS min_hours,
        ROUND(MAX(TIMESTAMPDIFF(MINUTE, date, solvedate)) / 60.0, 2) AS max_hours,
        ROUND(AVG(TIMESTAMPDIFF(MINUTE, date, solvedate)) / 60.0 / 24.0, 2) AS avg_days
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND status IN (5, 6)
        AND solvedate IS NOT NULL
        AND date >= ? AND date <= ?
        AND TIMESTAMPDIFF(MINUTE, date, solvedate) > 0
    `, [from, to]);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/resolution/evolution ────────────────────────────────────────────
// Évolution du temps moyen dans le temps
router.get('/evolution', authMiddleware, async (req, res) => {
  try {
    const { from, to, granularity } = getDateRange(req);
    const db = await getGlpiDb();

    let dateFormat;
    if (granularity === 'week') dateFormat = '%Y-%u';
    else if (granularity === 'month') dateFormat = '%Y-%m';
    else dateFormat = '%Y-%m-%d';

    const [rows] = await db.execute(`
      SELECT
        DATE_FORMAT(solvedate, ?) AS period,
        COUNT(*) AS resolved_count,
        ROUND(AVG(TIMESTAMPDIFF(MINUTE, date, solvedate)) / 60.0, 2) AS avg_hours
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND status IN (5, 6)
        AND solvedate IS NOT NULL
        AND date >= ? AND date <= ?
        AND TIMESTAMPDIFF(MINUTE, date, solvedate) > 0
      GROUP BY period
      ORDER BY period
    `, [dateFormat, from, to]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/resolution/by-priority ──────────────────────────────────────────
// Temps moyen par priorité
router.get('/by-priority', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const PRIORITY_LABELS = { 1: 'Très haute', 2: 'Haute', 3: 'Moyenne', 4: 'Basse', 5: 'Très basse', 6: 'Majeure' };

    const [rows] = await db.execute(`
      SELECT
        priority,
        COUNT(*) AS count,
        ROUND(AVG(TIMESTAMPDIFF(MINUTE, date, solvedate)) / 60.0, 2) AS avg_hours
      FROM glpi_tickets
      WHERE is_deleted = 0
        AND status IN (5, 6)
        AND solvedate IS NOT NULL
        AND date >= ? AND date <= ?
        AND TIMESTAMPDIFF(MINUTE, date, solvedate) > 0
      GROUP BY priority
      ORDER BY priority
    `, [from, to]);

    res.json(rows.map(r => ({
      ...r,
      label: PRIORITY_LABELS[r.priority] || `P${r.priority}`,
    })));
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

  const daysDiff = Math.ceil((new Date(to) - new Date(from)) / 86400000);
  let granularity = 'day';
  if (daysDiff > 90) granularity = 'week';
  if (daysDiff > 365) granularity = 'month';

  return { from: `${from} 00:00:00`, to: `${to} 23:59:59`, granularity };
}

module.exports = router;
