const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getGlpiDb } = require('../db/glpiDb');

// ── GET /api/technicien-stats/list ────────────────────────────────────────────
// Liste tous les techniciens ayant des tickets sur la période
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const [rows] = await db.execute(`
      SELECT DISTINCT
        u.id,
        TRIM(CONCAT(COALESCE(u.realname, ''), ' ', COALESCE(u.firstname, ''))) AS fullname,
        u.name AS username,
        COUNT(t.id) AS total_tickets
      FROM glpi_tickets_users tu
      JOIN glpi_tickets t ON t.id = tu.tickets_id
      JOIN glpi_users u ON u.id = tu.users_id
      WHERE tu.type = 2
        AND t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
      GROUP BY u.id, u.realname, u.firstname, u.name
      ORDER BY total_tickets DESC
    `, [from, to]);

    res.json(rows.map(r => ({
      ...r,
      fullname: r.fullname || r.username,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/technicien-stats/:userId ─────────────────────────────────────────
// Stats complètes d'un technicien
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { from, to, granularity } = getDateRange(req);
    const db = await getGlpiDb();

    // -- Infos de base du technicien
    const [userRows] = await db.execute(`
      SELECT id, name AS username,
        TRIM(CONCAT(COALESCE(realname,''), ' ', COALESCE(firstname,''))) AS fullname
      FROM glpi_users WHERE id = ?
    `, [userId]);

    if (!userRows.length) return res.status(404).json({ error: 'Technicien non trouvé' });
    const user = userRows[0];
    user.fullname = user.fullname || user.username;

    // -- KPIs globaux
    const [kpiRows] = await db.execute(`
      SELECT
        COUNT(t.id) AS total,
        SUM(t.status IN (5,6)) AS resolved,
        SUM(t.status NOT IN (5,6)) AS open,
        SUM(t.status = 4) AS pending,
        ROUND(AVG(
          CASE WHEN t.status IN (5,6) AND t.solvedate IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, t.date, t.solvedate) / 60.0
          END
        ), 2) AS avg_resolution_hours,
        ROUND(MIN(
          CASE WHEN t.status IN (5,6) AND t.solvedate IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, t.date, t.solvedate) / 60.0
          END
        ), 2) AS min_resolution_hours,
        ROUND(MAX(
          CASE WHEN t.status IN (5,6) AND t.solvedate IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, t.date, t.solvedate) / 60.0
          END
        ), 2) AS max_resolution_hours
      FROM glpi_tickets_users tu
      JOIN glpi_tickets t ON t.id = tu.tickets_id
      WHERE tu.type = 2
        AND tu.users_id = ?
        AND t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
    `, [userId, from, to]);

    const kpi = kpiRows[0];
    const resolutionRate = kpi.total > 0
      ? Math.round((kpi.resolved / kpi.total) * 100 * 10) / 10
      : 0;

    // -- Évolution temporelle
    let dateFormat;
    if (granularity === 'week') dateFormat = '%Y-%u';
    else if (granularity === 'month') dateFormat = '%Y-%m';
    else dateFormat = '%Y-%m-%d';

    const [evolutionRows] = await db.execute(`
      SELECT
        DATE_FORMAT(t.date, ?) AS period,
        COUNT(t.id) AS total,
        SUM(t.status IN (5,6)) AS resolved,
        ROUND(AVG(
          CASE WHEN t.status IN (5,6) AND t.solvedate IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, t.date, t.solvedate) / 60.0
          END
        ), 2) AS avg_hours
      FROM glpi_tickets_users tu
      JOIN glpi_tickets t ON t.id = tu.tickets_id
      WHERE tu.type = 2
        AND tu.users_id = ?
        AND t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
      GROUP BY period
      ORDER BY period
    `, [dateFormat, userId, from, to]);

    // -- Répartition par priorité
    const PRIORITY_LABELS = { 1: 'Très haute', 2: 'Haute', 3: 'Moyenne', 4: 'Basse', 5: 'Très basse', 6: 'Majeure' };
    const [priorityRows] = await db.execute(`
      SELECT
        t.priority,
        COUNT(t.id) AS count,
        SUM(t.status IN (5,6)) AS resolved
      FROM glpi_tickets_users tu
      JOIN glpi_tickets t ON t.id = tu.tickets_id
      WHERE tu.type = 2
        AND tu.users_id = ?
        AND t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
      GROUP BY t.priority
      ORDER BY t.priority
    `, [userId, from, to]);

    // -- Répartition par statut
    const STATUS_LABELS = { 1: 'Nouveau', 2: 'En cours (assigné)', 3: 'En cours (planifié)', 4: 'En attente', 5: 'Résolu', 6: 'Clôturé' };
    const [statusRows] = await db.execute(`
      SELECT t.status, COUNT(t.id) AS count
      FROM glpi_tickets_users tu
      JOIN glpi_tickets t ON t.id = tu.tickets_id
      WHERE tu.type = 2
        AND tu.users_id = ?
        AND t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
      GROUP BY t.status
    `, [userId, from, to]);

    // -- Catégories les plus fréquentes
    const [categoryRows] = await db.execute(`
      SELECT
        COALESCE(c.name, 'Non catégorisé') AS category,
        COUNT(t.id) AS count
      FROM glpi_tickets_users tu
      JOIN glpi_tickets t ON t.id = tu.tickets_id
      LEFT JOIN glpi_itilcategories c ON c.id = t.itilcategories_id
      WHERE tu.type = 2
        AND tu.users_id = ?
        AND t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
      GROUP BY c.name
      ORDER BY count DESC
      LIMIT 8
    `, [userId, from, to]);

    // -- Comparaison avec la moyenne équipe
    const [teamAvgRows] = await db.execute(`
      SELECT
        ROUND(AVG(sub.ticket_count), 1) AS team_avg_tickets,
        ROUND(AVG(sub.avg_hours), 2) AS team_avg_hours
      FROM (
        SELECT
          tu.users_id,
          COUNT(t.id) AS ticket_count,
          AVG(CASE WHEN t.status IN (5,6) AND t.solvedate IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, t.date, t.solvedate) / 60.0
          END) AS avg_hours
        FROM glpi_tickets_users tu
        JOIN glpi_tickets t ON t.id = tu.tickets_id
        WHERE tu.type = 2
          AND t.is_deleted = 0
          AND t.date >= ? AND t.date <= ?
        GROUP BY tu.users_id
      ) sub
    `, [from, to]);

    res.json({
      user,
      kpi: { ...kpi, resolution_rate: resolutionRate },
      evolution: evolutionRows,
      by_priority: priorityRows.map(r => ({
        ...r,
        label: PRIORITY_LABELS[r.priority] || `P${r.priority}`,
      })),
      by_status: statusRows.map(r => ({
        ...r,
        label: STATUS_LABELS[r.status] || `Statut ${r.status}`,
      })),
      categories: categoryRows,
      team_avg: teamAvgRows[0],
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getDateRange(req) {
  let { from, to, period } = req.query;

  if (period) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
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
