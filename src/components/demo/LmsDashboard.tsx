"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Download,
  Edit,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Zap,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Role = 'ADMIN' | 'COACH' | 'CODER';
type Level = 'EXPLORER' | 'CREATOR' | 'INNOVATOR';
type SessionStatus = 'upcoming' | 'in-progress' | 'completed' | 'pitching-day';
type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';
type Grade = 'A' | 'B' | 'C';
type PositiveCharacter = 'Grit' | 'Social Intelligence' | 'Self Control' | 'Leadership' | 'Creativity';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
}

interface Class {
  id: string;
  name: string;
  level: Level;
  type: 'weekly' | 'ekskul';
  coachId: string;
  coderIds: string[];
  currentBlock?: string;
  nextBlockStart?: string;
  capacity: number;
}

interface Session {
  id: string;
  classId: string;
  blockId: string;
  sessionNumber: number;
  date: string;
  status: SessionStatus;
  isPitchingDay: boolean;
  attendance: Record<string, AttendanceStatus>;
}

interface Material {
  id: string;
  blockId: string;
  sessionNumber: number;
  title: string;
  type: 'pdf' | 'video' | 'link';
  url: string;
  unlocked: boolean;
}

interface Rubric {
  id: string;
  coderId: string;
  blockId: string;
  concept: Grade;
  creativity: Grade;
  debugging: Grade;
  tech: Grade;
  characters: PositiveCharacter[];
  goodText: string;
  improveText: string;
}

interface MakeupTask {
  id: string;
  coderId: string;
  sessionId: string;
  description: string;
  status: 'pending' | 'submitted' | 'approved';
  files?: string[];
}

interface WhatsAppStatus {
  connected: boolean;
  lastSync: string;
}

const levelStyles: Record<Level, string> = {
  EXPLORER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  CREATOR: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  INNOVATOR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

const attendanceStyles: Record<AttendanceStatus, string> = {
  present: 'bg-green-500',
  late: 'bg-yellow-500',
  excused: 'bg-blue-500',
  absent: 'bg-red-500',
};

const gradeStyles: Record<Grade, string> = {
  A: 'text-green-600 dark:text-green-400',
  B: 'text-blue-600 dark:text-blue-400',
  C: 'text-orange-600 dark:text-orange-400',
};

const navigationItems = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: BookOpen, label: 'Classes' },
  { icon: Users, label: 'Students' },
  { icon: Calendar, label: 'Schedule' },
  { icon: FileText, label: 'Reports' },
  { icon: Award, label: 'Rubrics' },
  { icon: MessageSquare, label: 'Messages' },
  { icon: Settings, label: 'Settings' },
];

const mockClasses: Class[] = [
  {
    id: 'c1',
    name: 'Explorer Batch A',
    level: 'EXPLORER',
    type: 'weekly',
    coachId: 'coach1',
    coderIds: ['s1', 's2', 's3'],
    currentBlock: 'Block 1: Introduction',
    nextBlockStart: '2025-02-01',
    capacity: 12,
  },
  {
    id: 'c2',
    name: 'Creator Batch B',
    level: 'CREATOR',
    type: 'weekly',
    coachId: 'coach2',
    coderIds: ['s4', 's5'],
    currentBlock: 'Block 3: Advanced Concepts',
    nextBlockStart: '2025-02-15',
    capacity: 10,
  },
];

const mockSessions: Session[] = [
  {
    id: 'sess1',
    classId: 'c1',
    blockId: 'b1',
    sessionNumber: 1,
    date: '2025-01-20',
    status: 'completed',
    isPitchingDay: false,
    attendance: { s1: 'present', s2: 'late', s3: 'present' },
  },
  {
    id: 'sess2',
    classId: 'c1',
    blockId: 'b1',
    sessionNumber: 2,
    date: '2025-01-27',
    status: 'upcoming',
    isPitchingDay: false,
    attendance: {},
  },
];

const mockMaterials: Material[] = [
  {
    id: 'm1',
    blockId: 'b1',
    sessionNumber: 1,
    title: 'Introduction to Coding',
    type: 'pdf',
    url: '#',
    unlocked: true,
  },
  {
    id: 'm2',
    blockId: 'b1',
    sessionNumber: 2,
    title: 'Variables and Data Types',
    type: 'video',
    url: '#',
    unlocked: false,
  },
];

const mockRubrics: Rubric[] = [
  {
    id: 'r1',
    coderId: 's1',
    blockId: 'b1',
    concept: 'A',
    creativity: 'B',
    debugging: 'A',
    tech: 'B',
    characters: ['Grit', 'Leadership', 'Creativity'],
    goodText: 'Showed strong understanding of control structures.',
    improveText: 'Encourage more initiative during debugging sessions.',
  },
];

