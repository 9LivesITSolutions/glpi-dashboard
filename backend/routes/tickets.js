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

// ── GET /api/tickets/list ─────────────────────────────────────────────────────
// Listing paginé avec filtres statut/user/catégorie + tri dynamique
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();

    const status   = parseInt(req.query.status) || 0;
    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const limit    = req.query.limit === 'all' ? null : Math.min(500, parseInt(req.query.limit) || 50);
    const offset   = limit ? (page - 1) * limit : 0;
    const userQ    = req.query.user     ? `%${req.query.user}%`     : null;
    const catQ     = req.query.category ? `%${req.query.category}%` : null;

    // Tri dynamique — whitelist SQL injection
    const sortMap  = { id:'t.id', title:'t.name', category:'c.name', priority:'t.priority', status:'t.status', created_at:'t.date', updated_at:'t.date_mod', technicians:'technicians' };
    const sortCol  = sortMap[req.query.sort] || 't.priority';
    const sortDir  = req.query.dir === 'desc' ? 'DESC' : 'ASC';

    // Clauses WHERE/HAVING
    const whereStatus = status > 0 ? 'AND t.status = ?'    : '';
    const whereCat    = catQ       ? 'AND c.name LIKE ?'   : '';
    const havingUser  = userQ      ? 'HAVING technicians LIKE ?' : '';

    const buildParams = (withLimit = false) => {
      const p = [from, to];
      if (status > 0) p.push(status);
      if (catQ)       p.push(catQ);
      if (userQ)      p.push(userQ);
      if (withLimit && limit) p.push(limit, offset);
      return p;
    };

    // Total
    const [[{ total }]] = await db.execute(`
      SELECT COUNT(*) AS total FROM (
        SELECT t.id,
          GROUP_CONCAT(DISTINCT TRIM(CONCAT(COALESCE(u.realname,''), ' ', COALESCE(u.firstname,''))) SEPARATOR ', ') AS technicians
        FROM glpi_tickets t
        LEFT JOIN glpi_itilcategories c ON c.id = t.itilcategories_id
        LEFT JOIN glpi_tickets_users tu ON tu.tickets_id = t.id AND tu.type = 2
        LEFT JOIN glpi_users u          ON u.id = tu.users_id
        WHERE t.is_deleted = 0 AND t.date >= ? AND t.date <= ?
        ${whereStatus} ${whereCat}
        GROUP BY t.id
        ${havingUser}
      ) sub
    `, buildParams());

    // Listing
    const limitClause = limit ? 'LIMIT ? OFFSET ?' : '';
    const [rows] = await db.execute(`
      SELECT
        t.id, t.name AS title, t.status, t.priority,
        t.date AS created_at, t.date_mod AS updated_at, t.solvedate,
        COALESCE(c.name, 'Non catégorisé') AS category,
        GROUP_CONCAT(
          DISTINCT TRIM(CONCAT(COALESCE(u.realname,''), ' ', COALESCE(u.firstname,'')))
          ORDER BY u.realname SEPARATOR ', '
        ) AS technicians
      FROM glpi_tickets t
      LEFT JOIN glpi_itilcategories c  ON c.id = t.itilcategories_id
      LEFT JOIN glpi_tickets_users tu  ON tu.tickets_id = t.id AND tu.type = 2
      LEFT JOIN glpi_users u           ON u.id = tu.users_id
      WHERE t.is_deleted = 0 AND t.date >= ? AND t.date <= ?
      ${whereStatus} ${whereCat}
      GROUP BY t.id
      ${havingUser}
      ORDER BY ${sortCol} ${sortDir}
      ${limitClause}
    `, buildParams(true));

    const PRIORITY_LABELS = { 1:'Très haute', 2:'Haute', 3:'Moyenne', 4:'Basse', 5:'Très basse', 6:'Majeure' };

    res.json({
      total:   parseInt(total),
      page,
      limit:   limit || 'all',
      pages:   limit ? Math.ceil(parseInt(total) / limit) : 1,
      tickets: rows.map(r => ({
        id:             r.id,
        title:          r.title,
        status:         r.status,
        status_label:   STATUS_LABELS[r.status] || `Statut ${r.status}`,
        priority:       r.priority,
        priority_label: PRIORITY_LABELS[r.priority] || `P${r.priority}`,
        category:       r.category,
        technicians:    r.technicians || 'Non assigné',
        created_at:     r.created_at,
        updated_at:     r.updated_at,
        solvedate:      r.solvedate,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
// ── GET /api/tickets/top-categories ──────────────────────────────────────────
router.get('/top-categories', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();
    const limit = Math.min(20, parseInt(req.query.limit) || 10);

    const [rows] = await db.execute(`
      SELECT
        COALESCE(c.name, 'Non catégorisé') AS name,
        COUNT(*) AS count
      FROM glpi_tickets t
      LEFT JOIN glpi_itilcategories c ON c.id = t.itilcategories_id
      WHERE t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
      GROUP BY c.id, c.name
      ORDER BY count DESC
      LIMIT ?
    `, [from, to, limit]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/tickets/top-requesters ──────────────────────────────────────────
router.get('/top-requesters', authMiddleware, async (req, res) => {
  try {
    const { from, to } = getDateRange(req);
    const db = await getGlpiDb();
    const limit = Math.min(50, parseInt(req.query.limit) || 15);

    const [rows] = await db.execute(`
      SELECT
        TRIM(CONCAT(COALESCE(u.realname,''), ' ', COALESCE(u.firstname,''))) AS name,
        COUNT(DISTINCT t.id)                          AS total,
        SUM(t.status IN (1,2,3,4))                    AS open,
        SUM(t.status = 5)                             AS solved,
        SUM(t.status = 6)                             AS closed,
        ROUND(AVG(
          CASE WHEN t.solvedate IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, t.date, t.solvedate)
          END
        ) / 60, 1)                                    AS avg_resolution_hours
      FROM glpi_tickets t
      LEFT JOIN glpi_tickets_users tu ON tu.tickets_id = t.id AND tu.type = 1
      LEFT JOIN glpi_users u          ON u.id = tu.users_id
      WHERE t.is_deleted = 0
        AND t.date >= ? AND t.date <= ?
        AND u.id IS NOT NULL
      GROUP BY u.id, u.realname, u.firstname
      ORDER BY total DESC
      LIMIT ?
    `, [from, to, limit]);

    res.json(rows.map(r => ({
      name:                 r.name.trim() || 'Inconnu',
      total:                parseInt(r.total),
      open:                 parseInt(r.open),
      solved:               parseInt(r.solved) + parseInt(r.closed),
      avg_resolution_hours: r.avg_resolution_hours,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
