import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = dirname(fileURLToPath(import.meta.url));

// El dev-server arranca este archivo como modulo suelto, sin cargar el .env,
// asi que lo leemos aqui. Sin dependencias externas: el formato es KEY=VALUE.
function readEnvFile(name) {
  let contents;
  try {
    contents = readFileSync(resolve(projectRoot, name), 'utf8');
  } catch {
    return {};
  }

  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) {
      continue;
    }
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

// Precedencia: variables del proceso > .env.local > .env > valor por defecto.
const fileEnv = { ...readEnvFile('.env'), ...readEnvFile('.env.local') };
const target = process.env['API_TARGET'] ?? fileEnv['API_TARGET'] ?? 'http://localhost:8080';
const isHttps = target.startsWith('https://');

console.log(`[proxy] /api y /actuator -> ${target}`);

const route = {
  target,
  // El gateway detras de un tunel exige el Host del destino, no el de localhost.
  changeOrigin: true,
  // Los tuneles usan certificados validos; en local (http) el flag es indiferente.
  secure: isHttps,
  ws: true,
  logLevel: 'info',
};

export default {
  '/api': route,
  '/actuator': route,
};
