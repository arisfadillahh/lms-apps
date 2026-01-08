import { addDays } from 'date-fns';
import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, classesDao, sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { autoPlanWeeklyClass } from '@/lib/services/classAutoPlanner';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { BlockRecord } from '@/lib/dao/blocksDao';

type SeedSpec = {
  name: string;
  type: 'WEEKLY' | 'EKSKUL';
  levelName?: string;
  coachUsername: string;
  coderUsernames: string[];
  scheduleDay: string;
  scheduleTime: string;
  startOffsetDays: number;
  durationWeeks: number;
  zoomLink: string;
  sessionCount?: number;
  startBlockName?: string;
};

type SeedResult = {
  id: string;
  name: string;
  type: 'WEEKLY' | 'EKSKUL';
  scheduleDay: string;
  scheduleTime: string;
  sessionsCreated: number;
  codersEnrolled: number;
};

const DAY_LOOKUP: Record<
  string,
  {
    index: number;
    code: 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';
  }
> = {
  SU: { index: 0, code: 'SU' },
  SUN: { index: 0, code: 'SU' },
  SUNDAY: { index: 0, code: 'SU' },
  MO: { index: 1, code: 'MO' },
  MON: { index: 1, code: 'MO' },
  MONDAY: { index: 1, code: 'MO' },
  TU: { index: 2, code: 'TU' },
  TUE: { index: 2, code: 'TU' },
  TUESDAY: { index: 2, code: 'TU' },
  WE: { index: 3, code: 'WE' },
  WED: { index: 3, code: 'WE' },
  WEDNESDAY: { index: 3, code: 'WE' },
  TH: { index: 4, code: 'TH' },
  THU: { index: 4, code: 'TH' },
  THURSDAY: { index: 4, code: 'TH' },
  FR: { index: 5, code: 'FR' },
  FRI: { index: 5, code: 'FR' },
  FRIDAY: { index: 5, code: 'FR' },
  SA: { index: 6, code: 'SA' },
  SAT: { index: 6, code: 'SA' },
  SATURDAY: { index: 6, code: 'SA' },
};

const CLASS_SEEDS: SeedSpec[] = [
  {
    name: 'Explorer Squad Alpha',
    type: 'WEEKLY',
    levelName: 'Xplorer',
    coachUsername: 'coach.nadia',
    coderUsernames: ['coder.farrel', 'coder.salma'],
    scheduleDay: 'Wednesday',
    scheduleTime: '15:30',
    startOffsetDays: 2,
    durationWeeks: 10,
    zoomLink: 'https://zoom.clev.io/explorer-alpha',
  },
  {
    name: 'Creator Night Builders',
    type: 'WEEKLY',
    levelName: 'Creator',
    coachUsername: 'bagas',
    coderUsernames: ['fatih'],
    scheduleDay: 'Friday',
    scheduleTime: '19:00',
    startOffsetDays: 4,
    durationWeeks: 10,
    zoomLink: 'https://zoom.clev.io/creator-night',
  },
  {
    name: 'Innovator Launch Lab',
    type: 'WEEKLY',
    levelName: 'Innovator',
    coachUsername: 'malfo',
    coderUsernames: ['coder.farrel'],
    scheduleDay: 'Monday',
    scheduleTime: '18:30',
    startOffsetDays: 6,
    durationWeeks: 12,
    zoomLink: 'https://zoom.clev.io/innovator-launch',
  },
  {
    name: 'Ekskul Design Sprint',
    type: 'EKSKUL',
    coachUsername: 'coach.nadia',
    coderUsernames: ['coder.salma'],
    scheduleDay: 'Saturday',
    scheduleTime: '09:00',
    startOffsetDays: 5,
    durationWeeks: 6,
    sessionCount: 6,
    zoomLink: 'https://zoom.clev.io/eks-design-sprint',
  },
];

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function alignDateToWeekday(base: Date, targetIndex: number): Date {
  const aligned = new Date(base);
  const delta = (targetIndex - aligned.getDay() + 7) % 7;
  aligned.setDate(aligned.getDate() + delta);
  return aligned;
}

function resolveDayMeta(day: string) {
  const normalized = day.trim().toUpperCase();
  const meta = DAY_LOOKUP[normalized];
  if (!meta) {
    throw new Error(`Invalid schedule day "${day}"`);
  }
  return meta;
}

async function deleteAllClasses(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('classes').select('id');
  if (error) {
    throw new Error(`Failed to list classes: ${error.message}`);
  }
  const ids = (data ?? []).map((row: { id: string }) => row.id);
  if (ids.length === 0) {
    return 0;
  }
  const { error: deleteError } = await supabase.from('classes').delete().in('id', ids);
  if (deleteError) {
    throw new Error(`Failed to delete classes: ${deleteError.message}`);
  }
  return ids.length;
}

