import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const target = process.env.TARGET ?? 'http://127.0.0.1:3005';
const hostHeader = process.env.HOST_HEADER ?? 'lms.clev.io';
const virtualUsers = Number.parseInt(process.env.VUS ?? '200', 10);
const durationMs = Number.parseInt(process.env.DURATION_MS ?? '30000', 10);
const requestTimeoutMs = Number.parseInt(process.env.REQUEST_TIMEOUT_MS ?? '10000', 10);
const thinkTimeMinMs = Number.parseInt(process.env.THINK_TIME_MIN_MS ?? '300', 10);
const thinkTimeMaxMs = Number.parseInt(process.env.THINK_TIME_MAX_MS ?? '900', 10);
const pageSize = Number.parseInt(
  execFileSync('getconf', ['PAGESIZE'], { encoding: 'utf8' }).trim(),
  10,
);

const paths = [
  '/login',
  '/holidayclas2026',
  '/free-trial',
  '/invoice/CCR035-072026',
  '/invoice/CCR017-072026',
];

if (!Number.isInteger(virtualUsers) || virtualUsers < 1 || virtualUsers > 500) {
  throw new Error('VUS must be an integer between 1 and 500');
}

if (!Number.isInteger(durationMs) || durationMs < 1_000 || durationMs > 120_000) {
  throw new Error('DURATION_MS must be between 1000 and 120000');
}

if (thinkTimeMaxMs < thinkTimeMinMs || thinkTimeMinMs < 0) {
  throw new Error('Think-time range is invalid');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, quantile) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1);
  return Math.round(sorted[index] * 10) / 10;
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeLatencies(values) {
  return {
    minMs: values.length ? Math.round(Math.min(...values) * 10) / 10 : null,
    avgMs: values.length ? Math.round(average(values) * 10) / 10 : null,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    p99Ms: percentile(values, 0.99),
    maxMs: values.length ? Math.round(Math.max(...values) * 10) / 10 : null,
  };
}

function getPm2Snapshot() {
  try {
    const list = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8' }));
    const app = list.find((entry) => entry.name === 'lms');
    if (!app) return null;

    return {
      pid: app.pid,
      status: app.pm2_env.status,
      restarts: app.pm2_env.restart_time,
      unstableRestarts: app.pm2_env.unstable_restarts,
      memoryMb: Math.round((app.monit.memory / 1024 / 1024) * 10) / 10,
      cpuPercent: app.monit.cpu,
    };
  } catch {
    return null;
  }
}

function readSystemCpu() {
  const firstLine = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0];
  const values = firstLine.trim().split(/\s+/).slice(1).map(Number);
  return {
    total: values.reduce((sum, value) => sum + value, 0),
    idle: values[3] + values[4],
  };
}

function readProcessTree(pid) {
  const processes = new Map();

  for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;

    try {
      const raw = fs.readFileSync(`/proc/${entry}/stat`, 'utf8');
      const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/);
      const residentPages = Number(
        fs.readFileSync(`/proc/${entry}/statm`, 'utf8').trim().split(/\s+/)[1],
      );
      processes.set(Number(entry), {
        parentPid: Number(fields[1]),
        ticks: Number(fields[11]) + Number(fields[12]),
        rssMb: (residentPages * pageSize) / 1024 / 1024,
      });
    } catch {
      // A short-lived process can disappear while /proc is being scanned.
    }
  }

  const processIds = [];
  const queue = [pid];

  while (queue.length > 0) {
    const currentPid = queue.shift();
    if (!currentPid || processIds.includes(currentPid)) continue;
    processIds.push(currentPid);

    for (const [candidatePid, process] of processes) {
      if (process.parentPid === currentPid) queue.push(candidatePid);
    }
  }

  const tree = processIds
    .map((processId) => processes.get(processId))
    .filter(Boolean);

  return {
    processCount: tree.length,
    ticks: tree.reduce((sum, process) => sum + process.ticks, 0),
    rssMb: tree.reduce((sum, process) => sum + process.rssMb, 0),
  };
}

function readMemAvailableMb() {
  const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
  const match = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB$/m);
  return match ? Number(match[1]) / 1024 : null;
}

const records = [];
const resourceSamples = [];
const errorCounts = new Map();
let inFlight = 0;
let maxInFlight = 0;
let endAt = 0;
let releaseStart;

const startGate = new Promise((resolve) => {
  releaseStart = resolve;
});

async function makeRequest(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const startedAt = performance.now();
  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);

  try {
    const response = await fetch(`${target}${path}`, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        Host: hostHeader,
        'User-Agent': 'Clevio-VPS-LoadTest/1.0',
        'X-Clevio-Load-Test': '200-vu-read-only',
      },
    });
    const body = await response.arrayBuffer();
    records.push({
      path,
      status: response.status,
      ok: response.status >= 200 && response.status < 400,
      latencyMs: performance.now() - startedAt,
      bytes: body.byteLength,
    });
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    errorCounts.set(message, (errorCounts.get(message) ?? 0) + 1);
    records.push({
      path,
      status: 0,
      ok: false,
      latencyMs: performance.now() - startedAt,
      bytes: 0,
    });
  } finally {
    clearTimeout(timeout);
    inFlight -= 1;
  }
}

async function runVirtualUser(userIndex) {
  await startGate;
  let step = 0;

  while (performance.now() < endAt) {
    const path = paths[(userIndex + step) % paths.length];
    await makeRequest(path);
    step += 1;

    const thinkTime =
      thinkTimeMinMs + Math.random() * (thinkTimeMaxMs - thinkTimeMinMs);
    await sleep(thinkTime);
  }
}

const pm2Before = getPm2Snapshot();
const monitoredPid = pm2Before?.pid ?? null;
let previousSystemCpu = readSystemCpu();
let previousProcessTree = monitoredPid ? readProcessTree(monitoredPid) : null;

