const express = require('express');
const router = express.Router();
const ldap = require('ldapjs');
const authMiddleware = require('../middleware/auth');
const { getConfig } = require('../services/config');

const escapeFilter = (s) =>
  String(s).replace(/[*()\\\x00]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

router.post('/ldap-login', authMiddleware, adminOnly, async (req, res) => {
  const steps = [];
  const { username, password } = req.body;

  if (!username || !password) return res.status(400).json({ error: 'username et password requis' });

  try {
    const cfg = await getConfig('ldap');
    if (!cfg || !cfg.enabled) return res.status(400).json({ error: 'LDAP non configuré' });

    steps.push({ step: '1. Config LDAP chargée', status: 'ok', detail: {
      host: cfg.host, port: cfg.port, ssl: cfg.ssl,
      base_dn: cfg.base_dn, bind_dn: cfg.bind_dn,
      type: cfg.type, login_attribute: cfg.login_attribute,
    }});

    const url = `${cfg.ssl ? 'ldaps' : 'ldap'}://${cfg.host}:${cfg.port || 389}`;
    steps.push({ step: '2. URL de connexion', status: 'info', detail: url });

    let userDn = null, bindDn = null, userGroups = [];

    try {
      const result = await findUserWithDebug(cfg, url, username, steps);
      userDn = result.dn;
      bindDn = result.bindDn;
      userGroups = result.groups;
    } catch (err) {
      steps.push({ step: '3. Recherche utilisateur', status: 'error', detail: err.message });
      return res.json({ success: false, steps });
    }

    if (!userDn) {
      const loginAttr = cfg.login_attribute || 'sAMAccountName';
      steps.push({ step: '3. Recherche utilisateur', status: 'error',
        detail: `Aucun utilisateur trouvé pour "${username}" dans "${cfg.base_dn}" avec le filtre (${loginAttr}=${username})`
      });
      return res.json({ success: false, steps });
    }

    steps.push({ step: '3. Utilisateur trouvé', status: 'ok', detail: {
      dn: userDn,
      bindDn: bindDn || '(utilisation du DN brut)',
      groups_count: userGroups.length,
    }});

    // Bind avec UPN ou DN
    const bindTarget = bindDn || userDn;
    steps.push({ step: '4a. Méthode de bind', status: 'info',
      detail: bindDn
        ? `userPrincipalName ou DOMAIN\\user : "${bindDn}"`
        : `DN brut (pas d'UPN trouvé) : "${userDn}"`
    });

    try {
      await bindUser(url, bindTarget, password);
      steps.push({ step: '4. Bind utilisateur (mot de passe)', status: 'ok',
        detail: `Bind réussi avec "${bindTarget}"`
      });
    } catch (err) {
      steps.push({ step: '4. Bind utilisateur', status: 'error', detail: err.message });
      return res.json({ success: false, steps });
    }

    // Groupes
    steps.push({ step: '4b. Groupes memberOf', status: 'info', detail: userGroups });

    // Résolution rôle
    const { resolveRoleFromGroups } = require('../services/ldap');
    const role = resolveRoleFromGroups(userGroups, cfg);
    steps.push({ step: '5. Résolution du rôle', status: role ? 'ok' : 'error', detail: {
      groups_enabled: cfg.groups_enabled,
      user_groups: userGroups,
      admin_groups: cfg.admin_groups || [],
      viewer_groups: cfg.viewer_groups || [],
      resolved_role: role,
      deny_if_no_group: cfg.deny_if_no_group,
    }});

    res.json({ success: role !== null, steps, role });

  } catch (err) {
    steps.push({ step: 'Erreur inattendue', status: 'error', detail: err.message });
    res.json({ success: false, steps });
  }
});

function findUserWithDebug(cfg, url, username, steps) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url, timeout: 8000, connectTimeout: 5000 });
    client.on('error', (err) => { client.destroy(); reject(new Error(`Erreur réseau : ${err.message}`)); });

    client.bind(String(cfg.bind_dn), String(cfg.bind_password), (err) => {
      if (err) { client.destroy(); return reject(new Error(`Bind compte de service échoué : ${err.message}`)); }

      steps.push({ step: '2b. Bind compte de service', status: 'ok', detail: `OK — ${cfg.bind_dn}` });

      const loginAttr = cfg.login_attribute || (cfg.type === 'ad' ? 'sAMAccountName' : 'uid');
      const filter = `(${loginAttr}=${escapeFilter(username)})`;
      const attrs = ['dn', 'cn', 'mail', loginAttr, 'memberOf', 'userPrincipalName', 'sAMAccountName'];

      steps.push({ step: '3a. Filtre de recherche', status: 'info',
        detail: { base_dn: cfg.base_dn, filter, scope: 'sub' }
      });

      let foundDn = null, bindDn = null, memberOf = [], entryCount = 0;

      client.search(cfg.base_dn, { filter, scope: 'sub', attributes: attrs }, (searchErr, searchRes) => {
        if (searchErr) { client.destroy(); return reject(new Error(`Recherche échouée : ${searchErr.message}`)); }

        searchRes.on('searchEntry', (entry) => {
          entryCount++;
          foundDn = String(entry.objectName);

          // Extraire UPN pour le bind AD
          const upnAttr = entry.attributes.find(a => a.type === 'userPrincipalName');
          if (upnAttr) {
            const upn = Array.isArray(upnAttr.values) ? upnAttr.values[0] : upnAttr.values;
            if (upn) bindDn = String(upn);
          }

          if (!bindDn && cfg.type === 'ad') {
            const samAttr = entry.attributes.find(a => a.type === 'sAMAccountName');
            const sam = samAttr ? (Array.isArray(samAttr.values) ? samAttr.values[0] : samAttr.values) : null;
            if (sam && cfg.base_dn) {
              const dcMatch = cfg.base_dn.match(/DC=([^,]+)/i);
              if (dcMatch) bindDn = `${dcMatch[1].toUpperCase()}\\${String(sam)}`;
            }
          }

          const raw = entry.attributes.find(a => a.type === 'memberOf');
          if (raw) memberOf = Array.isArray(raw.values) ? raw.values : [raw.values];

          steps.push({ step: `3b. Entrée trouvée (${entryCount})`, status: 'info', detail: {
            dn: foundDn,
            bindDn_calculated: bindDn,
            attributes: entry.attributes.map(a => ({ type: a.type, values: a.values })),
          }});
        });

        searchRes.on('error', (e) => { client.destroy(); reject(new Error(e.message)); });
        searchRes.on('end', () => {
          client.unbind();
          steps.push({ step: '3c. Fin de recherche', status: 'info', detail: `${entryCount} entrée(s)` });
          resolve({ dn: foundDn, bindDn, groups: memberOf });
        });
      });
    });
  });
}

function bindUser(url, bindTarget, password) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url, timeout: 5000 });
    client.on('error', (err) => { client.destroy(); reject(err); });
    client.bind(String(bindTarget), String(password), (err) => {
      client.destroy();
      if (err) return reject(new Error(`Bind échoué avec "${bindTarget}" — ${err.message}`));
      resolve(true);
    });
  });
}

module.exports = router;
