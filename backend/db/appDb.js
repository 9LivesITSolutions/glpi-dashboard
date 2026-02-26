const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

function getAppDb() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.APP_DB_HOST || 'localhost',
      port: parseInt(process.env.APP_DB_PORT) || 3306,
      database: process.env.APP_DB_NAME || 'glpi_dashboard_app',
      user: process.env.APP_DB_USER,
      password: process.env.APP_DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      timezone: '+00:00',
    });
  }
  return pool;
}

module.exports = { getAppDb };