const mockMakeups: MakeupTask[] = [
  {
    id: 'mk1',
    coderId: 's1',
    sessionId: 'sess1',
    description: 'Complete the game mechanics challenge from session 3.',
    status: 'pending',
  },
];

const whatsappStatus: WhatsAppStatus = {
  connected: true,
  lastSync: '2 min ago',
};

const mockUser: User = {
  id: '1',
  name: 'Fina Oktaviani',
  email: 'admin@clevio.com',
  role: 'ADMIN',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=clevio-admin',
};

const ClassCard: React.FC<{ classItem: Class }> = ({ classItem }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-base font-semibold">{classItem.name}</CardTitle>
      <Badge className={levelStyles[classItem.level]}>{classItem.level}</Badge>
    </CardHeader>
    <CardContent className="space-y-3 text-sm text-muted-foreground">
      <div className="flex items-center justify-between">
        <span>Type</span>
        <span className="font-medium capitalize">{classItem.type}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Current Block</span>
        <span className="font-medium">{classItem.currentBlock}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Next Block</span>
        <span className="font-medium">{classItem.nextBlockStart}</span>
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <span>Students</span>
        <span className="font-medium">
          {classItem.coderIds.length}/{classItem.capacity}
        </span>
      </div>
    </CardContent>
  </Card>
);

const AttendanceDot: React.FC<{ status: AttendanceStatus; title: string }> = ({ status, title }) => (
  <span
    title={title}
    className={cn('size-2.5 rounded-full', attendanceStyles[status])}
  />
);

