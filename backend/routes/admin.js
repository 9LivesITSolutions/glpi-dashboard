const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getConfig, setConfig } = require('../services/config');
const { testLdapConnection, testGroupDn } = require('../services/ldap');
const { getAppDb } = require('../db/appDb');

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

// ── GET /api/admin/ldap ───────────────────────────────────────────────────────
router.get('/ldap', authMiddleware, adminOnly, async (req, res) => {
  try {
    const cfg = await getConfig('ldap') || { enabled: false };
    const { bind_password, ...safeCfg } = cfg;
    res.json({ ...safeCfg, has_password: !!bind_password });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/ldap/test ─────────────────────────────────────────────────
router.post('/ldap/test', authMiddleware, adminOnly, async (req, res) => {
  try {
    const cfg = req.body;
    if (!cfg.bind_password) {
      const existing = await getConfig('ldap');
      cfg.bind_password = existing?.bind_password || '';
    }
    await testLdapConnection(cfg);
    res.json({ success: true, message: 'Connexion LDAP réussie ✓' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /api/admin/ldap/test-group ──────────────────────────────────────────
// Vérifie qu'un DN de groupe est accessible
router.post('/ldap/test-group', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { group_dn } = req.body;
    if (!group_dn) return res.status(400).json({ error: 'group_dn requis' });

    const cfg = await getConfig('ldap');
    if (!cfg) return res.status(400).json({ error: 'LDAP non configuré' });

    await testGroupDn(cfg, group_dn);
    res.json({ success: true, message: `Groupe trouvé ✓` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /api/admin/ldap/save ─────────────────────────────────────────────────
router.post('/ldap/save', authMiddleware, adminOnly, async (req, res) => {
  try {
    const cfg = req.body;
    if (!cfg.bind_password) {
      const existing = await getConfig('ldap');
      cfg.bind_password = existing?.bind_password || '';
    }
    if (cfg.enabled) await testLdapConnection(cfg);
    await setConfig('ldap', cfg);
    res.json({ success: true, message: 'Configuration LDAP sauvegardée ✓' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = getAppDb();
    const [rows] = await db.execute(`
      SELECT id, username, role, auth_type, ldap_dn, last_login, created_at
      FROM app_users ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/users/:id/role ─────────────────────────────────────────────
router.put('/users/:id/role', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }
    if (parseInt(req.params.id) === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Impossible de modifier votre propre rôle' });
    }
    const db = getAppDb();
    await db.execute('UPDATE app_users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
    }
    const db = getAppDb();
    await db.execute('DELETE FROM app_users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/users ─────────────────────────────────────────────────────
router.post('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { username, password, role = 'viewer' } = req.body;
    if (!username || !password || password.length < 8) {
      return res.status(400).json({ error: 'Username requis et mot de passe minimum 8 caractères' });
    }
    const db = getAppDb();
    const [existing] = await db.execute('SELECT id FROM app_users WHERE username = ?', [username]);
    if (existing.length) return res.status(409).json({ error: 'Utilisateur déjà existant' });

    const hash = await bcrypt.hash(password, 12);
    await db.execute(
      'INSERT INTO app_users (username, password_hash, role, auth_type) VALUES (?, ?, ?, "local")',
      [username, hash, role]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/users/:id/password ────────────────────────────────────────
router.put('/users/:id/password', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Mot de passe minimum 8 caractères' });
    }
    const hash = await bcrypt.hash(password, 12);
    const db = getAppDb();
    await db.execute('UPDATE app_users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