const monitor = setInterval(() => {
  try {
    const currentSystemCpu = readSystemCpu();
    const currentProcessTree = monitoredPid ? readProcessTree(monitoredPid) : null;
    const totalDelta = currentSystemCpu.total - previousSystemCpu.total;
    const idleDelta = currentSystemCpu.idle - previousSystemCpu.idle;
    const processDelta =
      currentProcessTree !== null && previousProcessTree !== null
        ? currentProcessTree.ticks - previousProcessTree.ticks
        : null;

    resourceSamples.push({
      systemCpuPercent:
        totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : null,
      appCpuPercent:
        totalDelta > 0 && processDelta !== null
          ? (processDelta / totalDelta) * os.cpus().length * 100
          : null,
      appRssMb: currentProcessTree?.rssMb ?? null,
      appProcessCount: currentProcessTree?.processCount ?? null,
      memAvailableMb: readMemAvailableMb(),
      load1: Number(fs.readFileSync('/proc/loadavg', 'utf8').split(/\s+/)[0]),
    });

    previousSystemCpu = currentSystemCpu;
    previousProcessTree = currentProcessTree;
  } catch {
    resourceSamples.push({
      systemCpuPercent: null,
      appCpuPercent: null,
      appRssMb: null,
      appProcessCount: null,
      memAvailableMb: readMemAvailableMb(),
      load1: Number(fs.readFileSync('/proc/loadavg', 'utf8').split(/\s+/)[0]),
    });
  }
}, 500);

const workers = Array.from({ length: virtualUsers }, (_, index) =>
  runVirtualUser(index),
);

await sleep(1_000);
const testStartedAt = performance.now();
const testStartedAtIso = new Date().toISOString();
endAt = testStartedAt + durationMs;
releaseStart();
await Promise.all(workers);
clearInterval(monitor);

const elapsedSeconds = (performance.now() - testStartedAt) / 1_000;
const pm2After = getPm2Snapshot();
const successfulRecords = records.filter((record) => record.ok);
const failedRecords = records.filter((record) => !record.ok);
const statusCounts = {};

for (const record of records) {
  const key = String(record.status);
  statusCounts[key] = (statusCounts[key] ?? 0) + 1;
}

const endpointResults = Object.fromEntries(
  paths.map((path) => {
    const endpointRecords = records.filter((record) => record.path === path);
    const endpointSuccesses = endpointRecords.filter((record) => record.ok);
    return [
      path,
      {
        requests: endpointRecords.length,
        successful: endpointSuccesses.length,
        failed: endpointRecords.length - endpointSuccesses.length,
        ...summarizeLatencies(endpointSuccesses.map((record) => record.latencyMs)),
      },
    ];
  }),
);

const numericSamples = (key) =>
  resourceSamples.map((sample) => sample[key]).filter(Number.isFinite);
const systemCpuSamples = numericSamples('systemCpuPercent');
const appCpuSamples = numericSamples('appCpuPercent');
const appRssSamples = numericSamples('appRssMb');
const appProcessCountSamples = numericSamples('appProcessCount');
const memAvailableSamples = numericSamples('memAvailableMb');
const loadSamples = numericSamples('load1');

const summary = {
  configuration: {
    target,
    hostHeader,
    virtualUsers,
    durationSeconds: durationMs / 1_000,
    requestTimeoutMs,
    thinkTimeMs: [thinkTimeMinMs, thinkTimeMaxMs],
    paths,
  },
  timing: {
    startedAt: testStartedAtIso,
    actualElapsedSeconds: Math.round(elapsedSeconds * 100) / 100,
  },
  traffic: {
    totalRequests: records.length,
    successful: successfulRecords.length,
    failed: failedRecords.length,
    errorRatePercent:
      records.length > 0
        ? Math.round((failedRecords.length / records.length) * 10_000) / 100
        : 0,
    requestsPerSecond: Math.round((records.length / elapsedSeconds) * 100) / 100,
    maxInFlight,
    transferredMb:
      Math.round(
        (records.reduce((sum, record) => sum + record.bytes, 0) / 1024 / 1024) *
          100,
      ) / 100,
    statusCounts,
    errors: Object.fromEntries(errorCounts),
    latency: summarizeLatencies(successfulRecords.map((record) => record.latencyMs)),
    endpoints: endpointResults,
  },
  resources: {
    cpuCores: os.cpus().length,
    totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
    systemCpuPercent: {
      avg: systemCpuSamples.length
        ? Math.round(average(systemCpuSamples) * 10) / 10
        : null,
      max: systemCpuSamples.length
        ? Math.round(Math.max(...systemCpuSamples) * 10) / 10
        : null,
    },
    appCpuPercent: {
      avg: appCpuSamples.length
        ? Math.round(average(appCpuSamples) * 10) / 10
        : null,
      max: appCpuSamples.length
        ? Math.round(Math.max(...appCpuSamples) * 10) / 10
        : null,
    },
    appRssMb: {
      min: appRssSamples.length
        ? Math.round(Math.min(...appRssSamples) * 10) / 10
        : null,
      max: appRssSamples.length
        ? Math.round(Math.max(...appRssSamples) * 10) / 10
        : null,
    },
    maxAppProcessCount: appProcessCountSamples.length
      ? Math.max(...appProcessCountSamples)
      : null,
    minimumAvailableMemoryMb: memAvailableSamples.length
      ? Math.round(Math.min(...memAvailableSamples))
      : null,
    maxLoad1: loadSamples.length
      ? Math.round(Math.max(...loadSamples) * 100) / 100
      : null,
    pm2Before,
    pm2After,
  },
};

console.log(JSON.stringify(summary, null, 2));
