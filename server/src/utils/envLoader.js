/**
 * SolarShare - Lightweight Environment Variable Loader
 * Zero external dependencies. Reads .env file if present and populates process.env.
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const candidates = [
    path.resolve(__dirname, '../../.env'),       // server/.env
    path.resolve(__dirname, '../../../.env')     // project root .env
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            let val = trimmed.substring(eqIdx + 1).trim();
            // Remove wrapping quotes if present
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.substring(1, val.length - 1);
            }
            if (process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        }
        break;
      } catch (err) {
        console.warn('[SolarShare Env] Warning reading .env:', err.message);
      }
    }
  }
}

loadEnv();

module.exports = {
  loadEnv
};
