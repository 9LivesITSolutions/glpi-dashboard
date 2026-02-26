const { getAppDb } = require('../db/appDb');

async function getConfig(key) {
  const db = getAppDb();
  const [rows] = await db.execute('SELECT `value` FROM app_config WHERE `key` = ?', [key]);
  if (!rows.length) return null;
  try {
    return JSON.parse(rows[0].value);
  } catch {
    return rows[0].value;
  }
}

async function setConfig(key, value) {
  const db = getAppDb();
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  await db.execute(
    'INSERT INTO app_config (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
    [key, serialized]
  );
}

async function isSetupCompleted() {
  const val = await getConfig('setup_completed');
  return val === true || val === 'true';
}

module.exports = { getConfig, setConfig, isSetupCompleted };
