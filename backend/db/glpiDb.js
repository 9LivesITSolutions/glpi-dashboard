const mysql = require('mysql2/promise');

let glpiPool = null;

/**
 * Crée ou retourne le pool de connexion GLPI
 * La config est chargée dynamiquement depuis la BDD app
 */
async function getGlpiDb(config = null) {
  if (glpiPool) return glpiPool;

  let cfg = config;
  if (!cfg) {
    const { getConfig } = require('../services/config');
    cfg = await getConfig('glpi_db');
    if (!cfg) throw new Error('GLPI DB non configurée. Veuillez compléter le wizard de setup.');
  }

  glpiPool = mysql.createPool({
    host: cfg.host,
    port: parseInt(cfg.port) || 3306,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',
  });

  return glpiPool;
}

/**
 * Reset le pool (après reconfiguration)
 */
async function resetGlpiPool() {
  if (glpiPool) {
    await glpiPool.end();
    glpiPool = null;
  }
}

/**
 * Test une connexion sans créer de pool persistant
 */
async function testGlpiConnection(cfg) {
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: parseInt(cfg.port) || 3306,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    connectTimeout: 5000,
  });
  await conn.ping();
  await conn.end();
  return true;
}

module.exports = { getGlpiDb, resetGlpiPool, testGlpiConnection };
