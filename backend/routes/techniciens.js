const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getGlpiDb } = require('../db/glpiDb');

// ── GET /api/techniciens ──────────────────────────────────────────────────────
// Charge par technicien : assignés, résolus, temps moyen, en cours
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const [rows] = await db.execute(`
      SELECT
        u.id AS user_id,
        CONCAT(COALESCE(u.realname, ''), ' ', COALESCE(u.firstname, '')) AS fullname,
        u.name AS username,
        COUNT(t.id) AS total_assigned,
        SUM(t.status IN (5, 6)) AS resolved,
        SUM(t.status NOT IN (5, 6)) AS open,
        ROUND(AVG(
          CASE WHEN t.status IN (5,6) AND t.solvedate IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, t.date, t.solvedate) / 60.0
          END
        ), 2) AS avg_resolution_hours
      FROM glpi_tickets_users tu
      JOIN glpi_tickets t ON t.id = tu.tickets_id
      JOIN glpi_users u ON u.id = tu.users_id
      WHERE tu.type = 2
        AND t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
      GROUP BY u.id, u.realname, u.firstname, u.name
      ORDER BY total_assigned DESC
      LIMIT 20
    `, [from, to]);

    res.json(rows.map(r => ({
      ...r,
      fullname: r.fullname.trim() || r.username,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/techniciens/groupes ──────────────────────────────────────────────
// Charge par groupe
router.get('/groupes', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const [rows] = await db.execute(`
      SELECT
        g.id AS group_id,
        g.name AS group_name,
        COUNT(t.id) AS total_assigned,
        SUM(t.status IN (5, 6)) AS resolved,
        SUM(t.status NOT IN (5, 6)) AS open,
        ROUND(AVG(
          CASE WHEN t.status IN (5,6) AND t.solvedate IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, t.date, t.solvedate) / 60.0
          END
        ), 2) AS avg_resolution_hours
      FROM glpi_groups_tickets gt
      JOIN glpi_tickets t ON t.id = gt.tickets_id
      JOIN glpi_groups g ON g.id = gt.groups_id
      WHERE gt.type = 2
        AND t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
      GROUP BY g.id, g.name
      ORDER BY total_assigned DESC
    `, [from, to]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/techniciens/top-performers ───────────────────────────────────────
// Top techniciens par taux de résolution
router.get('/top-performers', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const [rows] = await db.execute(`
      SELECT
        CONCAT(COALESCE(u.realname, ''), ' ', COALESCE(u.firstname, '')) AS fullname,
        u.name AS username,
        COUNT(t.id) AS total_assigned,
        SUM(t.status IN (5, 6)) AS resolved,
        ROUND(SUM(t.status IN (5, 6)) * 100.0 / NULLIF(COUNT(t.id), 0), 1) AS resolution_rate
      FROM glpi_tickets_users tu
      JOIN glpi_tickets t ON t.id = tu.tickets_id
      JOIN glpi_users u ON u.id = tu.users_id
      WHERE tu.type = 2
        AND t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
      GROUP BY u.id, u.realname, u.firstname, u.name
      HAVING total_assigned >= 3
      ORDER BY resolution_rate DESC
      LIMIT 10
    `, [from, to]);

    res.json(rows.map(r => ({ ...r, fullname: r.fullname.trim() || r.username })));
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
