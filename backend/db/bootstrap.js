const { getAppDb } = require('./appDb');

async function bootstrap() {
  const db = getAppDb();

  // Table de configuration (clé/valeur JSON)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_config (
      \`key\`      VARCHAR(100) PRIMARY KEY,
      \`value\`    LONGTEXT NOT NULL,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Table des utilisateurs locaux
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_users (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      username      VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255),
      role          ENUM('admin','viewer') NOT NULL DEFAULT 'viewer',
      auth_type     ENUM('local','ldap') NOT NULL DEFAULT 'local',
      ldap_dn       VARCHAR(500),
      last_login    DATETIME,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log('✅ Bootstrap DB effectué.');
}

module.exports = { bootstrap };
