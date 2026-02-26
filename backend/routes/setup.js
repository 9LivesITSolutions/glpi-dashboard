const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { getConfig, setConfig, isSetupCompleted } = require('../services/config');
const { testGlpiConnection, resetGlpiPool } = require('../db/glpiDb');
const { testLdapConnection } = require('../services/ldap');
const { getAppDb } = require('../db/appDb');

// ── GET /api/setup/status ─────────────────────────────────────────────────────
// Vérifie si le setup est terminé (appelé au démarrage du front)
router.get('/status', async (req, res) => {
  try {
    const completed = await isSetupCompleted();
    res.json({ completed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/setup/test-db ───────────────────────────────────────────────────
// Teste la connexion GLPI sans sauvegarder
router.post('/test-db', async (req, res) => {
  try {
    const { host, port, database, user, password } = req.body;
    if (!host || !database || !user) {
      return res.status(400).json({ error: 'Champs obligatoires manquants (host, database, user)' });
    }
    await testGlpiConnection({ host, port, database, user, password });
    res.json({ success: true, message: 'Connexion GLPI réussie ✓' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /api/setup/save-db ───────────────────────────────────────────────────
// Sauvegarde la config GLPI dans app_config
router.post('/save-db', async (req, res) => {
  try {
    const { host, port, database, user, password } = req.body;
    if (!host || !database || !user) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    // On test avant de sauvegarder
    await testGlpiConnection({ host, port, database, user, password });
    await setConfig('glpi_db', { host, port: port || 3306, database, user, password });
    await resetGlpiPool(); // Reset le pool si déjà initialisé
    res.json({ success: true, message: 'Configuration DB sauvegardée ✓' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /api/setup/test-ldap ─────────────────────────────────────────────────
router.post('/test-ldap', async (req, res) => {
  try {
    const cfg = req.body;
    if (!cfg.host || !cfg.base_dn || !cfg.bind_dn || !cfg.bind_password) {
      return res.status(400).json({ error: 'Champs LDAP obligatoires manquants' });
    }
    await testLdapConnection(cfg);
    res.json({ success: true, message: 'Connexion LDAP réussie ✓' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /api/setup/save-ldap ─────────────────────────────────────────────────
router.post('/save-ldap', async (req, res) => {
  try {
    const cfg = req.body;
    if (cfg.enabled) {
      await testLdapConnection(cfg);
    }
    await setConfig('ldap', cfg);
    res.json({ success: true, message: 'Configuration LDAP sauvegardée ✓' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /api/setup/create-admin ──────────────────────────────────────────────
router.post('/create-admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || password.length < 8) {
      return res.status(400).json({ error: 'Username requis et mot de passe minimum 8 caractères' });
    }

    const db = getAppDb();
    const [existing] = await db.execute('SELECT id FROM app_users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Cet utilisateur existe déjà' });
    }

    const hash = await bcrypt.hash(password, 12);
    await db.execute(
      'INSERT INTO app_users (username, password_hash, role, auth_type) VALUES (?, ?, "admin", "local")',
      [username, hash]
    );

    // Marquer le setup comme terminé
    await setConfig('setup_completed', true);

    res.json({ success: true, message: 'Compte admin créé. Setup terminé ✓' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
