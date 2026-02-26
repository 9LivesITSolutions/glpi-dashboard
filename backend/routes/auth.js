const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

const { getAppDb } = require('../db/appDb');
const { getConfig } = require('../services/config');
const { authenticateLdap, resolveRoleFromGroups } = require('../services/ldap');
const authMiddleware = require('../middleware/auth');

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password, mode } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username et password requis' });
    }

    const db = getAppDb();
    let userPayload = null;

    if (mode === 'ldap') {
      // ── Auth LDAP ─────────────────────────────────────────────────────────
      const ldapCfg = await getConfig('ldap');
      if (!ldapCfg || !ldapCfg.enabled) {
        return res.status(400).json({ error: 'LDAP non configuré sur ce serveur' });
      }

      // Authentification + récupération des groupes
      const ldapUser = await authenticateLdap(ldapCfg, username, password);

      // Résolution du rôle selon les groupes
      const resolvedRole = resolveRoleFromGroups(ldapUser.groups, ldapCfg);

      if (resolvedRole === null) {
        return res.status(403).json({
          error: "Accès refusé : votre compte n'appartient à aucun groupe autorisé.",
        });
      }

      // Upsert utilisateur LDAP — le rôle est TOUJOURS recalculé depuis les groupes LDAP
      const [existing] = await db.execute('SELECT id FROM app_users WHERE username = ?', [username]);
      let userId;

      if (existing.length) {
        userId = existing[0].id;
        await db.execute(
          'UPDATE app_users SET last_login = NOW(), ldap_dn = ?, role = ? WHERE id = ?',
          [ldapUser.dn, resolvedRole, userId]
        );
      } else {
        const [result] = await db.execute(
          'INSERT INTO app_users (username, role, auth_type, ldap_dn, last_login) VALUES (?, ?, "ldap", ?, NOW())',
          [username, resolvedRole, ldapUser.dn]
        );
        userId = result.insertId;
      }

      userPayload = { id: userId, username, role: resolvedRole, auth_type: 'ldap' };

    } else {
      // ── Auth locale ───────────────────────────────────────────────────────
      const [rows] = await db.execute(
        'SELECT id, username, password_hash, role FROM app_users WHERE username = ? AND auth_type = "local"',
        [username]
      );
      if (!rows.length) return res.status(401).json({ error: 'Identifiants invalides' });

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

      await db.execute('UPDATE app_users SET last_login = NOW() WHERE id = ?', [user.id]);
      userPayload = { id: user.id, username: user.username, role: user.role, auth_type: 'local' };
    }

    const token = jwt.sign(userPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({ token, user: userPayload });

  } catch (err) {
    console.error('[AUTH]', err.message);
    res.status(401).json({ error: err.message || 'Authentification échouée' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ── GET /api/auth/ldap-enabled ────────────────────────────────────────────────
router.get('/ldap-enabled', async (req, res) => {
  const cfg = await getConfig('ldap');
  res.json({ enabled: !!(cfg && cfg.enabled) });
});

module.exports = router;
