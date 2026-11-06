#!/usr/bin/env python3
"""Read-only replay of retained payroll executions. Never writes n8n or Sheets."""
import argparse
import base64
import datetime as dt
import json
import pathlib
import re
import sqlite3
import subprocess
import sys
from zoneinfo import ZoneInfo

REVIEWED_CODE_HASH = '596aa09c722a8c4c088d283662e4f25b89fa4eef7332cf88ede997654432cea8'
MAX_EXECUTIONS = 40
MAX_SOURCE_BYTES = 32 * 1024 * 1024

NODE_REPLAY = r"""
(async () => {
  const fs = require('fs'), { parse } = require('flatted'), { createHash } = require('crypto');
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const lib = await import('data:text/javascript;base64,' + input.moduleBase64);
  const fields = new Set(lib.EVIDENCE_FIELDS);
  const trim = row => Object.fromEntries(Object.entries(row ?? {}).filter(([key]) => fields.has(key)));
  const results = [], fingerprints = [], ignored = [];
  const runtimeTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  for (const entry of input.executions) {
    const execution = parse(entry.data), runData = execution.resultData?.runData ?? {};
    if (!runData.Code5) { ignored.push(String(entry.id)); continue; }
    const workflow = typeof entry.workflowData === 'string' ? JSON.parse(entry.workflowData) : entry.workflowData;
    const code = workflow.nodes.find(node => node.name === 'Code5')?.parameters?.jsCode ?? '';
    const expectedSheets = { 'Google Sheets5': 'Jadwal Coaches', 'Google Sheets6': 'Izin', 'Google Sheets7': 'ID Coaches', 'Google Sheets8': 'ID Coaches' };
    const sourceConfigurationVerified = Object.entries(expectedSheets).every(([name, title]) => {
      const parameters = workflow.nodes.find(node => node.name === name)?.parameters;
      const value = parameters?.documentId?.value ?? parameters?.documentId;
      const id = typeof value === 'string' ? value.match(/\/spreadsheets\/d\/([^/]+)/)?.[1] ?? value : null;
      return id === input.sourceSpreadsheetId && parameters?.sheetName?.cachedResultName === title;
    });
    const hash = createHash('sha256').update(code).digest('hex');
    if (hash !== input.reviewedCodeHash) { results.push({ executionId: String(entry.id), verified: false, failures: ['unreviewed_code_hash'], codeHash: hash, meetings: [] }); continue; }
    for (const [nodeRun, task] of runData.Code5.entries()) {
      const source = task.source?.[0];
      const previous = source && runData[source.previousNode]?.[source.previousNodeRun ?? 0];
      const incoming = previous?.data?.main?.[source.previousNodeOutput ?? 0];
      const writer = runData['Google Sheets8']?.[nodeRun];
      const stored = task.data?.main?.[0];
      if (!incoming || !stored || incoming.length > 1500 || !Number.isFinite(task.startTime)) {
        results.push({ executionId: String(entry.id), nodeRun, verified: false, failures: ['missing_or_oversized_node_evidence'], meetings: [] }); continue;
      }
      const at = new Date(task.startTime).toISOString();
      const raw = { executionId: String(entry.id), startedAt: entry.startedAt, nodeRun, at, timezone: runtimeTimezone, code,
        items: incoming.map(item => trim(item.json)), storedOutput: stored.map(item => trim(item.json)),
        writerSucceeded: Boolean(writer?.executionStatus === 'success' && writer.source?.[0]?.previousNode === 'Code5' && writer.data?.main?.[0]),
        writerOutput: (writer?.data?.main?.[0] ?? []).map(item => trim(item.json)), taskCount: runData.Code5.length,
        sourceWeekday: runData.Code3?.[0]?.data?.main?.[0]?.[0]?.json?.today };
      if (hash !== input.reviewedCodeHash) throw Error('unreviewed_code');
      let result;
      try { result = lib.verifySourceRun(raw, code); }
      catch { result = { executionId: String(entry.id), verified: false, failures: ['replay_evidence_invalid'], meetings: [] }; }
      if (!sourceConfigurationVerified || source.previousNode !== 'Merge') { result.verified = false; result.failures.push('source_configuration_not_verified'); result.meetings = []; }
      result.nodeRun = nodeRun; result.retryOf = entry.retryOf ?? null;
      result.retrySuccessId = entry.retrySuccessId ?? null;
      for (const meeting of [...(result.meetings ?? []), ...(result.unresolved ?? [])]) Object.assign(meeting.provenance, { sourceDocumentId: input.sourceSpreadsheetId, sourceSheet: 'Jadwal Coaches', leaveSheet: meeting.substitute ? 'Izin' : null });
      results.push(result);
      fingerprints.push([String(entry.id), nodeRun, task.startTime, hash, createHash('sha256').update(JSON.stringify(raw.items)).digest('hex'), createHash('sha256').update(JSON.stringify(raw.storedOutput)).digest('hex'), createHash('sha256').update(JSON.stringify(raw.writerOutput)).digest('hex')]);
    }
  }
  const output = lib.summarizeSourceRuns(results, { startsOn: input.startsOn, throughDate: input.throughDate });
  output.summary.ignoredExecutionsWithoutCodeNode = ignored.length;
  output.schema = 1; output.period = input.period; output.capturedAt = new Date().toISOString();
  output.reviewedCodeHash = input.reviewedCodeHash; output.runtimeTimezone = runtimeTimezone;
  output.fingerprintInputs = fingerprints;
  output.snapshotFingerprint = createHash('sha256').update(JSON.stringify(fingerprints)).digest('hex');
  console.log(JSON.stringify(output));
})().catch(() => { console.error('attendance_replay_failed'); process.exitCode = 2; });
"""


