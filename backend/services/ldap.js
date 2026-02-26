const ldap = require('ldapjs');

// Échappement des filtres LDAP — RFC 4515
const escapeFilter = (s) =>
  String(s).replace(/[*()\\\x00]/g, (c) => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));

/**
 * Teste la connexion LDAP avec un compte de service
 */
async function testLdapConnection(cfg) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: `${cfg.ssl ? 'ldaps' : 'ldap'}://${cfg.host}:${cfg.port || 389}`,
      timeout: 5000,
      connectTimeout: 5000,
    });
    client.on('error', (err) => { client.destroy(); reject(new Error(`Connexion LDAP échouée : ${err.message}`)); });
    client.bind(String(cfg.bind_dn), String(cfg.bind_password), (err) => {
      if (err) { client.destroy(); return reject(new Error(`Bind LDAP échoué : ${err.message}`)); }
      client.unbind();
      resolve(true);
    });
  });
}

/**
 * Authentifie un utilisateur LDAP
 * Retourne { dn, bindDn, username, groups }
 */
async function authenticateLdap(cfg, username, password) {
  const { dn: userDn, bindDn, groups } = await findUserDnAndGroups(cfg, username);
  if (!userDn) throw new Error("Utilisateur non trouvé dans l'annuaire LDAP");

  // Pour AD : on préfère binder avec userPrincipalName ou DOMAIN\user
  // plutôt qu'avec le DN brut (qui peut contenir des caractères échappés)
  const bindTarget = bindDn || String(userDn);
  await bindAsUser(cfg, bindTarget, password);

  return { dn: userDn, username, groups };
}

/**
 * Recherche le DN + UPN + groupes d'un utilisateur
 */
function findUserDnAndGroups(cfg, username) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: `${cfg.ssl ? 'ldaps' : 'ldap'}://${cfg.host}:${cfg.port || 389}`,
      timeout: 8000,
    });

    client.on('error', (err) => { client.destroy(); reject(err); });

    client.bind(String(cfg.bind_dn), String(cfg.bind_password), (err) => {
      if (err) { client.destroy(); return reject(new Error(`Service bind échoué : ${err.message}`)); }

      const loginAttr = cfg.login_attribute || (cfg.type === 'ad' ? 'sAMAccountName' : 'uid');
      const filter = `(${loginAttr}=${escapeFilter(username)})`;

      // On récupère userPrincipalName pour le bind AD
      const attrs = cfg.type === 'ad'
        ? ['dn', 'cn', 'mail', loginAttr, 'memberOf', 'userPrincipalName', 'sAMAccountName']
        : ['dn', 'cn', 'mail', loginAttr, 'uid'];

      const opts = { filter, scope: 'sub', attributes: attrs };
      let foundDn = null;
      let bindDn = null;
      let memberOf = [];

      client.search(cfg.base_dn, opts, (searchErr, res) => {
        if (searchErr) { client.destroy(); return reject(searchErr); }

        res.on('searchEntry', (entry) => {
          foundDn = String(entry.objectName);

          // AD : préférer userPrincipalName pour le bind (évite les problèmes de DN encodé)
          const upnAttr = entry.attributes.find(a => a.type === 'userPrincipalName');
          if (upnAttr) {
            const upn = Array.isArray(upnAttr.values) ? upnAttr.values[0] : upnAttr.values;
            if (upn) bindDn = String(upn);
          }

          // Fallback : DOMAIN\sAMAccountName si on peut extraire le domaine
          if (!bindDn && cfg.type === 'ad') {
            const samAttr = entry.attributes.find(a => a.type === 'sAMAccountName');
            const sam = samAttr ? (Array.isArray(samAttr.values) ? samAttr.values[0] : samAttr.values) : null;
            if (sam && cfg.base_dn) {
              // Extraire le domaine NetBIOS depuis base_dn (ex: DC=mondomaine,DC=local → MONDOMAINE)
              const dcMatch = cfg.base_dn.match(/DC=([^,]+)/i);
              if (dcMatch) bindDn = `${dcMatch[1].toUpperCase()}\\${String(sam)}`;
            }
          }

          const raw = entry.attributes.find(a => a.type === 'memberOf');
          if (raw) memberOf = Array.isArray(raw.values) ? raw.values : [raw.values];
        });

        res.on('error', (e) => { client.destroy(); reject(e); });

        res.on('end', async () => {
          if (!foundDn) { client.unbind(); return resolve({ dn: null, bindDn: null, groups: [] }); }

          if (cfg.type !== 'ad') {
            try {
              const groups = await searchOpenLdapGroups(client, cfg, foundDn, username);
              client.unbind();
              resolve({ dn: foundDn, bindDn, groups });
            } catch {
              client.unbind();
              resolve({ dn: foundDn, bindDn, groups: [] });
            }
          } else {
            client.unbind();
            resolve({ dn: foundDn, bindDn, groups: memberOf });
          }
        });
      });
    });
  });
}