const AdminDashboard: React.FC = () => {
  const quickActions = [
    { icon: Plus, label: 'Create Class', description: 'Plan a new batch or ekskul class' },
    { icon: Users, label: 'Add User', description: 'Invite new coach or coder' },
    { icon: FileText, label: 'Generate Report', description: 'Export pitching day reports' },
    { icon: Send, label: 'Send WhatsApp', description: 'Broadcast reminders & updates' },
  ];

  const recentActivity = [
    { icon: Users, action: 'New student enrolled', time: '5 min ago' },
    { icon: FileText, action: 'Rubric submitted by Coach Arya', time: '15 min ago' },
    { icon: Calendar, action: 'Class “Creator Batch B” scheduled', time: '1 hour ago' },
    { icon: Download, action: 'Report delivered to parents', time: '2 hours ago' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Classes', value: '24', icon: LayoutDashboard, trend: '+4.2%', tone: 'positive' },
          { label: 'Active Students', value: '156', icon: Users, trend: '+18', tone: 'positive' },
          { label: 'Upcoming Pitching Days', value: '8', icon: Target, trend: 'Next: Feb 02', tone: 'neutral' },
          { label: 'Pending Rubrics', value: '12', icon: FileText, trend: 'Due this week', tone: 'warning' },
        ].map(({ label, value, icon: Icon, trend, tone }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-semibold">{value}</div>
              <p
                className={cn(
                  'text-xs font-medium',
                  tone === 'positive' && 'text-emerald-500',
                  tone === 'warning' && 'text-amber-500',
                  tone === 'neutral' && 'text-muted-foreground',
                )}
              >
                {trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Kelola kelas dan komunikasi dengan cepat.</CardDescription>
              </div>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {quickActions.map(({ icon: Icon, label, description }) => (
              <Button
                key={label}
                variant="outline"
                className="flex h-auto flex-col items-start gap-1 rounded-xl border-dashed px-4 py-3 text-left"
              >
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-muted-foreground">{description}</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Pembaruan terakhir dari admin dan coach.</CardDescription>
            </div>
            <Button variant="ghost" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[240px]">
              <div className="space-y-3">
                {recentActivity.map(({ icon: Icon, action, time }, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-lg border bg-card/50 p-3">
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{action}</p>
                      <p className="text-xs text-muted-foreground">{time}</p>
                    </div>
                    <Button variant="ghost" size="icon">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="rubrics">Rubrics</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>
        <TabsContent value="classes">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mockClasses.map((cls) => (
              <ClassCard key={cls.id} classItem={cls} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="rubrics">
          <Card>
            <CardHeader>
              <CardTitle>Rubric Summary</CardTitle>
              <CardDescription>Pengisian rubrik per block & level.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockRubrics.map((rubric) => (
                <div key={rubric.id} className="space-y-3 rounded-xl border bg-card/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Coder ID #{rubric.coderId}</p>
                      <p className="text-xs text-muted-foreground">Block: {rubric.blockId}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      View Detail
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: 'Concept', value: rubric.concept },
                      { label: 'Creativity', value: rubric.creativity },
                      { label: 'Debugging', value: rubric.debugging },
                      { label: 'Technical', value: rubric.tech },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between rounded-lg border bg-background/60 px-3 py-2">
                        <span>{label}</span>
                        <span className={gradeStyles[value]}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rubric.characters.map((char) => (
                      <Badge key={char} variant="secondary">
                        {char}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground">
                    <p>
                      <strong className="text-foreground">Good:</strong> {rubric.goodText}
                    </p>
                    <p>
                      <strong className="text-foreground">Improve:</strong> {rubric.improveText}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>WhatsApp Integration</CardTitle>
                <CardDescription>Status koneksi worker WhatsApp.</CardDescription>
              </div>
              <Badge variant={whatsappStatus.connected ? 'default' : 'destructive'}>
                {whatsappStatus.connected ? 'Connected' : 'Disconnected'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border bg-card/60 p-4">
                <div>
                  <p className="text-sm font-medium">Worker status</p>
                  <p className="text-xs text-muted-foreground">Last sync: {whatsappStatus.lastSync}</p>
                </div>
                <Button variant="secondary">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View Logs
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button className="h-auto flex-col items-start gap-2 rounded-xl border border-dashed px-4 py-3" variant="outline">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Send className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold">Broadcast reminder</span>
                  <span className="text-xs text-muted-foreground">Kirim reminder pitching atau jadwal</span>
                </Button>
                <Button className="h-auto flex-col items-start gap-2 rounded-xl border border-dashed px-4 py-3" variant="outline">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold">Manage templates</span>
                  <span className="text-xs text-muted-foreground">Kelola template WA siap pakai</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const CoachDashboard: React.FC = () => {
  const upcoming = mockSessions.filter((session) => session.status === 'upcoming');
  const quickAttendance = ['Siti Rahma', 'Nara Pratama', 'Raka Wijaya'];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>My Classes</CardTitle>
            <CardDescription>Daftar kelas yang sedang Anda pegang.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockClasses.map((cls) => (
              <div
                key={cls.id}
                className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4 transition hover:border-primary hover:bg-primary/5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={levelStyles[cls.level]}>{cls.level}</Badge>
                    <h4 className="text-sm font-semibold">{cls.name}</h4>
                  </div>
                  <Button variant="ghost" size="icon">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <span>Current block: {cls.currentBlock}</span>
                  <span>Starts: {cls.nextBlockStart}</span>
                  <span>
                    Students:{' '}
                    <strong className="text-foreground">
                      {cls.coderIds.length}/{cls.capacity}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Upcoming Sessions</CardTitle>
              <CardDescription>Persiapkan absensi dan materi.</CardDescription>
            </div>
            <Button variant="ghost" size="icon">
              <Calendar className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((session) => (
              <div key={session.id} className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Session {session.sessionNumber}</p>
                  <p className="text-xs text-muted-foreground">{session.date}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:items-center">
                  <Button size="sm" variant="outline">
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    Lesson Plan
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Check className="mr-2 h-3.5 w-3.5" />
                        Mark Attendance
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Attendance Session {session.sessionNumber}</DialogTitle>
                        <DialogDescription>
                          Tandai kehadiran coder untuk sesi {session.sessionNumber}.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        {quickAttendance.map((student) => (
                          <div key={student} className="flex items-center justify-between rounded-lg border px-3 py-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Avatar className="size-8">
                                <AvatarFallback>{student[0]}</AvatarFallback>
                              </Avatar>
                              {student}
                            </div>
                            <div className="flex gap-2">
                              {(['present', 'late', 'excused', 'absent'] as AttendanceStatus[]).map((status) => (
                                <button
                                  key={status}
                                  className={cn(
                                    'inline-flex size-8 items-center justify-center rounded-full border text-xs capitalize',
                                    attendanceStyles[status],
                                  )}
                                >
                                  {status[0].toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <Button type="button">
                          <Check className="mr-2 h-4 w-4" />
                          Save Attendance
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Rubric Wizard</CardTitle>
            <CardDescription>Lengkapi rubrik akhir block student Anda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-card/60 p-3 text-sm">
              <div>
                <p className="font-semibold text-foreground">Block 1 - Explorer</p>
                <p className="text-xs text-muted-foreground">3 rubrik pending</p>
              </div>
              <Button size="sm">
                <Award className="mr-2 h-4 w-4" />
                Start
              </Button>
            </div>
            <div className="rounded-lg border bg-card/60 p-3 text-xs text-muted-foreground">
              <p>
                Tip: gunakan kalimat Good/Improve yang sudah dihasilkan otomatis. Anda dapat menyesuaikan tambahan catatan jika dibutuhkan.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Notes</CardTitle>
            <CardDescription>Catatan harian untuk kelas berjalan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea placeholder="Catatan untuk sesi hari ini..." />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Catatan terlihat oleh Admin.</span>
              <div className="inline-flex items-center gap-2">
                <Switch id="share-with-admin" defaultChecked />
                <Label htmlFor="share-with-admin">Share with Admin</Label>
              </div>
            </div>
            <Button size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Save Note
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rubric Drafts</CardTitle>
            <CardDescription>Rubrik yang belum final.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {mockRubrics.map((rubric) => (
              <div key={rubric.id} className="flex items-center justify-between rounded-lg border bg-card/60 px-3 py-2">
                <div>
                  <p className="font-medium">Coder #{rubric.coderId}</p>
                  <p className="text-xs text-muted-foreground">Block: {rubric.blockId}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const CoderDashboard: React.FC = () => {
  const projects = useMemo(
    () => [
      { title: 'Space Runner', status: 'In Review', score: 84 },
      { title: 'Interactive Story', status: 'Completed', score: 92 },
      { title: 'Logic Puzzle', status: 'In Progress', score: undefined },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Up Next</p>
            <h3 className="text-lg font-semibold">Block 2: Advanced Concepts</h3>
            <p className="text-sm text-muted-foreground">
              Mulai tanggal <strong className="text-foreground">1 Februari 2025</strong>. Siapkan project mini game dengan variabel dan kondisi.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> 3 sesi tersisa di block saat ini
              </span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5" /> Target pitching day 15 Februari
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Zap className="h-6 w-6" />
            </span>
            <Badge className="self-start bg-primary/20 text-primary">Explorer Level</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Progress Overview</CardTitle>
            <CardDescription>Perkembangan block dan aktivitas belajar Anda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Current Block</span>
                <span className="text-muted-foreground">75%</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Sessions', value: '12', icon: Calendar },
                { label: 'Materials', value: '8', icon: BookOpen },
                { label: 'Projects', value: '3', icon: Star },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl border bg-card/60 p-3 text-center">
                  <div className="mx-auto mb-2 inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-semibold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance & Make-up</CardTitle>
            <CardDescription>Rekap kehadiran dan tugas pengganti.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-lg border bg-card/50 p-3">
              <div>
                <p className="font-semibold text-foreground">Attendance Rate</p>
                <p className="text-xs text-muted-foreground">Hadir 9 dari 12 sesi</p>
              </div>
              <div className="flex gap-1">
                {(['present', 'present', 'late', 'absent', 'present', 'excused'] as AttendanceStatus[]).map((status, index) => (
                  <AttendanceDot key={`${status}-${index}`} status={status} title={status} />
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              {mockMakeups.map((task) => (
                <div key={task.id} className="flex flex-col gap-2 rounded-lg border bg-card/60 p-3">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Session {task.sessionId.toUpperCase()}</span>
                    <Badge variant="outline" className="text-xs">
                      {task.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                  <div className="flex items-center justify-between">
                    <Button size="sm" variant="secondary">
                      <Upload className="mr-2 h-3.5 w-3.5" />
                      Upload Submission
                    </Button>
                    <Button size="icon" variant="ghost">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Unlocked Materials</CardTitle>
            <CardDescription>Materi yang sudah tersedia untuk block ini.</CardDescription>
          </div>
          <Button variant="ghost" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[280px]">
            <div className="space-y-3">
              {mockMaterials.map((material) => (
                <div
                  key={material.id}
                  className={cn(
                    'flex flex-col gap-3 rounded-xl border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between',
                    !material.unlocked && 'opacity-60',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {material.type === 'pdf' ? <FileText className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{material.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Session {material.sessionNumber} • {material.type.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  {material.unlocked ? (
                    <Button size="sm" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Open Material
                    </Button>
                  ) : (
                    <Badge variant="secondary">Locked</Badge>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projects & Reports</CardTitle>
          <CardDescription>Portofolio dan rapor yang telah diterbitkan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {projects.map((project) => (
              <div key={project.title} className="rounded-xl border bg-card/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{project.title}</p>
                    <p className="text-xs text-muted-foreground">Status: {project.status}</p>
                  </div>
                  {project.score ? (
                    <Badge variant="default">{project.score} pts</Badge>
                  ) : (
                    <Badge variant="outline">In Progress</Badge>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline">
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    Preview
                  </Button>
                  <Button size="sm" variant="outline">
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Export PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="secondary">
              <FileText className="mr-2 h-4 w-4" />
              Block 1 Report (PDF)
            </Button>
            <Button variant="secondary">
              <FileText className="mr-2 h-4 w-4" />
              Semester Report (PDF)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SidebarNavItem: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; collapsed: boolean; active?: boolean }> = ({
  icon: Icon,
  label,
  collapsed,
  active = false,
}) => (
  <button
    className={cn(
      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      active ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent',
    )}
  >
    <Icon className="h-5 w-5" />
    {!collapsed && label}
  </button>
);

const DashboardHeader: React.FC<{
  role: Role;
  onRoleChange: (role: Role) => void;
  onSearch: (value: string) => void;
}> = ({ role, onRoleChange, onSearch }) => (
  <header className="flex h-16 items-center justify-between border-b bg-card px-6">
    <div className="flex items-center gap-4">
      <h1 className="text-xl font-semibold">LMS Dashboard</h1>
      <Select value={role} onValueChange={(value) => onRoleChange(value as Role)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ADMIN">Admin View</SelectItem>
          <SelectItem value="COACH">Coach View</SelectItem>
          <SelectItem value="CODER">Student View</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm text-muted-foreground sm:flex">
        <Search className="h-4 w-4" />
        <input
          className="bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Search classes, students, reports..."
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <Button variant="ghost" size="icon">
        <Bell className="h-5 w-5" />
      </Button>
      <Separator orientation="vertical" className="hidden h-6 sm:block" />
      <div className="hidden items-center gap-2 sm:flex">
        <Avatar className="size-9">
          <AvatarImage src={mockUser.avatar} />
          <AvatarFallback>{mockUser.name[0]}</AvatarFallback>
        </Avatar>
        <div className="text-xs leading-tight">
          <p className="font-semibold text-foreground">{mockUser.name}</p>
          <p className="text-muted-foreground">Admin</p>
        </div>
      </div>
      <Button variant="outline" size="icon">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  </header>
);

export const LmsDashboardShowcase: React.FC = () => {
  const [role, setRole] = useState<Role>('ADMIN');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClasses = useMemo(() => {
    if (!searchTerm) return mockClasses;
    return mockClasses.filter((classItem) =>
      classItem.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm]);

  const handleRoleChange = useCallback((nextRole: Role) => setRole(nextRole), []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleResize = () => setSidebarCollapsed(window.innerWidth < 640);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          'flex h-screen flex-col border-r bg-card transition-all duration-300',
          sidebarCollapsed ? 'w-[4.75rem]' : 'w-64',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">Clevio LMS</span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed((prev) => !prev)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-3">
            {navigationItems.map((item, index) => (
              <SidebarNavItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                collapsed={sidebarCollapsed}
                active={index === 0}
              />
            ))}
          </div>
        </ScrollArea>
        <div className="flex items-center gap-2 border-t p-4">
          <Avatar className="size-9">
            <AvatarImage src={mockUser.avatar} />
            <AvatarFallback>{mockUser.name[0]}</AvatarFallback>
          </Avatar>
          {!sidebarCollapsed && (
            <div className="text-xs">
              <p className="font-semibold text-foreground">{mockUser.name}</p>
              <p className="text-muted-foreground">{mockUser.email}</p>
            </div>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader role={role} onRoleChange={handleRoleChange} onSearch={setSearchTerm} />

        <main className="flex-1 overflow-y-auto bg-muted/40">
          <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={role}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                {role === 'ADMIN' && <AdminDashboard />}
                {role === 'COACH' && <CoachDashboard />}
                {role === 'CODER' && <CoderDashboard />}
              </motion.div>
            </AnimatePresence>

            <section className="rounded-2xl border bg-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Class Directory Preview</h2>
                  <p className="text-sm text-muted-foreground">
                    Filtered by <span className="font-medium text-foreground">{searchTerm || 'All classes'}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                  </Button>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Class
                  </Button>
                </div>
              </div>
              <Divider />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredClasses.map((cls) => (
                  <Card key={`${cls.id}-filtered`} className="border-dashed">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center justify-between">
                        <Badge className={levelStyles[cls.level]}>{cls.level}</Badge>
                        <span className="text-xs text-muted-foreground">Next block {cls.nextBlockStart}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{cls.name}</p>
                        <p className="text-xs text-muted-foreground">Coach ID: {cls.coachId}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Students</span>
                        <span className="font-medium">
                          {cls.coderIds.length}/{cls.capacity}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  );
};

const Divider = () => <Separator className="my-4" />;