def period_bounds(period, now=None):
    if not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])', period):
        raise ValueError('invalid_period')
    year, month = map(int, period.split('-'))
    start_year, start_month = (year - 1, 12) if month == 1 else (year, month - 1)
    zone = ZoneInfo('Asia/Jakarta')
    start = dt.datetime(start_year, start_month, 26, tzinfo=zone)
    end = dt.datetime(year, month, 26, tzinfo=zone)
    current = now or dt.datetime.now(zone)
    through = min(current.astimezone(zone).date(), end.date() - dt.timedelta(days=1))
    return start, end, through


def replay_module():
    embedded = globals().get('REPLAY_MODULE_BASE64')
    return embedded or base64.b64encode((pathlib.Path(__file__).parent / 'lib/payroll-attendance-replay.mjs').read_bytes()).decode()


def extract_local(args):
    config = json.loads(pathlib.Path(args.config).read_text())
    start, end, through = period_bounds(args.period)
    iso = lambda value: value.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    # n8n SQLite uses a space separator; normalize with julianday for boundary safety.
    database = pathlib.Path(config['database']).resolve().as_uri() + '?mode=ro'
    with sqlite3.connect(database, uri=True, timeout=5) as db:
        db.execute('BEGIN')
        workflow = db.execute('SELECT id FROM workflow_entity WHERE name=?', (args.workflow_name,)).fetchall()
        if len(workflow) != 1:
            raise ValueError('workflow_not_unique')
        metadata = db.execute('''SELECT e.id,e.startedAt,e.retryOf,e.retrySuccessId,length(CAST(d.data AS BLOB)),length(CAST(d.workflowData AS BLOB))
          FROM execution_entity e JOIN execution_data d ON d.executionId=e.id
          WHERE e.workflowId=? AND e.status='success' AND julianday(e.startedAt)>=julianday(?)
            AND julianday(e.startedAt)<julianday(?) AND d.data LIKE '%Code5%'
          ORDER BY e.startedAt,e.id LIMIT ?''', (workflow[0][0], iso(start), iso(end), MAX_EXECUTIONS + 1)).fetchall()
        if len(metadata) > MAX_EXECUTIONS:
            raise ValueError('source_execution_limit')
        if sum((row[4] or 0) + (row[5] or 0) for row in metadata) > MAX_SOURCE_BYTES:
            raise ValueError('source_byte_limit')
        executions = []
        for execution_id, started, retry_of, retry_success, _, _ in metadata:
            data, workflow_data = db.execute('SELECT data,workflowData FROM execution_data WHERE executionId=?', (execution_id,)).fetchone()
            executions.append({'id': str(execution_id), 'startedAt': started, 'retryOf': retry_of, 'retrySuccessId': retry_success, 'data': data, 'workflowData': workflow_data})
    payload = {'executions': executions, 'moduleBase64': replay_module(), 'reviewedCodeHash': REVIEWED_CODE_HASH,
               'period': args.period, 'startsOn': start.date().isoformat(), 'throughDate': through.isoformat(), 'sourceSpreadsheetId': config['spreadsheet_id']}
    result = subprocess.run(['docker', 'exec', '-i', '-w', '/usr/local/lib/node_modules/n8n', config['container'], 'node', '-e', NODE_REPLAY],
                            input=json.dumps(payload), text=True, capture_output=True, timeout=45)
    if result.returncode or len(result.stdout.encode()) > MAX_SOURCE_BYTES:
        raise ValueError('source_replay_failed')
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True)
    parser.add_argument('--period', required=True)
    parser.add_argument('--workflow-name', default='Clevio')
    parser.add_argument('--json', action='store_true', help='Private JSON on stdout; never log this payload.')
    parser.add_argument('--output', help='Optional private local evidence artifact.')
    parser.add_argument('--ssh-target', help='Optional read-only remote execution; no files copied to VPS.')
    parser.add_argument('--ssh-key')
    args = parser.parse_args()
    period_bounds(args.period)
    if args.ssh_target:
        if not re.fullmatch(r'[a-zA-Z0-9_.@-]+', args.ssh_target) or not re.fullmatch(r'/[a-zA-Z0-9_./-]+', args.config) or not re.fullmatch(r'[a-zA-Z0-9_-]+', args.workflow_name):
            raise ValueError('invalid_ssh_target_or_config_path')
        program = 'REPLAY_MODULE_BASE64 = ' + repr(replay_module()) + '\n' + pathlib.Path(__file__).read_text()
        command = ['ssh', '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10']
        if args.ssh_key:
            command += ['-i', args.ssh_key]
        command += [args.ssh_target, 'python3', '-', '--config', args.config, '--period', args.period, '--workflow-name', args.workflow_name, '--json']
        result = subprocess.run(command, input=program, text=True, capture_output=True, timeout=60)
        if result.returncode or len(result.stdout.encode()) > MAX_SOURCE_BYTES:
            raise ValueError('remote_source_read_failed')
        output = json.loads(result.stdout)
    else:
        output = extract_local(args)
    if args.output:
        path = pathlib.Path(args.output)
        with path.open('w', encoding='utf8') as handle:
            path.chmod(0o600)
            json.dump(output, handle, ensure_ascii=False)
    if args.json:
        print(json.dumps(output, ensure_ascii=False))
    else:
        summary = output['summary']
        print(json.dumps({key: summary[key] for key in ['totalRuns', 'verifiedRuns', 'unverifiedRuns', 'meetingCount', 'unresolvedMeetingCount']}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        allowed = {'invalid_period', 'workflow_not_unique', 'source_execution_limit', 'source_byte_limit', 'source_replay_failed', 'remote_source_read_failed', 'invalid_ssh_target_or_config_path'}
        print(str(error) if str(error) in allowed else 'attendance_source_unavailable', file=sys.stderr)
        sys.exit(2)