function searchOpenLdapGroups(client, cfg, userDn, username) {
  return new Promise((resolve, reject) => {
    const filter = `(|(member=${escapeFilter(userDn)})(memberUid=${escapeFilter(username)})(uniqueMember=${escapeFilter(userDn)}))`;
    const opts = { filter, scope: 'sub', attributes: ['dn', 'cn'] };
    const groups = [];
    client.search(cfg.base_dn, opts, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', (entry) => { groups.push(String(entry.objectName)); });
      res.on('error', reject);
      res.on('end', () => resolve(groups));
    });
  });
}

/**
 * Résout le rôle depuis les groupes LDAP
 */
function resolveRoleFromGroups(groups, ldapCfg) {
  if (!ldapCfg.groups_enabled) return 'viewer';

  const adminGroups  = (ldapCfg.admin_groups  || []).map(g => g.toLowerCase());
  const viewerGroups = (ldapCfg.viewer_groups || []).map(g => g.toLowerCase());
  const userGroups   = groups.map(g => g.toLowerCase());

  if (userGroups.some(g => adminGroups.includes(g)))  return 'admin';
  if (userGroups.some(g => viewerGroups.includes(g))) return 'viewer';

  return ldapCfg.deny_if_no_group ? null : 'viewer';
}

/**
 * Teste qu'un DN de groupe est accessible
 */
async function testGroupDn(cfg, groupDn) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: `${cfg.ssl ? 'ldaps' : 'ldap'}://${cfg.host}:${cfg.port || 389}`,
      timeout: 5000,
    });
    client.on('error', (err) => { client.destroy(); reject(new Error(err.message)); });
    client.bind(String(cfg.bind_dn), String(cfg.bind_password), (err) => {
      if (err) { client.destroy(); return reject(new Error(`Bind échoué : ${err.message}`)); }
      const opts = { filter: '(objectClass=*)', scope: 'base', attributes: ['dn', 'cn'] };
      let found = false;
      client.search(groupDn, opts, (searchErr, res) => {
        if (searchErr) { client.destroy(); return reject(new Error(`Groupe introuvable : ${groupDn}`)); }
        res.on('searchEntry', () => { found = true; });
        res.on('error', (e) => { client.destroy(); reject(new Error(e.message)); });
        res.on('end', () => {
          client.unbind();
          found ? resolve(true) : reject(new Error(`Groupe introuvable : ${groupDn}`));
        });
      });
    });
  });
}

function bindAsUser(cfg, bindTarget, password) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: `${cfg.ssl ? 'ldaps' : 'ldap'}://${cfg.host}:${cfg.port || 389}`,
      timeout: 5000,
    });
    client.on('error', (err) => { client.destroy(); reject(err); });
    client.bind(String(bindTarget), String(password), (err) => {
      client.destroy();
      if (err) return reject(new Error(`Bind échoué avec "${bindTarget}" : ${err.message}`));
      resolve(true);
    });
  });
}

module.exports = { testLdapConnection, authenticateLdap, resolveRoleFromGroups, testGroupDn };
