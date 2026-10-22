#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function validatePm2Runtime(apps, { name, node, version, cwd }) {
  if (!Array.isArray(apps)) return false;
  const app = apps.find(item => item?.name === name);
  return !!app && app.pid > 0 && app.pm2_env?.status === 'online' && app.pm2_env?.node_version === version && app.pm2_env?.exec_interpreter === node && app.pm2_env?.pm_cwd === cwd;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const [name, node, version, cwd] = process.argv.slice(2);
    if (!validatePm2Runtime(JSON.parse(Buffer.concat(chunks).toString()), { name, node, version, cwd })) process.exitCode = 1;
  } catch { process.exitCode = 1; }
}
