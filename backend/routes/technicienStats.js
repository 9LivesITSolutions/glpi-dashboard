const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getGlpiDb } = require('../db/glpiDb');
const { loadStatusLogs, enrichWithActiveDuration, computeActiveStats } = require('../services/pauseCalculator');

// ── GET /api/technicien-stats/list ────────────────────────────────────────────
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const [rows] = await db.execute(`
      SELECT DISTINCT
        u.id,
        TRIM(CONCAT(COALESCE(u.realname,''), ' ', COALESCE(u.firstname,''))) AS fullname,
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

    res.json(rows.map(r => ({ ...r, fullname: r.fullname || r.username })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/technicien-stats/:userId ─────────────────────────────────────────
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { from, to, granularity } = getDateRange(req);
    const db = await getGlpiDb();

    // Technicien
    const [userRows] = await db.execute(`
      SELECT id, name AS username,
        TRIM(CONCAT(COALESCE(realname,''), ' ', COALESCE(firstname,''))) AS fullname
      FROM glpi_users WHERE id = ?
    `, [userId]);
    if (!userRows.length) return res.status(404).json({ error: 'Technicien non trouvé' });
    const user = { ...userRows[0], fullname: userRows[0].fullname || userRows[0].username };

    // Tickets du technicien (tous statuts)
    const [allTickets] = await db.execute(`
      SELECT t.id, t.date, t.solvedate, t.status, t.priority
      FROM glpi_tickets_users tu
      JOIN glpi_tickets t ON t.id = tu.tickets_id
      WHERE tu.type = 2
        AND tu.users_id = ?
        AND t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
    `, [userId, from, to]);

    // Charger les logs de pause pour les tickets résolus
    const resolvedTickets = allTickets.filter(t => [5, 6].includes(t.status) && t.solvedate);
    let logsMap = new Map();
    try {
      logsMap = await loadStatusLogs(db, resolvedTickets.map(t => t.id));
    } catch (logsErr) {
      console.warn("[TECH] glpi_tickets_logs inaccessible:", logsErr.message);
    }
    const enrichedResolved = enrichWithActiveDuration(resolvedTickets, logsMap);
    const activeStats = computeActiveStats(enrichedResolved);

    // KPIs
    const total    = allTickets.length;
    const resolved = allTickets.filter(t => [5, 6].includes(t.status)).length;
    const open     = allTickets.filter(t => ![5, 6].includes(t.status)).length;
    const pending  = allTickets.filter(t => t.status === 4).length;

    // Évolution temporelle avec temps actif
    const periodMap = new Map();
    for (const t of allTickets) {
      const d = new Date(t.date);
      let period;
      if (granularity === 'month') period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      else if (granularity === 'week') {
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
        period = `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`;
      } else {
        period = d.toISOString().split('T')[0];
      }
      if (!periodMap.has(period)) periodMap.set(period, { total: 0, resolved: [], brut: [] });
      periodMap.get(period).total++;

      const enriched = enrichedResolved.find(e => e.id === t.id);
      if (enriched) {
        periodMap.get(period).resolved.push(enriched);
      }
    }

    const evolution = [];
    for (const [period, g] of [...periodMap.entries()].sort()) {
      const s = computeActiveStats(g.resolved);
      evolution.push({
        period,
        total:            g.total,
        resolved:         g.resolved.length,
        avg_active_hours: s.avg_active_hours,
        avg_brut_hours:   s.avg_brut_hours,
      });
    }

    // Répartition par priorité
    const PRIORITY_LABELS = { 1: 'Très haute', 2: 'Haute', 3: 'Moyenne', 4: 'Basse', 5: 'Très basse', 6: 'Majeure' };
    const prioMap = new Map();
    for (const t of allTickets) {
      if (!prioMap.has(t.priority)) prioMap.set(t.priority, { count: 0, resolved: 0 });
      prioMap.get(t.priority).count++;
      if ([5, 6].includes(t.status)) prioMap.get(t.priority).resolved++;
    }
    const by_priority = [...prioMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([priority, p]) => ({
        priority: parseInt(priority),
        label:    PRIORITY_LABELS[priority] || `P${priority}`,
        count:    p.count,
        resolved: p.resolved,
      }));

    // Répartition par statut
    const STATUS_LABELS = { 1: 'Nouveau', 2: 'En cours (assigné)', 3: 'En cours (planifié)', 4: 'En attente', 5: 'Résolu', 6: 'Clôturé' };
    const statusMap = new Map();
    for (const t of allTickets) {
      statusMap.set(t.status, (statusMap.get(t.status) || 0) + 1);
    }
    const by_status = [...statusMap.entries()].map(([status, count]) => ({
      status: parseInt(status),
      label:  STATUS_LABELS[status] || `Statut ${status}`,
      count,
    }));

    // Catégories les plus fréquentes
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

    // Moyenne équipe (temps actif approximatif — on utilise le brut SQL pour perf)
    const [teamAvgRows] = await db.execute(`
      SELECT
        ROUND(AVG(sub.ticket_count), 1) AS team_avg_tickets,
        ROUND(AVG(sub.avg_brut_hours), 2) AS team_avg_brut_hours
      FROM (
        SELECT
          tu.users_id,
          COUNT(t.id) AS ticket_count,
          AVG(CASE WHEN t.status IN (5,6) AND t.solvedate IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, t.date, t.solvedate) / 60.0
          END) AS avg_brut_hours
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
      kpi: {
        total,
        resolved,
        open,
        pending,
        resolution_rate:     total > 0 ? Math.round(resolved / total * 1000) / 10 : 0,
        avg_active_hours:    activeStats.avg_active_hours,
        avg_brut_hours:      activeStats.avg_brut_hours,
        avg_pause_minutes:   activeStats.avg_pause_minutes,
        min_active_hours:    activeStats.min_active_hours,
        max_active_hours:    activeStats.max_active_hours,
      },
      evolution,
      by_priority,
      by_status,
      categories:  categoryRows,
      team_avg:    teamAvgRows[0],
    });

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