async function fetchLevelIds(names: string[]): Promise<Record<string, string>> {
  const uniqueNames = Array.from(new Set(names.filter(Boolean)));
  if (uniqueNames.length === 0) {
    return {};
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('levels').select('id, name').in('name', uniqueNames);
  if (error) {
    throw new Error(`Failed to load levels: ${error.message}`);
  }

  const map: Record<string, string> = {};
  (data ?? []).forEach((row: { id: string; name: string }) => {
    map[row.name] = row.id;
  });

  const missing = uniqueNames.filter((name) => !map[name]);
  if (missing.length > 0) {
    throw new Error(`Missing level(s): ${missing.join(', ')}`);
  }

  return map;
}

async function fetchBlocksForLevels(levelIds: string[]): Promise<Record<string, BlockRecord[]>> {
  const uniqueIds = Array.from(new Set(levelIds.filter(Boolean)));
  const entries = await Promise.all(
    uniqueIds.map(async (id) => {
      const blocks = await blocksDao.listBlocksByLevel(id);
      return [id, blocks] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function fetchUserIds(usernames: string[], role: 'COACH' | 'CODER'): Promise<Record<string, string>> {
  const uniqueNames = Array.from(new Set(usernames));
  if (uniqueNames.length === 0) {
    return {};
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role')
    .in('username', uniqueNames)
    .eq('role', role);

  if (error) {
    throw new Error(`Failed to load ${role.toLowerCase()}s: ${error.message}`);
  }

  const map: Record<string, string> = {};
  (data ?? []).forEach((row: { id: string; username: string }) => {
    map[row.username] = row.id;
  });

  const missing = uniqueNames.filter((name) => !map[name]);
  if (missing.length > 0) {
    throw new Error(`Missing ${role.toLowerCase()} user(s): ${missing.join(', ')}`);
  }

  return map;
}

export async function POST() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const deleted = await deleteAllClasses();

  const levelNames = CLASS_SEEDS.map((spec) => spec.levelName).filter(Boolean) as string[];
  const levelMap = await fetchLevelIds(levelNames);
  const blockMap = await fetchBlocksForLevels(Object.values(levelMap));

  const coachUsernames = CLASS_SEEDS.map((spec) => spec.coachUsername);
  const coderUsernames = CLASS_SEEDS.flatMap((spec) => spec.coderUsernames);

  const coachMap = await fetchUserIds(coachUsernames, 'COACH');
  const coderMap = await fetchUserIds(coderUsernames, 'CODER');

  const results: SeedResult[] = [];
  const baseDate = new Date();

  for (const spec of CLASS_SEEDS) {
    const coachId = coachMap[spec.coachUsername];
    const levelId = spec.levelName ? levelMap[spec.levelName] : null;
    const startDateRaw = addDays(baseDate, spec.startOffsetDays);
    const endDateRaw = addDays(startDateRaw, spec.durationWeeks * 7);
    const startDate = toDateString(startDateRaw);
    const endDate = toDateString(endDateRaw);

    const classRecord = await classesDao.createClass({
      name: spec.name,
      type: spec.type,
      levelId,
      coachId,
      scheduleDay: spec.scheduleDay,
      scheduleTime: spec.scheduleTime,
      zoomLink: spec.zoomLink,
      startDate,
      endDate,
    });

    let sessionsCreated = 0;

    let startBlockId: string | undefined;
    if (levelId && spec.startBlockName) {
      const levelBlocksList = blockMap[levelId] ?? [];
      startBlockId = levelBlocksList.find((block) => block.name === spec.startBlockName)?.id;
    }

    if (classRecord.type === 'WEEKLY') {
      const planningResult = await autoPlanWeeklyClass(classRecord, startBlockId);
      sessionsCreated = planningResult.skipped ? 0 : planningResult.sessionsCreated;
    } else if (spec.sessionCount && spec.sessionCount > 0) {
      const dayMeta = resolveDayMeta(spec.scheduleDay);
      const firstSessionDate = alignDateToWeekday(startDateRaw, dayMeta.index);
      const sessionEndDate = addDays(firstSessionDate, (spec.sessionCount - 1) * 7);
      const generated = await sessionsDao.generateSessions({
        classId: classRecord.id,
        startDate: toDateString(firstSessionDate),
        endDate: toDateString(sessionEndDate),
        byDay: [dayMeta.code],
        time: spec.scheduleTime,
        zoomLinkSnapshot: spec.zoomLink,
      });
      sessionsCreated = generated.length;
    }

    let codersEnrolled = 0;
    for (const coderUsername of spec.coderUsernames) {
      const coderId = coderMap[coderUsername];
      if (!coderId) {
        continue;
      }
      await classesDao.enrollCoder({
        classId: classRecord.id,
        coderId,
      });
      codersEnrolled += 1;
    }

    results.push({
      id: classRecord.id,
      name: classRecord.name,
      type: classRecord.type,
      scheduleDay: classRecord.schedule_day,
      scheduleTime: classRecord.schedule_time,
      sessionsCreated,
      codersEnrolled,
    });
  }

  return NextResponse.json({
    deletedClasses: deleted,
    createdClasses: results,
  });
}
