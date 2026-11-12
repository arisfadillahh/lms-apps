export const holidayBatches = [
  { label: '14–16 Des 2026', start: '2026-12-14', end: '2026-12-16' },
  { label: '17–19 Des 2026', start: '2026-12-17', end: '2026-12-19' },
  { label: '21–23 Des 2026', start: '2026-12-21', end: '2026-12-23' },
  { label: '24–26 Des 2026', start: '2026-12-24', end: '2026-12-26' },
  { label: '28–30 Des 2026', start: '2026-12-28', end: '2026-12-30' },
  { label: '4–6 Jan 2027', start: '2027-01-04', end: '2027-01-06' },
  { label: '7–9 Jan 2027', start: '2027-01-07', end: '2027-01-09' },
] as const;

export const holidayLevels = [
  { name: 'Explorer', grade: 'Kelas 1–3 SD', minGrade: 1, maxGrade: 3, price: 350000, bundle: 900000, programs: [
    ['Scratch Jr.', '09.00', '13.00', '11.30', '11.30', '09.00', '09.00', '09.00'],
    ['Kodu', '09.00', '09.00', '11.30', '10.00', '09.00', '11.30', '09.00'],
    ['Minecraft Builder', '11.30', '10.00', '13.00', '09.00', '09.00', '13.00', '09.00'],
  ] },
  { name: 'Creator', grade: 'Kelas 4–6 SD', minGrade: 4, maxGrade: 6, price: 425000, bundle: 1100000, programs: [
    ['MakeCode', '11.30', '11.30', '13.00', '09.00', '09.00', '13.00', '09.00'],
    ['GDevelop', '14.00', '13.00', '13.00', '14.00', '11.30', '09.00', '09.00'],
    ['Minecraft Code', '14.00', '14.00', '13.00', '09.00', '11.30', '11.30', '09.00'],
    ['Scratch 3', '09.00', '13.00', '09.00', '09.00', '14.00', '13.00', '14.00'],
  ] },
  { name: 'Innovator', grade: 'Kelas 7 SMP–12 SMA', minGrade: 7, maxGrade: 12, price: 500000, bundle: 1300000, programs: [
    ['Vibe Coding Godot + MCP', '09.00', '13.00', '09.00', '09.00', '14.00', '13.00', '11.30'],
    ['n8n Automation', '09.00', '13.00', '14.00', '09.00', '09.00', '14.00', '09.00'],
    ['Vibes Coding (VS Code)', '09.00', '13.00', '14.00', '09.00', '09.00', '14.00', '10.00'],
  ] },
] as const;

export const holidayPlatformFee = 200000;
export const holidaySessionMinutes = 90;
export const holidayInvoicePattern = /^HC-2627-\d{6,}$/;

export function holidayStartMinutes(time: string) {
  const [hour, minute] = time.split('.').map(Number);
  return hour * 60 + minute;
}
